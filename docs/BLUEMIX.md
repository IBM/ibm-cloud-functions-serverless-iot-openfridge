# Setting up the environment
This document describes how to use Bluemix to set up the Cloudant database, SendGrid email service, configure and test the Watson IoT service and devices, and then deploy a Cloud Foundry application that proxies MQTT events to the OpenWhisk actions.

After completing the steps here, proceed to [set up the OpenWhisk actions, triggers, and rules](OPENWHISK.md).

## Provision services and set environment variables
Start by copying `template.local.env` to a new `local.env` file. You can fill in additional details as you go through the steps below. The `.gitignore` file will prevent that private file from being pushed to source control if you push modifications to your own fork.

### Set up Cloudant
Log into the [Bluemix console](https://console.ng.bluemix.net/) and create a [Cloudant instance](https://console.ng.bluemix.net/catalog/services/cloudant-nosql-db/?taxonomyNavigation=services). You can reuse an existing instance if you already have one.
**Important**: the name of the Cloudant service instance must start with the `cloudant` prefix (case insensitive), for example `cloudant-openfridge`.

Update `CLOUDANT_INSTANCE` in `local.env` to reflect the name of the Cloudant service instance and ensure it matches what's set in `feeds/cf/mqtt/manifest.yml`. Then set the `CLOUDANT_USERNAME` and `CLOUDANT_PASSWORD` values in `local.env` based on the credentials for the service.

Launch the Cloudant console and create three databases. Set their names in the `CLOUDANT_SERVICE_DATABASE`, `CLOUDANT_ORDER_DATABASE`, and `CLOUDANT_APPLIANCE_DATABASE` variables. For example, `service`, `order`, and `appliance`.

Create one more `topic_listeners` database in Cloudant, which will manage the state of the MQTT subscriptions. Then add this Design Document to the database:

```json
{
  "_id": "_design/subscriptions",
  "views": {
    "host_topic_counts": {
      "reduce": "_sum",
      "map": "function (doc) {\n  emit(doc.url + '#' + doc.topic, 1);\n}"
    },
    "host_topic_triggers": {
      "map": "function (doc) {\n  emit(doc.url + '#' + doc.topic, {trigger: doc._id, openWhiskUsername: doc.openWhiskUsername, openWhiskPassword: doc.openWhiskPassword});\n}"
    },
    "all": {
      "map": "function (doc) {\n  emit(doc._id, doc.url + '#' + doc.topic);\n}"
    },
    "host_triggers": {
      "map": "function (doc) {\n  emit(doc.url, {trigger: doc._id, openWhiskUsername: doc.openWhiskUsername, openWhiskPassword: doc.openWhiskPassword});\n}"
    }
  }
}
```

### Set up SendGrid
Log into the Bluemix console and create a [SendGrid](https://console.ng.bluemix.net/catalog/services/sendgrid/?taxonomyNavigation=services) instance. If you don't want to pay for the minimum plan, you can go to [SendGrid directly to request a free trial](http://sendgrid.com/). Follow the developer documentation to configure an API key. Update `local.env` accordingly. There is important additional information on [configuring SendGrid with Bluemix here](https://www.ibm.com/blogs/bluemix/2016/12/using-sendgrid-easy-sending-email/) in case you run into any issues.

## Set up IoT Foundation

### Provision an instance of the Watson IoT Platform
* Log into the Bluemix console, provision an instance of the [Watson IoT Platform](https://console.ng.bluemix.net/catalog/services/internet-of-things-platform/?taxonomyNavigation=services), then launch the service dashboard.

### Create device type
* On the left side menu, choose "Devices" then click the "Add Device" button on the right. You'll need to create a "Device Type" first, so create one with a Name of "refrigerator-simulator", give it a Description of "A way to simulate a refrigerator", and select "Serial Number", "Manufacturer" and "Model" attributes for the new device type (e.g., using "0" as template values).

### Create a device of that type
* Continue in the same dialog window to add a device instance. Give it a Device ID of "1", Serial number of "aaaabbbbcccc", a Manufacturer of "Electrolux", and a Model of "1200n" and autogenerate (or enter) a Token. You will need to specify this token when connecting the device to the IoT Platform (in our case, in the Paho connection options, as outlined below).
* Optionally, create two more devices with unique IDs and Serials, such as "2", "llllmmmmnnnn" and "3", "xxxxyyyyzzzz".

### Create application access token
* Your devices now have all the access information they need, but you'll need to set up a separate API key for the consuming application, which will be a Node.js application deployed via Cloud Foundry on Bluemix.
* On the dashboard, choose "Apps" and pick the "API keys" tab. Click the "Generate API Key" button. Save the generated key and token and update them in `local.env`. You also need them for the Paho client setup (as outlined below). Click "Generate".

## Set up IoT event producer to simulate the device

### Install Paho for your workstation and add devices
* Download [Eclipse Paho](http://www.eclipse.org/paho/clients/tool/) for your computer type, then open it and create a new Connection.
* You'll need to know the `WATSON_TEAM_ID` (which you should also set in `local.env`). This is the six character alphanumeric ID that you'll see in the top right corner of the Watson IoT dashboard you used earlier.
* Set the "Server URI" to `tcp://$WATSON_TEAM_ID.messaging.internetofthings.ibmcloud.com:1883` (replacing `$WATSON_TEAM_ID` with your six digit ID).
* Set the "Client ID" to `d:$WATSON_TEAM_ID:refrigerator-simulator:$DEVICE_1_ID` (replacing `$DEVICE_1_ID` with the value you set in the previous section. This value doesn't have to be added to `local.env`).
* On the Options tab, check the "Enable login" box, set the "Username" to "use-token-auth" and enter the token for the specific device in the "Password" field.
* Optionally, create an additional two device connections following the previous steps.
* Finally, create a message consuming application connection using the same steps as for the devices, except for the "Client ID" which will be `a:$WATSON_TEAM_ID:openfridge`, and your "Username" and "Password" which will be your API Key information from the previous section (key and token). Update the `WATSON_USERNAME`, `WATSON_PASSWORD` and `WATSON_CLIENT` in `local.env` accordingly.

### Connect to IoT Platform and post a message
* First, let's subscribe the application to receive messages from all devices. Add a "Subscription" to the `iot-2/type/+/id/+/evt/+/fmt/json` topic. Note that this queue format is different from the ones the devices post to because it contains wildcards. Update the topic also in `local.env` file.
* From the device simulators, then publish a test message onto the Device Type topic. You can find [sample messages for 3 devices here](sample-messages.txt).
* Enter the "Topic" as `iot-2/evt/refrigerator-simulator/fmt/json` in the "Publication" area.
* Enter the sample JSON, making sure the Serial matches your Device.
```json
{
    "appliance_serial": "aaaabbbbcccc",
    "part_number": "ddddeeeeffff",
    "reading": "15",
    "timestamp": 1466632598
}
```
* Look back at the History tab for the application, and you should see the message has been received. Now that we've tested connectivity, let's use a Cloud Foundry application to be the application we use to listen for events on that MQTT topic.

### Add a record for this device in Cloudant
The `CLOUDANT_APPLIANCE_DATABASE` database is a listing of documents that map a customer to a particular appliance, so create one or more documents that map the `appliance_serial` to a particular owner. You can find [sample appliance documents for 3 devices here](sample-appliances.txt)

```json
{
  "_id": "aaaabbbbcccc",
  "serial": "aaaabbbbcccc",
  "warranty_expiration": 1467259200,
  "owner_name": "Daniel Krook",
  "owner_email": "krook@example.com",
  "owner_phone": "18885551212"
}
```
**Important**: the email address specified here will be eventually used to receive email notifications by the OpenWhisk actions - make sure it is valid.

## Create MQTT feed provider
Since there isn't a single multitenant MQTT event producer available as a package on OpenWhisk today, we need to set up a proxy application that will subscribe to an MQTT topic, and in turn invoke our OpenWhisk action on new messages.

### Start up an instance of the MQTT feed consumer as a Cloud Foundry app
* Download the [`cf` CLI](https://console.ng.bluemix.net/docs/cli/index.html#cli) and [connect to Bluemix](https://console.ng.bluemix.net/docs/cfapps/ee.html#ee_cf).
* Clone this repository, change to the `feeds/cf/mqtt` directory, update the `manifest.yml` file (provide a unique host and the name of the Cloudant service) and then use `cf push` to deploy it to Bluemix. Also, set this hostname in `local.env` as the `$CF_PROXY_HOST` value. For example, "openfridge-of".
* You can verify the app is deployed and ready by browsing to `http://$CF_PROXY_HOST.mybluemix.net/`.

## Next steps
After completing the steps here, proceed to [set up the OpenWhisk actions, triggers, and rules](OPENWHISK.md).
