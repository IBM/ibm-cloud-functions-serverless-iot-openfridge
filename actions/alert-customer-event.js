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
var request = require('request');

/**
 * 1. Triggered whenever data changes in the database (what about proactive warranty renewal alert?)
 * 2. Detect the type of event (order status change ['ordered', 'pending'], warranty renewal)
 *
 * @param   params.id                       The id of the record in the Cloudant 'service' database, if invoked by a database change
 * @param   params.appliance                The appliance object if invoked by the nightly alarm trigger
 * @param   params.CLOUDANT_USERNAME        Cloudant username (set once at action update time)
 * @param   params.CLOUDANT_PASSWORD        Cloudant password (set once at action update time)
 * @param   params.SENDGRID_API_KEY         SendGrid key for sending notifications
 * @param   params.SENDGRID_FROM_ADDRESS    Address to set as sender
 * @return                                  Standard OpenWhisk success/error response
 */
function main(params) {

  // Inspect the params sent to this action: Either invoked directly from check-warranty-renewal or via change to the 'order' database.
  console.log(params);

  // Configure database connection
  var cloudant = new Cloudant({
    account: params.CLOUDANT_USERNAME,
    password: params.CLOUDANT_PASSWORD
  });
  var orderDb = cloudant.db.use('order');

  if (params.hasOwnProperty('appliance')) {
    // Their warranty will expire soon.
    // Invoked manually by the check-warranty-renewal action.
    console.log('[alert-customer-event.main] invoked by check-warranty-renewal');
    var appliance = params.appliance;
    email = appliance.owner_email;
    subject = 'Warranty expires soon for ' + appliance.serial;
    content = 'Hello ' + appliance.owner_name + ', ';
    content += 'your appliance with serial number ' + appliance.serial + ' will expire on ' + format(appliance.warranty_expiration) + '. ';
    content += 'Contact a representative to renew your warranty.';
    send(email, subject, content);
  } else {
    // Triggered by a change event in the order database.
    var order = params;
    if (order.status == 'ordered') {
      // The order was automatically placed for them (in warranty).
      console.log('[alert-customer-event.main] triggered by a newly ordered order under warranty.');
      email = order.owner_email;
      subject = 'Part automatically ordered for appliance: ' + order.appliance_serial;
      content = 'Your appliance told us that one of its parts needed a replacement. Since it is still under warranty until ';
      content += format(order.appliance_warranty_expiration) + ', we have automatically ordered a replacement. ';
      content += 'It will be delivered soon.';
      send(email, subject, content);
    } else if (order.status == 'pending') {
      // The order was entered in pending mode (not in warranty).
      console.log('[alert-customer-event.main] triggered by a newly pending order out of warranty.');
      email = order.owner_email;
      subject = 'Part ready to order for appliance: ' + order.appliance_serial;
      content = 'Your appliance told us that one of its parts needed a replacement. Since it is no longer under warranty ';
      content += '(it expired on ' + format(order.appliance_warranty_expiration) + '), you will need to approve the pending order. ';
      content += 'Complete the form with your payment and the part will be on its way soon.';
      send(email, subject, content);
    } else {
      // Some other order status we're not implementing at the moment.
      console.log('[alert-customer-event.main] triggered by some other order status.');
      whisk.done({
        result: 'This workflow is not yet implemented.'
      });
    }
  }

  // Convert from Unix timestamp
  function format(timestamp) {
    var warranty_expiration_date = new Date(timestamp * 1000);
    return (warranty_expiration_date.getMonth() + 1) + '/' + warranty_expiration_date.getDate() + '/' + warranty_expiration_date.getFullYear();
  }

  // Configure SendGrid (need to use request against the API directly)
  function send(email, subject, content) {
    request({
      url: 'https://api.sendgrid.com/v3/mail/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + params.SENDGRID_API_KEY
      },
      body: '{"personalizations": [{"to": [{"email": "' + email + '"}]}],"from": {"email": "' + params.SENDGRID_FROM_ADDRESS + '"},"subject": "' + subject + '","content": [{"type": "text/plain", "value": "' + content + '"}]}'
    }, function(err, response, body) {
      if (err) {
        console.log('[alert-customer-event.main] error: ');
        console.log(err);
        whisk.done({
          result: 'Error sending customer alert.'
        });
      } else {
        console.log('[alert-customer-event.main] success: ');
        console.log(body);
        whisk.done({
          result: 'Success. Customer event sent.'
        });
      }
    });
  }

  return whisk.async();
}
