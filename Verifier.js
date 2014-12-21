'use strict';

var db = require('./db');
var User = require('./User');

module.exports = Verifier;

function Verifier(timeManager, logger){
	this.timeManager = timeManager;
	this.logger = logger;
}

// req should be in normal form (non JSON parsed)
Verifier.prototype.verify = function(req,resp){
	var logger = this.logger;
	var timeManager = this.timeManager;

	if (req.hasOwnProperty("query")){
	    var q = req.query;

	    logger.log("Text received from  " + q.msisdn + " : " + q.text );

	    if ( q.hasOwnProperty("msisdn") && q.hasOwnProperty("text") ){
	      	var textSplit = q["text"].split("&");
	      	var msisdn = q["msisdn"];

	      	if (textSplit.length === 2){
		        var id = textSplit[0];
		        var vCode = textSplit[1];
		        logger.log("Extracted id=" + id + " vCode=" + vCode);

		        var millis = Date.now();
		        var user = new User();
		        user.id = id;
		        user.vCodeSms=vCode;
		        user.vCodeSmsReceivedAt=millis;
		        user.smsPhoneNumber=msisdn;

		        timeManager.nextTimestamp(function(now){ // grab the next write timestamp
			    	// update sms verification params
			    	timeManager.setWritingTimestamp(now);
			    	db.query("UPDATE bbz_users set "+
	    				"v_code_sms=$1, "+
	    				"v_code_sms_received_at=$2, "+
	    				"sms_phone_number=$3 "+
	    				"where user_id=$4;",
	    				[user.vCodeSms,
	    				user.vCodeSmsReceivedAt,
	    				user.smsPhoneNumber,
						user.id],
	    				function(err, result){					    	
	    					// now try verifying (don't need new timestamp)
	    					// 'true' means auto-sethasVerificationSucceeded=true if verified
	    					db.query("SELECT * from verify($1,$2,true);",[user.id,now], function(err, result){
	    						timeManager.forgetWritingTimestamp(now);
	    						if (result['has_changed_phone_number']){
								    db.query("SELECT * FROM on_phone_changed($1);",[user.id], 
							            function(err,result){
							            	// error handling
							        });
	    						}
	    					});
	    				});
			    });

		    } else {
		        logger.log("Verification failed: invalid SMS params");
		    }
	    } else {
	      logger.log("Verification failed: invalid GET params");
	    }

	}

	// send success
 	resp.writeHead(200, {"Content-Type": "text/html"});
  	resp.end();
}