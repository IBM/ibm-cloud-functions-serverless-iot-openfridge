/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const express = require('express');
const Cloudant = require('cloudant');
const FeedController = require('./lib/feed_controller.js');

// Setup express for handling HTTP requests
const app = express();
const bodyparser = require('body-parser');
app.use(bodyparser.json());

let creds = {};
// Extract Cloudant credentials from environment
if (process.env.VCAP_SERVICES) {
  const appEnv = require('cfenv').getAppEnv();
  creds = appEnv.getServiceCreds('cloudant-openfridge');
} else if (process.env.CLOUDANT_USERNAME && process.env.CLOUDANT_PASSWORD) {
  creds.username = process.env.CLOUDANT_USERNAME;
  creds.password = process.env.CLOUDANT_PASSWORD;
}

if (!creds.username || !creds.password) {
  console.error('Missing Cloudant credentials...');
  process.exit(1);
}

// Use the IP address of the Cloud Foundry DEA (Droplet Execution Agent) that hosts this application
var host = (process.env.VCAP_APP_HOST || 'localhost');

// Use the port on the DEA for communication with the application
var port = (process.env.VCAP_APP_PORT || 3000);

const cloudant = Cloudant({
  account: creds.username,
  password: creds.password
});
const feed_controller = new FeedController(cloudant.db.use('topic_listeners'), 'https://openwhisk.ng.bluemix.net/api/v1/');

feed_controller.initialise().then(() => {
  const handle_error = (err, message, res) => {
    console.log(message, err);
    res.status(500).json({
      error: message
    });
  };

  // Healthcheck endpoint
  app.get('/', function(req, res) {
    res.send('MQTT app up and ready.');
  });

  // Registers a trigger to call back on message, needs the OpenWhisk credentials to call the API
  app.post('/mqtt', function(req, res) {
    // trigger (namespace/name), url, topic, openWhiskUsername, openWhiskPassword, watsonUsername, watsonPassword, watsonClientId
    feed_controller.add_trigger(req.body).then(() => res.send())
      .catch(err => handle_error(err, 'Failed to add MQTT topic trigger', res));
  });

  // De-registers a trigger to call back
  app.delete('/mqtt/:namespace/:trigger', (req, res) => {
    feed_controller.remove_trigger(req.params.namespace, req.params.trigger).then(() => res.send())
      .catch(err => handle_error(err, 'Failed to remove MQTT topic trigger', res));
  });

  app.listen(port, host, function() {
    console.log('MQTT Trigger Provider listening on port ' + port);
  });
})
