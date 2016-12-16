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
 * 1.   Fetches the customer object on service database changes trigger (which has the appliance_serial)
 * 2a.  If in warranty, create request in order database with status of 'ordered', which will invoke alert-customer-event to send the appropriate email.
 * 2b.  If not in warranty, create request in order database with status of 'pending', which will invoke alert-customer-event to send the appropriate email.
 *
 * @param   params.id                  The id of the record in the Cloudant 'service' database
 * @param   params.CLOUDANT_USERNAME   Cloudant username (set once at action update time)
 * @param   params.CLOUDANT_PASSWORD   Cloudant password (set once at action update time)
 * @return                             Standard OpenWhisk success/error response
 */
function main(params) {

    console.log(params);

    // Read the message from JSON.
    var service = {};
    var appliance = {};

    // Configure database connection
    var cloudant = new Cloudant({
      account:  params.CLOUDANT_USERNAME,
      password: params.CLOUDANT_PASSWORD
    });
    var applianceDb = cloudant.db.use('appliance');
    var orderDb = cloudant.db.use('order');

    // Find the appliance object by the serial (which is its _id)
    applianceDb.get(params.appliance_serial, function (err, body, head) {
      if (err) {
        console.log('[create-order-event.main] error: applianceDb');
        console.log(err);
        whisk.done({result: 'Error occurred fetching appliance record.' });
      } else {
        console.log('[create-order-event.main] success: applianceDb');
        console.log(body);
        appliance = body;

        // Insert the new order object with a status of automatically 'ordered' or 'pending' based on warranty status.
        var status = 'pending';
        if (appliance.warranty_expiration > Math.floor(Date.now() / 1000)) {
            status = 'ordered';
        }

        orderDb.insert(
            {
                owner_name: appliance.owner_name,
                owner_email: appliance.owner_email,
                owner_phone: appliance.owner_phone,
                appliance_serial: appliance.serial,
                appliance_warranty_expiration: appliance.warranty_expiration,
                part_number: appliance.part_number,
                status: status,
                timestamp: Date.now(),
                service_id: service._id
            },
            function (err, body, head) {
              if (err) {
                console.log('[analyze-service-event.main] error: orderDb');
                console.log(err);
                whisk.done({result: 'Error occurred entering order record.' });
              } else {
                console.log('[analyze-service-event.main] success: orderDb');
                console.log(body);
                whisk.done({result: 'Success. Order record inserted.' });
              }
            }
        );

      }
    });

    return whisk.async();
}
