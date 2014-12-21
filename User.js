'use strict';

module.exports = User;

// ***** USER *****
// data structure for storing user data
function User() {

  // direct DB fields (can be synced directly with DB)
	this.id = null; // int (4 bytes)
	this.password = null // varchar(16)

	this.phoneNumber = null; // varchar(16)
	this.isVerified = false;	// boolean
  this.lastOnlineAt = null;  // bigint

	this.lat = null;
	this.lon = null;
	this.acc = null;
	this.gpsFixAt = null;

  this.vCodeHttp = null;
  this.vCodeHttpReceivedAt = null;
  this.vCodeSms = null;
  this.vCodeSmsReceivedAt = null;
  this.smsPhoneNumber = null;  
  this.hasVerificationSucceeded=false;

  this.lastOnlineAt_timestamp = -1;
	this.phoneNumber_timestamp = -1;
	this.isVerified_timestamp = -1;
	this.gps_timestamp = -1;  

	this.lastUpdate_timestamp = -1;

  // virtual DB fields (need to be generated from DB with an adapter)
  this.edges = [];
  this.edges_idHash = {};
}
/*
User.prototype.attemptVerify(timestamp){
  if (this.vCodeHttp !== null && this.vCodeSms !== null && 
    this.vCodeHttpReceivedAt!==null && this.vCodeSmsReceivedAt!==null &&
    this.smsPhoneNumber!==null &&
    this.vCodeHttp===this.vCodeSms &&
    Math.abs(this.vCodeHttpReceivedAt-this.vCodeSmsReceivedAt)<(1000*60*10) ){ // time < 10 mins

    // reset verification fields (not strictly needed)
    this.vCodeHttp=null;
    this.vCodeSms=null;
    this.vCodeSmsReceivedAt=null;
    this.vCodeHttpReceivedAt=null;

    // update verification fields
    this.isVerified=true;
    this.isVerified_timestamp=timestamp;

    this.hasVerificationSucceeded=true; // signal send message back to client

    if (this.phoneNumber!==this.smsPhoneNumber){      
      user.phoneNumber = this.smsPhoneNumber
      user.phoneNumber_timestamp = timestamp;
    }
  }

}*/