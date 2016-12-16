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

const mqtt = require('mqtt');
const openwhisk = require('openwhisk');
const MQTTSubscriptionMgr = require('./mqtt_subscription_mgr.js');
const TriggerStore = require('./trigger_store.js');

class FeedController {
    constructor (db, ow_endpoint) {
        this.mqtt_subscription_mgr = new MQTTSubscriptionMgr(mqtt);
        this.trigger_store = new TriggerStore(db);
        this.ow_endpoint = ow_endpoint;
    }

    initialise () {
        const mgr = this.mqtt_subscription_mgr;
        mgr.on('message', (url, topic, message) => this.on_message(url, topic, message));
        mgr.on('connected', url => this.on_conn_status('connected', url));
        mgr.on('disconnected', url => this.on_conn_status('disconnected', url));

        console.log(`Subscribing on start in initialise()`);
        return this.trigger_store.subscribers().then(subscribers => {
            subscribers.forEach(s => mgr.subscribe.apply(mgr, [s.url, s.topic, s.username, s.password, s.clientId]));
        }).catch(err => {
            console.error('Error initialising subscribers from CouchDB store.' , err);
            return Promise.reject('Unable to initialise due to store failure.');
        });
    }

    on_conn_status (status, url) {
        const params = {type: 'status', body: status};
        this.trigger_store.triggers(url).then(triggers => {
           triggers.forEach(trigger => this.fire_trigger(trigger, params));
        }).catch(err => console.error('Unable to forward connection status to triggers.', err))
    }

    on_message (url, topic, message) {
        console.log(`Message received (${url}) #${topic}: ${message}`);
        const params = {type: 'message', body: message};
        this.trigger_store.triggers(url, topic).then(triggers => {
            triggers.forEach(trigger => this.fire_trigger(trigger, params));
        }).catch(err => console.error('Unable to forward message to triggers.', err))
    }

    fire_trigger (trigger, params) {
        const namespace = '_';
        const name = (trigger.trigger.indexOf('/') !== -1 ) ? trigger.trigger.split('/')[1] : trigger.trigger;
        console.log(`Firing trigger: /${namespace}/${name}`, params);
        var ow = openwhisk({api: this.ow_endpoint, api_key: `${trigger.openWhiskUsername}:${trigger.openWhiskPassword}`, namespace: namespace});
        ow.triggers.invoke({triggerName: name, params: params})
          .catch(err => console.error(`Failed to fire trigger /${namespace}/${name}`, err, ow))
    }

    // trigger: trigger (namespace/name), url, topic, openWhiskUsername, openWhiskPassword, watsonUsername, watsonPassword, watsonClientId
    add_trigger (trigger) {
        const mgr = this.mqtt_subscription_mgr;
        return this.trigger_store.add(trigger).then(() => {
            mgr.subscribe(trigger.url, trigger.topic, trigger.watsonUsername, trigger.watsonPassword, trigger.watsonClientId);
            if (mgr.is_connected(trigger.url)) {
               const params = {type: 'status', body: 'connected'};
               this.fire_trigger(trigger, params);
            }
        })
    }

    remove_trigger (namespace, trigger) {
        const mgr = this.mqtt_subscription_mgr;
        return this.trigger_store.remove(`${namespace}/${trigger}`).then(() => mgr.unsubscribe(trigger.url, trigger.topic));
    }
}

module.exports = FeedController
