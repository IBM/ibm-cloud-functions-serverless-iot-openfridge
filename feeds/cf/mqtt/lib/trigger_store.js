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

const Promise = require('bluebird');

class TriggerStore {
    constructor (db) {
        this.db = db;
    }

    add (trigger) {
        const _insert = Promise.promisify(this.db.insert, {context: this.db});
        return _insert(trigger, trigger.namespace + '/' + trigger.trigger);
    }

    remove (id) {
        const _get = Promise.promisify(this.db.get, {context: this.db});
        const _destroy = Promise.promisify(this.db.destroy, {context: this.db});
        return _get(id).then(doc => _destroy(doc._id, doc._rev));
    }

    triggers (url, topic) {
        // Let's just ignore the topic for now (because publish and subscribe topics don't match exactly, as one has wildcards).
        // const key = topic ? `${url}#${topic}` : url
        const key = url;
        topic = false;

        const _view = Promise.promisify(this.db.view, {context: this.db});
        const extract_triggers = body => body.rows.map(row => row.value);
        return _view('subscriptions', topic ? 'host_topic_triggers' : 'host_triggers', {startkey: key, endkey: key}).then(extract_triggers);
    }

    subscribers () {
        const _view = Promise.promisify(this.db.view, {context: this.db});
        const extract_subscribers = body => body.rows.map(row => {
          return {trigger: row.key, topic: row.value};
        })
        return _view('subscriptions', 'all').then(extract_subscribers);
    }
}

module.exports = TriggerStore;
