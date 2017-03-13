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
  echo -e "${YELLOW}Installing OpenWhisk actions, triggers, and rules for OpenFridge..."

  echo "Binding the Cloudant package"
  wsk package bind /whisk.system/cloudant "$CLOUDANT_INSTANCE" \
    --param username "$CLOUDANT_USERNAME" \
    --param password "$CLOUDANT_PASSWORD" \
    --param host "$CLOUDANT_USERNAME.cloudant.com" || die

  echo "Creating the MQTT package and feed action"
  wsk package create \
    --param provider_endpoint "http://$CF_PROXY_HOST.mybluemix.net/mqtt" \
    mqtt || die
  wsk action create \
    --annotation feed true \
    mqtt/mqtt-feed-action actions/mqtt-feed-action.js || die

  echo "Creating triggers"
  wsk trigger create openfridge-feed-trigger \
    --feed mqtt/mqtt-feed-action \
    --param topic "$WATSON_TOPIC" \
    --param url "ssl://$WATSON_TEAM_ID.messaging.internetofthings.ibmcloud.com:8883" \
    --param username "$WATSON_USERNAME" \
    --param password "$WATSON_PASSWORD" \
    --param client "$WATSON_CLIENT" || die
  wsk trigger create service-trigger \
    --feed "$CLOUDANT_INSTANCE"/changes \
    --param dbname "$CLOUDANT_SERVICE_DATABASE" || die
  wsk trigger create order-trigger \
    --feed "$CLOUDANT_INSTANCE"/changes \
    --param dbname "$CLOUDANT_ORDER_DATABASE" || die
  wsk trigger create check-warranty-trigger \
    --feed /whisk.system/alarms/alarm \
    --param cron "$ALARM_CRON" \
    --param maxTriggers 100 || die

  echo "Creating actions"
  wsk action create analyze-service-event actions/analyze-service-event.js \
    --param CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    --param CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD" || die
  wsk action create create-order-event actions/create-order-event.js \
    --param CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    --param CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD" || die
  wsk action create check-warranty-renewal actions/check-warranty-renewal.js \
    --param CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    --param CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD" \
    --param CURRENT_NAMESPACE "$CURRENT_NAMESPACE" || die
  wsk action create alert-customer-event actions/alert-customer-event.js \
    --param CLOUDANT_USERNAME "$CLOUDANT_USERNAME" \
    --param CLOUDANT_PASSWORD "$CLOUDANT_PASSWORD" \
    --param SENDGRID_API_KEY "$SENDGRID_API_KEY" \
    --param SENDGRID_FROM_ADDRESS "$SENDGRID_FROM_ADDRESS" || die
  wsk action create service-sequence \
    --sequence /$CURRENT_NAMESPACE/$CLOUDANT_INSTANCE/read,create-order-event || die
  wsk action create order-sequence \
    --sequence /$CURRENT_NAMESPACE/$CLOUDANT_INSTANCE/read,alert-customer-event || die

  echo "Enabling rules"
  wsk rule create service-rule service-trigger service-sequence || die
  wsk rule create order-rule order-trigger order-sequence || die
  wsk rule create check-warranty-rule check-warranty-trigger check-warranty-renewal || die
  wsk rule create openfridge-feed-rule openfridge-feed-trigger analyze-service-event || die

  echo -e "${GREEN}Install Complete${NC}"
}

function uninstall() {
  echo -e "${RED}Uninstalling..."

  echo "Removing rules..."
  wsk rule disable openfridge-feed-rule || die
  wsk rule disable check-warranty-rule || die
  wsk rule disable order-rule || die
  wsk rule disable service-rule || die
  sleep 1
  wsk rule delete openfridge-feed-rule || die
  wsk rule delete check-warranty-rule || die
  wsk rule delete order-rule || die
  wsk rule delete service-rule || die

  echo "Removing triggers..."
  wsk trigger delete service-trigger || die
  wsk trigger delete order-trigger || die
  wsk trigger delete check-warranty-trigger || die
  wsk trigger delete openfridge-feed-trigger || die

  echo "Removing actions..."
  wsk action delete analyze-service-event || die
  wsk action delete create-order-event || die
  wsk action delete check-warranty-renewal || die
  wsk action delete alert-customer-event || die
  wsk action delete service-sequence || die
  wsk action delete order-sequence || die
  wsk action delete mqtt/mqtt-feed-action || die

  echo "Removing packages..."
  wsk package delete mqtt || die
  wsk package delete "$CLOUDANT_INSTANCE" || die

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
