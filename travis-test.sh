#!/bin/bash

##############################################################################
# Copyright 2017 IBM Corporation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
##############################################################################
set -e

echo "Configure local.env"
touch local.env  # Configurations defined in travis-ci console
source local.env # Otherwise for local testing

OPENWHISK_BIN=/home/ubuntu/bin
LINK=https://openwhisk.ng.bluemix.net/cli/go/download/linux/amd64/wsk

echo "Downloading OpenWhisk CLI from '$LINK'..."
curl -O $LINK
chmod u+x wsk
export PATH=$PATH:`pwd`

echo "Configuring CLI from apihost and API key"
wsk property set --apihost openwhisk.ng.bluemix.net --auth $OPENWHISK_KEY > /dev/null 2>&1

# echo "installing jq for bash json parsing"
# sudo apt-get install jq

echo "Cleanly deploying wsk actions, etc."
./deploy.sh --uninstall
./deploy.sh --install

echo "Waiting for triggers/actions to finish installing (sleep 5)"
sleep 5

# echo "Test workflow"
# sudo apt-get install curl mosquitto-clients

echo "Test 1: Ensure that the listener app is up"
curl -sL "http://openfridge-travis.mybluemix.net/" -o test-listener-result.txt
grep "ready" test-listener-result.txt

echo "Test 2: Unit test out of warranty appliance analysis"
wsk action invoke --blocking --result analyze-service-event \
--param body '{"appliance_serial": "xxxxyyyyzzzz", "part_number": "ddddeeeeffff", "reading": 15, "timestamp": 1484197200}'

echo "Test 3: Unit test in warranty appliance analysis"
wsk action invoke --blocking --result analyze-service-event \
--param body '{"appliance_serial": "aaaabbbbcccc", "part_number": "ddddeeeeffff", "reading": 14, "timestamp": 1484197200}'

echo "Test 4: Unit test whether any appliance is approaching warranty expiration"
wsk action invoke --blocking --result check-warranty-renewal

echo "Test 5: Unit test customer alert"
wsk action invoke --blocking --result alert-customer-event \
--param appliance '{"_id": "aaaabbbbcccc", "serial": "aaaabbbbcccc", "warranty_expiration": 1485838800, "owner_name": "Daniel Krook", "owner_email": "'${EMAIL}'", "owner_phone": "18885551212"}'

echo "Test 6: TODO: Find version with -C option. Subscribe the MQTT topic for device messages and log messages"
# mosquitto_sub -d -h "$WATSON_TEAM_ID.messaging.internetofthings.ibmcloud.com" -p 1883 \
# -i "$WATSON_CLIENT" -t "$WATSON_TOPIC" \
# -u "$WATSON_USERNAME" -P "$WATSON_PASSWORD" \
# -C 1 > one_message.txt

echo "Test 7: Send an MQTT message from one device simulator"
# mosquitto_pub -d -h "$WATSON_TEAM_ID.messaging.internetofthings.ibmcloud.com" -p 1883 \
# -i "$WATSON_DEVICE" -t "$WATSON_DEVICE_TOPIC" \
# -u "use-token-auth" -P "$WATSON_DEVICE_PASSWORD" \
# -m '{"appliance_serial": "aaaabbbbcccc", "part_number": "ddddeeeeffff", "reading": "10", "timestamp": 1489993200}'

echo "Test 8: TODO: Check that message was received"
# grep "appliance_serial" test-listener-result.txt

# echo "Verify actions were triggered"
# LAST_ACTIVATION=`wsk activation list | head -2 | tail -1 | awk '{ print $1 }'`

echo "Uninstalling wsk actions, etc."
./deploy.sh --uninstall
