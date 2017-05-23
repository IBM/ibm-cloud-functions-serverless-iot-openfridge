### Install Mosquitto for your workstation and add devices

- Download the [Eclipse Mosquitto](https://mosquitto.org/download/) CLI for your operating system.
- Ensure that you've updated the properties file for your Watson IoT configuration in `local.env`.

### Connect to IoT Platform and post a message

- First, create the consuming application connection to receive messages from all devices. Open a terminal window and subscribe to the `iot-2/type/+/id/+/evt/+/fmt/json` topic. Note that this queue format is different from the ones the devices post to because it contains wildcards. Update the topic in `local.env` file to match.

  ```bash
  source local.env
  mosquitto_sub -d -h "$WATSON_TEAM_ID.messaging.internetofthings.ibmcloud.com" -p 1883 \
  -i "$WATSON_CLIENT" -t "$WATSON_TOPIC" \
  -u "$WATSON_USERNAME" -P "$WATSON_PASSWORD"
  ```

- Now, open another terminal window and publish a test message onto the Device Type topic. You can find [sample messages for 3 devices here](sample-messages.txt). Enter the sample JSON, making sure the Serial matches your Device.
- Set the `DEVICE_ID` environment variable to `d:$WATSON_TEAM_ID:refrigerator-simulator:$DEVICE_1_ID` (replacing `$DEVICE_1_ID` with the value you set in the previous section. This value doesn't have to be added to `local.env`).
- Set the `DEVICE_PASSWORD` environment variable to the password or token for that device id. This value doesn't have to be added to `local.env`).

  ```bash
  source local.env
  export DEVICE_ID=d:$WATSON_TEAM_ID:refrigerator-simulator:1
  export DEVICE_PASSWORD=""
  mosquitto_pub -d -h "$WATSON_TEAM_ID.messaging.internetofthings.ibmcloud.com" -p 1883 \
  -i "$DEVICE_1_ID" -t "iot-2/evt/refrigerator-simulator/fmt/json" \
  -u "use-token-auth" -P "$DEVICE_1_PASSWORD" \
  -m '{"appliance_serial": "aaaabbbbcccc", "part_number": "ddddeeeeffff", "reading": "15", "timestamp": 1466632598}'
  ```

- Look back in the original terminal window for the subscribing application, and you should see the message has been received.
