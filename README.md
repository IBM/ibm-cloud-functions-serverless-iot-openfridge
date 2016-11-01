# Project OpenFridge
This project provides a demo of serverless technology powered by OpenWhisk and used in the context of IoT. It highlights an edge-to-cloud scenario that integrates the Watson IoT platform, OpenWhisk, and Bluemix services to show an event-driven use case. It also demonstrates the programming models that enable this, and discusses the benefits relative to traditional cloud development approaches.

If you're just interested in the **[OpenWhisk package for Watson IoT MQTT](https://github.com/krook/openwhisk-package-mqtt-watson)** integration, you an find that in its own package repository.

[![Project OpenFridge](https://img.youtube.com/vi/0Sl4rWZYo8w/0.jpg)](https://www.youtube.com/watch?v=0Sl4rWZYo8w)

## Improving customer service with IoT and event-driven computing
The Internet of Things enables manufacturers and their customers to make more efficient use of hardware and devices by attaching them to a network. Software running on a device at the edge and paired with analytics in the cloud promise to improve the quality of service and to lower the cost of maintenance.

A manufacturer can proactively manage service events from appliances in a customer’s home. An edge device such as a refrigerator can report that it needs a part serviced (such as a water filter in need of replacement) and trigger actions or alerts (such as that the part was automatically ordered, depending on warranty status) with analytics logic powered by event-driven computing.

Event-driven computing using a "serverless" architecture is a compelling programming model for IoT, offering the following key benefits:
* __Speed to market__ – Event-driven programming enables rapid development and enforces modularity and flexibility which improves speed to market.
* __Simplified maintenance__ – The deployment unit of the serverless programming model is a single function. These can be deployed independently, and assembled or orchestrated using business logic implemented as triggers and rules.
* __Reduced cost__ – The event-driven cost model enables manufacturers to pay only for the time that business logic is actually running. Contrast this with the need to pay for applications or servers that are always on - even when not responding to customer requests - in a PaaS or IaaS model.
* __Automatic scale__ – A key benefit of event-driven computing is not having to predict demand, which is particularly important as devices continue to outnumber humans on the Internet. The number of instances of a function scales automatically in response to demand, rather than anticipating it.

The diagram below shows how a solution built on the Watson IoT platform and OpenWhisk can enable this connected home use case and gain the benefits of a serverless architecture.

![High level diagram](docs/overview.png)

## Primary workflow
A refrigerator periodically sends alerts to a cloud service indicating the status of its parts. It might send these only when certain threshold is breached (using edge analytics) or allow a cloud service to determine a normal range for the reading (cloud analytics).
```
{
    "appliance_serial": "aaaabbbbcccc",
    "part_number": "ddddeeeeffff",
    "reading": "15",
    "timestamp": 1466632598
}
```

[The JSON message](docs/sample-messages.txt) is received via a MQTT topic (Example: `iot-2/evt/refrigerator-simulator/fmt/json`) by the Watson IoT Platform service on Bluemix.

A Node.js Cloud Foundry application that is subscribed to events from the device types (Example: `iot-2/type/+/id/+/evt/+/fmt/json`) triggers OpenWhisk actions that have linked to it as a feed provider. (This bit reuses code from the [OpenWhisk and MQTT tutorial from James Thomas](http://jamesthom.as/blog/2016/06/15/openwhisk-and-mqtt/)).

![Primary workflow 1](docs/primary-workflow-1.png)

[An analytics action](actions/analyze-service-event.js) is triggered by the message from the Cloud Foundry app, and it analyzes the message, determining whether to take action on it. If, for example, the filter life reading parameter is lower than normal, it creates a new service record in Cloudant.

[An action](actions/create-order-event.js) is triggered by the service record creation to create an order record. It pulls the service record, and maps the appliance to the registered owner to check warranty. If the appliance is in warranty, it automatically creates an approved order for the part. If not, it creates an order that remains in a pending state.

[A notification action](actions/alert-customer-event.js) is triggered by the order record creation. If the appliance was in warranty, the action sends an email notifying the user that the part has already been ordered and will be delivered soon. Otherwise, it sends a note requiring the owner to complete the purchase of the part out of warranty.

![Primary workflow 2](docs/primary-workflow-2.png)

## Supplementary workflows
[An action](actions/alert-customer-event.js) is triggered nightly to look for pending warranty expirations (within the next 30 days) and send an alert to customers.

The [same action](actions/alert-customer-event.js) can be used to alert the customer each time an order state changes in the database (such as moving from ordered to shipped).

![Supplementary workflows](docs/supplementary-workflows.png)

## Bringing it all together
These workflows come together to provide an end to end proof of concept showing how you can improve customer service with IBM Bluemix and Watson services.

![Triggers and actions](docs/actions-triggers.png)

## Running the demo app
1. [Set up the Bluemix services (Cloudant, SendGrid, Watson IoT, and a Cloud Foundry app)](docs/BLUEMIX.md).
2. [Set up the OpenWhisk actions, triggers, and rules](docs/OPENWHISK.md).
