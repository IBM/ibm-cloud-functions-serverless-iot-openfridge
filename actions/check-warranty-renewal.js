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

var Cloudant = require('cloudant');

/**
 * 1. Set up by a nightly alarm to proactively alert the user to warranty expiration in the next 30 days.
 * 2. Check to see if the appliance warranty will expire in the next 30 days. If so, send an email.
 *
 * @param   params.CLOUDANT_USERNAME   Cloudant username (set once at action update time)
 * @param   params.CLOUDANT_PASSWORD   Cloudant password (set once at action update time)
 * @param   params.CURRENT_NAMESPACE   The current namespace so we can call the notification action by name 
 * @return                             Standard OpenWhisk success/error response
 */
function main(params) {

    // Configure database connection
    console.log(params);
    var cloudant = new Cloudant({
      account:  params.CLOUDANT_USERNAME,
      password: params.CLOUDANT_PASSWORD
    });
    var applianceDb = cloudant.db.use('appliance');

    // We could optimize this by using an index to get only the docs with the right timestamp range, and email in parallel, but this is just for simplicity.
    applianceDb.list({include_docs: true}, function (err, body, head) {
      if (err) {
        console.log('[check-warranty-renewal.main] error: ');
        console.log(err);
        whisk.done({result: 'Error occurred fetching appliance record.' });
      } else {
        console.log('[check-warranty-renewal.main] success: ');
        body.rows.forEach(function(doc) {
            console.log(doc);
            var appliance = doc.doc;
            // If the expiration is less than 30 days from now, send an email.
            console.log(appliance.warranty_expiration);
            if ((appliance.warranty_expiration - Math.floor(Date.now() / 1000)) < 60 * 60 * 24 * 30) {
                console.log('[check-warranty-renewal.main] success: Warranty expires in less than 30 days.');
                whisk.invoke({'name': '/' + params.CURRENT_NAMESPACE + '/alert-customer-event', 'parameters': { "appliance": appliance } });
            } else {
                console.log('[check-warranty-renewal.main] success: Warranty is still quite valid.');
            }
        });
        whisk.done({result: 'Success. Appliance records fetched.' });
      }
    });

    return whisk.async();
}