#!/bin/bash
#
# Copyright 2016-2017 IBM Corp. All Rights Reserved.
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

function usage() {
  echo -e "${YELLOW}Usage: $0 [--install,--uninstall,--env]${NC}"
}

function install() {
  # Exit if any command fails
  set -e

  echo -e "${YELLOW}Installing OpenWhisk actions, triggers, and rules for OpenFridge..."

  echo "Binding the Cloudant package"
  wsk package bind /whisk.system/cloudant "$CLOUDANT_INSTANCE" \
    --param username "$CLOUDANT_USERNAME" \
    --param password "$CLOUDANT_PASSWORD" \
    --param host "$CLOUDANT_USERNAME.cloudant.com"

  echo "Creating the MQTT package and feed action"
  wsk package create \
    --param provider_endpoint "http://$CF_PROXY_HOST.mybluemix.net/mqtt" \
    mqtt
  wsk action create \
    --annotation feed true \
    mqtt/mqtt-feed-action actions/mqtt-feed-action.js

  echo "Creating triggers"
  wsk trigger create openfridge-feed-trigger \
    --feed mqtt/mqtt-feed-action \
    --param topic "$WATSON_TOPIC" \
    --param url "ssl://$WATSON_TEAM_ID.messaging.internetofthings.ibmcloud.com:8883" \
    --param username "$WATSON_USERNAME" \
    --param password "$WATSON_PASSWORD" \
    --param client "$WATSON_CLIENT"
  wsk trigger create service-trigger \
    --feed "$CLOUDANT_INSTANCE"/changes \
    --param dbname "$CLOUDANT_SERVICE_DATABASE"
  wsk trigger create order-trigger \
    --feed "$CLOUDANT_INSTANCE"/changes \
    --param dbname "$CLOUDANT_ORDER_DATABASE"
  wsk trigger create check-warranty-trigger \
    --feed /whisk.system/alarms/alarm \
    --param cron "$ALARM_CRON" \
    --param maxTriggers 100

  echo "Creating actions"
  wsk action create analyze-service-event actions/analyze-service-event.js \
    --param CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    --param CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD"
  wsk action create create-order-event actions/create-order-event.js \
    --param CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    --param CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD"
  wsk action create check-warranty-renewal actions/check-warranty-renewal.js \
    --param CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    --param CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD"
  wsk action create alert-customer-event actions/alert-customer-event.js \
    --param SENDGRID_API_KEY "$SENDGRID_API_KEY" \
    --param SENDGRID_FROM_ADDRESS "$SENDGRID_FROM_ADDRESS"
  wsk action create service-sequence \
    --sequence /_/$CLOUDANT_INSTANCE/read,create-order-event
  wsk action create order-sequence \
    --sequence /_/$CLOUDANT_INSTANCE/read,alert-customer-event

  echo "Enabling rules"
  wsk rule create service-rule service-trigger service-sequence
  wsk rule create order-rule order-trigger order-sequence
  wsk rule create check-warranty-rule check-warranty-trigger check-warranty-renewal
  wsk rule create openfridge-feed-rule openfridge-feed-trigger analyze-service-event

  echo -e "${GREEN}Install Complete${NC}"
}

function uninstall() {
  echo -e "${RED}Uninstalling..."

  echo "Removing rules..."
  wsk rule disable openfridge-feed-rule
  wsk rule disable check-warranty-rule
  wsk rule disable order-rule
  wsk rule disable service-rule
  sleep 1
  wsk rule delete openfridge-feed-rule
  wsk rule delete check-warranty-rule
  wsk rule delete order-rule
  wsk rule delete service-rule

  echo "Removing triggers..."
  wsk trigger delete service-trigger
  wsk trigger delete order-trigger
  wsk trigger delete check-warranty-trigger
  wsk trigger delete openfridge-feed-trigger

  echo "Removing actions..."
  wsk action delete analyze-service-event
  wsk action delete create-order-event
  wsk action delete check-warranty-renewal
  wsk action delete alert-customer-event
  wsk action delete service-sequence
  wsk action delete order-sequence
  wsk action delete mqtt/mqtt-feed-action

  echo "Removing packages..."
  wsk package delete mqtt
  wsk package delete "$CLOUDANT_INSTANCE"

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
