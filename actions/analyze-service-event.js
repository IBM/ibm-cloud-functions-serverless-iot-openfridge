var Cloudant = require('cloudant');

/**
 * 1. Receive the message from the queue. It should be the content of the message:
 *     {
 *         "appliance_serial": "aaaabbbbcccc",
 *         "part_number": "ddddeeeeffff",
 *         "reading": "15",
 *         "timestamp": 1466632598
 *     }
 * 
 * 2. Is the part reading value within a set of constraints? If so, ignore. Otherwise take action (insert into Cloudant).
 *
 * @param   params.body                 String representation of the JSON message from the topic
 * @param   params.CLOUDANT_USERNAME    Cloudant username (set once at action update time)
 * @param   params.CLOUDANT_PASSWORD    Cloudant password (set once at action update time)
 * @return                              Standard OpenWhisk success/error response
 */
function main(params) {
    
    // Read the MQTT inbound message JSON, removing newlines.
    var service = JSON.parse(params.body.replace(/\r?\n|\r/g, ''));

    // Configure database connection
    var cloudant = new Cloudant({
      account:  params.CLOUDANT_USERNAME,
      password: params.CLOUDANT_PASSWORD
    });
    var serviceDb = cloudant.db.use('service');

    // See if the reading is in some expected range (this simulates some analytics, such as a filter life being below 20%).
    if (parseInt(service.reading) < 20) {
        // If not, create a record in the service database.
        serviceDb.insert(
            {
                appliance_serial: service.appliance_serial,
                part_number: service.part_number,
                reading: service.reading,
                timestamp: service.timestamp
            }, function (err, body, head) {
              if (err) {
                console.log('[analyze-service-event.main] error: ');
                console.log(err);
                whisk.done({result: 'Error occurred logging service record.' });
              } else {
                console.log('[analyze-service-event.main] success: ');
                console.log(body);
                whisk.done({result: 'Success. Service record logged.' });
              }
            }
        );
    } else {
        whisk.done({result: 'No service needed.' });
    }

    return whisk.async();
}