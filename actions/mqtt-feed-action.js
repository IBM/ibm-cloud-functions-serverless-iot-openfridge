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

var request = require('request-promise');
var openwhisk = require('openwhisk');

/**
 * Users register new Feeds by providing a custom Action to the platform.
 * This Action is invoked each time the Feed is bound to a new Trigger.
 * Authentication credentials, supporting Trigger invocation through the
 * OpenWhisk API, are passed in as invocation parameters.
 */
function main(params) {
  if (params.lifecycleEvent === 'CREATE') {
    return validate(params)
      .then(params => create(params))
      .then(res => ({success: 'MQTT feed: Success creating trigger'}))
      .catch(err => ({ error: 'MQTT feed: Error invoking provider: ' + err }));
  } else if (params.lifecycleEvent === 'DELETE') {
    return remove(params)
      .then(res => ({success: 'MQTT feed: Success deleting trigger'}))
      .catch(err => ({ error: 'MQTT feed: Error invoking provider: ' + err }));
  }
}

function validate(params) {
  return new Promise(function(resolve, reject) {
    // These are the Watson IoT credentials, used for subscribing to the topic
    if (!params.hasOwnProperty('url') ||
      !params.hasOwnProperty('topic') ||
      !params.hasOwnProperty('username') ||
      !params.hasOwnProperty('password') ||
      !params.hasOwnProperty('client')
    ) {
      reject('Missing mandatory feed properties, must include url, topic, username, password, and client.');
    } else {
      // These are the OpenWhisk credentials, used for setting up the trigger
      var user_pass = params.authKey.split(':');

      // Send both the OpenWhisk credentials and the Watson IoT credentials, topic, and URL
      params.body = {
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
      resolve(params);
    }
  });
}

function create(params) {
  console.log(params.triggerName);
  return request({
    method: "POST",
    uri: params.provider_endpoint,
    json: params.body
  });
}

function remove(params) {
  // These are the OpenWhisk credentials, used for setting up the trigger
  var user_pass = params.authKey.split(':');
  return request({
    method: "DELETE",
    uri: params.provider_endpoint + '/' + user_pass[0] + '/' + params.triggerName.slice(3)
  });
}
