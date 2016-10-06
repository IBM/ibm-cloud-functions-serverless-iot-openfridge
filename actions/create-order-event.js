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
    
    // Read the message from JSON.
    var service = {};
    var appliance = {};
    service.id = params.id;

    // Configure database connection
    var cloudant = new Cloudant({
      account:  params.CLOUDANT_USERNAME,
      password: params.CLOUDANT_PASSWORD
    });
    var serviceDb = cloudant.db.use('service');
    var applianceDb = cloudant.db.use('appliance');
    var orderDb = cloudant.db.use('order');

    // Find the service object insertion that fired the event by the given _id
    serviceDb.get(service.id, function (err, body, head) {
      if (err) {
        console.log('[create-order-event.main] error: serviceDb');
        console.log(err);
        whisk.done({result: 'Error occurred fetching service record.' });
      } else {
        console.log('[create-order-event.main] success: serviceDb');
        console.log(body);

        // Find the appliance object by the serial (which is its _id)
        applianceDb.get(body.appliance_serial, function (err, body, head) {
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

      }
    });

    return whisk.async();
}