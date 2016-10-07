#!/bin/bash
#
# Copyright 2016 IBM Corp. All Rights Reserved.
# 
# Licensed under the Apache License, Version 2.0 (the “License”);
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#  https://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an “AS IS” BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Color vars to be used in shell script output
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'
 
# Load configuration variables
source local.env

# Capture the namespace where actions will be created
WSK=`locate /wsk`
CURRENT_NAMESPACE=`$WSK property get --namespace | sed -n -e 's/^whisk namespace//p' | tr -d '\t '`
echo "Current namespace is $CURRENT_NAMESPACE."

function usage() {
  echo -e "${YELLOW}Usage: $0 [--install,--uninstall,--env]${NC}"
}

function install() {    
  echo -e "${YELLOW}Installing OpenWhisk actions, triggers, and rules for OpenFridge..."
  
  echo "Binding the Cloudant package"
  $WSK package bind /whisk.system/cloudant cloudant-mqtt \
    -p username "$CLOUDANT_USERNAME" \
    -p password "$CLOUDANT_PASSWORD" \
    -p host "$CLOUDANT_USERNAME.cloudant.com"

  echo "Creating the MQTT package and feed action"
  $WSK package create -p provider_endpoint "http://$CF_PROXY_HOST.mybluemix.net/mqtt" mqtt
  $WSK action create -a feed true mqtt/mqtt-feed-action actions/mqtt-feed-action.js

  echo "Creating triggers"
  $WSK trigger create openfridge-feed-trigger \
    -f mqtt/mqtt-feed-action \
    -p topic "$WATSON_TOPIC" \
    -p url "ssl://$WATSON_TEAM_ID.messaging.internetofthings.ibmcloud.com:8883" \
    -p username "$WATSON_USERNAME" \
    -p password "$WATSON_PASSWORD" \
    -p client "$WATSON_CLIENT"
  $WSK trigger create service-trigger \
    -f cloudant-mqtt/changes \
    -p dbname "$CLOUDANT_SERVICE_DATABASE" \
    -p includeDocs true
  $WSK trigger create order-trigger \
    -f cloudant-mqtt/changes \
    -p dbname "$CLOUDANT_ORDER_DATABASE" \
    -p includeDocs true
  $WSK trigger create check-warranty-trigger \
    -f /whisk.system/alarms/alarm \
    -p cron "$ALARM_CRON" \
    -p maxTriggers 10

  echo "Creating actions"
  $WSK action create analyze-service-event actions/analyze-service-event.js \
    -p CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    -p CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD"
  $WSK action create create-order-event actions/create-order-event.js \
    -p CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    -p CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD"
  $WSK action create check-warranty-renewal actions/check-warranty-renewal.js \
    -p CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    -p CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD" \
    -p CURRENT_NAMESPACE "$CURRENT_NAMESPACE"
  $WSK action create alert-customer-event actions/alert-customer-event.js \
    -p CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    -p CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD" \
    -p SENDGRID_API_KEY "$SENDGRID_API_KEY" \
    -p SENDGRID_FROM_ADDRESS "$SENDGRID_FROM_ADDRESS"

  echo "Enabling rules"
  $WSK rule create --enable service-rule service-trigger create-order-event
  $WSK rule create --enable order-rule order-trigger alert-customer-event
  $WSK rule create --enable check-warranty-rule check-warranty-trigger check-warranty-renewal
  $WSK rule create --enable openfridge-feed-rule openfridge-feed-trigger analyze-service-event

  echo -e "${GREEN}Install Complete${NC}"
}

function uninstall() {  
  echo -e "${RED}Uninstalling..."

  echo "Removing rules..."
  $WSK rule disable openfridge-feed-rule
  $WSK rule disable check-warranty-rule
  $WSK rule disable order-rule
  $WSK rule disable service-rule
  sleep 1
  $WSK rule delete openfridge-feed-rule
  $WSK rule delete check-warranty-rule
  $WSK rule delete order-rule
  $WSK rule delete service-rule  
  
  echo "Removing actions..."
  $WSK action delete analyze-service-event
  $WSK action delete create-order-event
  $WSK action delete check-warranty-renewal
  $WSK action delete alert-customer-event
  $WSK action delete mqtt/mqtt-feed-action
  
  echo "Removing triggers..."
  $WSK trigger delete openfridge-feed-trigger
  $WSK trigger delete service-trigger
  $WSK trigger delete order-trigger
  $WSK trigger delete check-warranty-trigger
  
  echo "Removing packages..."
  $WSK package delete mqtt
  $WSK package delete cloudant-mqtt

  echo -e "${GREEN}Uninstall Complete${NC}"
}

function showenv() {
  echo -e "${YELLOW}"
  echo ORG="$ORG"
  echo SPACE="$SPACE"
  echo CLOUDANT_USERNAME="$CLOUDANT_USERNAME"
  echo CLOUDANT_PASSWORD="$CLOUDANT_PASSWORD"
  echo CLOUDANT_SERVICE_DATABASE="$CLOUDANT_SERVICE_DATABASE"
  echo CLOUDANT_ORDER_DATABASE="$CLOUDANT_ORDER_DATABASE"
  echo CLOUDANT_APPLIANCE_DATABASE="$CLOUDANT_APPLIANCE_DATABASE"
  echo WATSON_TEAM_ID="$WATSON_TEAM_ID"
  echo WATSON_TOPIC="$WATSON_TOPIC"
  echo WATSON_USERNAME="$WATSON_USERNAME"
  echo WATSON_PASSWORD="$WATSON_PASSWORD"
  echo WATSON_CLIENT="$WATSON_CLIENT"
  echo CF_PROXY_HOST="$CF_PROXY_HOST"
  echo SENDGRID_API_KEY="$SENDGRID_API_KEY"
  echo SENDGRID_FROM_ADDRESS="$SENDGRID_FROM_ADDRESS"
  echo ALARM_CRON="$ALARM_CRON"
  echo -e "${NC}"
}

case "$1" in
"--install" )
install
;;
"--uninstall" )
uninstall
;;
"--env" )
showenv
;;
* )
usage
;;
esac