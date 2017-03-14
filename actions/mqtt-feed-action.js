/**
 * Copyright 2016-2017 IBM Corp. All Rights Reserved.
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

var request = require('request');
var openwhisk = require('openwhisk');

/**
 * Users register new Feeds by providing a custom Action to the platform.
 * This Action is invoked each time the Feed is bound to a new Trigger.
 * Authentication credentials, supporting Trigger invocation through the
 * OpenWhisk API, are passed in as invocation parameters.
 */
function main(params) {
  return new Promise(function(resolve, reject) {
    if (params.lifecycleEvent === 'CREATE') {
      create(params);
    } else if (params.lifecycleEvent === 'DELETE') {
      remove(params);
    }
  });
}

function create(params) {
  console.log(params.triggerName);

  return new Promise(function(resolve, reject) {

    // These are the Watson IoT credentials, used for subscribing to the topic
    if (!params.hasOwnProperty('url') ||
      !params.hasOwnProperty('topic') ||
      !params.hasOwnProperty('username') ||
      !params.hasOwnProperty('password') ||
      !params.hasOwnProperty('client')
    ) {
      reject('Missing mandatory feed properties, must include url, topic, username, password, and client.');
    }

    // These are the OpenWhisk credentials, used for setting up the trigger
    var user_pass = params.authKey.split(':');

    // Send both the OpenWhisk credentials and the Watson IoT credentials, topic, and URL
    var body = {
      namespace: user_pass[0],
      trigger: params.triggerName.slice(3),
      url: params.url,
      topic: params.topic,
      openWhiskUsername: user_pass[0],
      openWhiskPassword: user_pass[1],
      watsonUsername: params.username,
      watsonPassword: params.password,
      watsonClientId: params.client
    };
    console.dir(body);
    request({
      method: "POST",
      uri: params.provider_endpoint,
      json: body
    }, handleResponse);
  });
}

function remove(params) {
  // These are the OpenWhisk credentials, used for setting up the trigger
  var user_pass = params.authKey.split(':');
  request({
    method: "DELETE",
    uri: params.provider_endpoint + '/' + user_pass[0] + '/' + params.triggerName.slice(3)
  }, handleResponse);

}

function handleResponse(err, res, body) {

  return new Promise(function(resolve, reject) {

    if (!err && res.statusCode === 200) {
      console.log('MQTT feed: HTTP request success.');
      resolve();
    } else if (res) {
      console.log('MQTT feed: Error invoking provider:', res.statusCode, body);
      reject(body.error);
    } else {
      console.log('MQTT feed: Error invoking provider:', err);
      reject(err);
    }

  });

}
