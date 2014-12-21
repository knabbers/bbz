'use strict';

var TimeManager = require('./TimeManager');
var User = require('./User');
var db = require('./db');
var crypto = require('crypto');

module.exports = Updater;

// *** UPDATER ***
// deals with requests and responses
// updates a given userManager
function Updater(timeManager, logger){
	this.logger = logger;
  this.timeManager = timeManager;
}


// req.body must be a normal JS object (achieved using JSON body parser)
Updater.prototype.update = function(req, resp){
  var updaterSelf = this;
  var timeManager = this.timeManager;

  var logger = this.logger;

  var q = req.body;
  console.log(q);

  var user = new User();

  var isNewUser=false;
  var isInitRequest=false;
  var hasPhoneNumberChanged=false;

  // fetch data with respect to the most recent safe timestamp
  var nextUserUpdateTimestamp; // client will be up to date with everything including this value


  if (q.hasOwnProperty("isInitRequest"))
    isInitRequest = q["isInitRequest"];

  var millis = Date.now();

  logIn();

  // attempt to fetch client data
  function logIn(){
    var next = updateUser;
    if (q.hasOwnProperty("id") && q.hasOwnProperty("password")){
      console.log("Credentials provided - attempting to log in...");
      db.query("SELECT * FROM bbz_users WHERE user_id=$1 AND password=$2;", [q["id"], q["password"]], cb);
    } else if (!q.hasOwnProperty("id") && !q.hasOwnProperty("password")){
      isNewUser = true;
      console.log("Creating new user and attempting to log in...");
      // create password
      crypto.randomBytes(8, function(ex, buf){
        if (ex)
          return console.error('Error generating password');
        var pw = buf.toString('hex');
        db.query("INSERT INTO bbz_users (password) VALUES ($1) RETURNING *;", [pw],cb);
      });
    } else {
      return console.error("partial credentials provided");
    }
    // callback to process client data
    function cb(err,result){     
      if (err)
        return console.error(err);
      if (result.rows.length===1){
        var row = result.rows[0];
        // load user (including newly generated id & password if new user)
        copyDataIntoUser(user,row);
        console.log("User " + user.id +" Logged in. (User data if not hidden:)");        
        //console.log(row);
        next();
      } else if (result.rows.length==0){
        return console.error('Login error: invalid credentials');
      } else {
        return console.error('Login error: ambiguous credentials - what!?');
      }
    }
  }

  function updateUser(){
    var next = verify;
    //console.log("stage: updateUser(). user is");    
    console.log("Grabbing timestamp for user update...");
    timeManager.nextTimestamp(function(now){ // grab the next write timestamp      
    console.log("Grabbing timestamp for user update... now=" + now);
      // gps params
      if (!isNaN(q["lat"]) && !isNaN(q["lon"]) &&
        !isNaN(q["acc"]) && !isNaN(q["gpsAge"])){

        user.lat = q["lat"];
        user.lon = q["lon"];
        user.acc = q["acc"];
        user.gpsFixAt = millis - q["gpsAge"];
        user.gps_timestamp = now;
      }

      // phone number
      if (q.hasOwnProperty("phoneNumber")){
        user.isPhoneNumberVerified=false;
        user.isPhoneNumberVerified_timestamp=now;
        user.phoneNumber = q['phoneNumber'];
        user.phoneNumber_timestamp = now;
        hasPhoneNumberChanged=true;
      }
      // store verification params
      if (q.hasOwnProperty('vCode')){
        user.vCodeHttp = q['vCode'];
        user.vCodeHttpReceivedAt = millis;
      }

      // last online
      user.lastOnlineAt = millis;
      user.lastOnlineAt_timestamp = now;

      // need to compute this before we update user row
      nextUserUpdateTimestamp = timeManager.getSafeReadTimestamp();
      if (isNaN(nextUserUpdateTimestamp))
        return console.error("Error: Problem getting next read timestamp.");

      timeManager.setWritingTimestamp(now);
      console.log("User " + user.id + " Updating user...");
      db.query("UPDATE bbz_users SET "+
        "phone_number=$1, "+
        "last_online_at=$2, "+
        "lat=$3, "+
        "lon=$4, "+
        "acc=$5, "+
        "gps_fix_at=$6, "+
        "v_code_http=$7, "+
        "v_code_http_received_at=$8, "+
        "has_verification_succeeded=false, "+
        "last_online_at_timestamp=$9, "+
        "phone_number_timestamp=$10, "+
        "gps_timestamp=$11, "+
        "last_update_timestamp=$12 "+
        "WHERE user_id=$13;",
        [user.phoneNumber
        ,user.lastOnlineAt
        ,user.lat
        ,user.lon
        ,user.acc
        ,user.gpsFixAt
        ,user.vCodeHttp
        ,user.vCodeHttpReceivedAt
        ,user.lastOnlineAt_timestamp
        ,user.phoneNumber_timestamp
        ,user.gps_timestamp
        ,nextUserUpdateTimestamp
        ,user.id], 
        function(err, result){          
          timeManager.forgetWritingTimestamp(now);
          console.log("User " + user.id + " Updating user...done.");
          if (err) return console.error("User " + user.id + "Update user: " + err);
          next();
        });
    });
  }

  // attempt to verify user
  // determine if verified
  // determine if phone number changed
  // note: this could be done as part of the above (with fewer queries, but would need single transaction - more complicated)
  function verify(){
    var next = processPhoneNumberChanged;
    // if client has attemped to verify
    if (q.hasOwnProperty('vCode')){
      console.log("User " + user.id + " Attempting to verify user...");
      timeManager.nextTimestamp(function(now){
        timeManager.setWritingTimestamp(now);
        db.query("SELECT * from verify($1,$2,false);",[user.id,now],function(err,result){       
          var row = result.rows[0];             
          console.log("User " + user.id + " Attempting to verify user... has_verified:"+row['has_verified'] + " changed_number:"+row['has_changed_phone_number']);
          if (row['has_verified'])
            user.hasVerificationSucceeded=true; // just a message to send back to http client
          if (row['has_changed_phone_number'])
            hasPhoneNumberChanged=true;          
          timeManager.forgetWritingTimestamp(now);
          next();
        });
      });
    } else {
      next();
    }
  }

  // if user's phone number has just been changed,
  // reset connections to all friends (sending friend request) 
  function processPhoneNumberChanged(){   
    var next = processContactsPhoneNumbers;   
    if (hasPhoneNumberChanged){
      console.log("User " + user.id + " Resetting connections...");
      db.query("SELECT * FROM on_phone_changed($1);",[user.id], function(err,result){
          console.log("User " + user.id + " Resetting connections...done.");
          next();
        });
    } else {
      next();
    }
  }

  // if client has given phone numbers, create new edges
  // this is the only place where edges are created
  function processContactsPhoneNumbers(){    
    var next = updatePermsInitRequest;
    if (Array.isArray(q["contactsPhoneNumbers"])){
      // find all user ids with the given phone numbers
      // for each contact found, send a friend request.
      console.log("User " + user.id + " Adding phone numbers...");
      db.query("SELECT * FROM phone($1,$2);", [user.id,"{"+q["contactsPhoneNumbers"].join(",")+"}"], function(err, result){  
      console.log("User " + user.id + " Adding phone numbers...done.");   
        next();
      });      
    } else {
      next();
    }
  }

  // process isInitRequest (block all that are tracking, maybe block from their side as well?)
  function updatePermsInitRequest(){ 
    var next = updatePermsAllows;   
    if (isInitRequest===true){ // block all          
      console.log("User " + user.id + " Init request blocking...");
      db.query("UPDATE bbz_perms set perm=3, perm_dirty_me=true, perm_dirty_them=true where me=$1 and perm=4;",[user.id],function(err, result){  
      console.log("User " + user.id + " Init request blocking...done.");
        next();
      });      
    } else {
      next();
    }
  }
  // process allows
  function updatePermsAllows(){
    var next = updatePermsBlocks;  
    if (Array.isArray(q["allows"])){ // change permission of each friended id in allows to allow    
      console.log("User " + user.id + " Setting allows...");
      db.query("UPDATE bbz_perms set perm=4, perm_dirty_me=true, perm_dirty_them=true where me=$1 and them=ANY($2) and perm>=2;",[user.id,"{"+q["allows"].join(",")+"}"], function(err, result){
        console.log("User " + user.id + " Setting allows...done.");
        next();
      });
    } else {
      next();
    }
  }
  // process blocks
  function updatePermsBlocks(){
    var next = buildResponse;
    if (Array.isArray(q["blocks"])){ // change permission of each friended id in allows to block    
      console.log("User " + user.id + " Setting blocks...");  
      db.query("UPDATE bbz_perms set perm=3, perm_dirty_me=true, perm_dirty_them=true where me=$1 and them=ANY($2) and perm>=2;",[user.id,"{"+q["blocks"].join(",")+"}"], function(err, result){
        console.log("User " + user.id + " Setting blocks...done.");
        next();
      });
    } else {
      next();
    }
  }


  // *** generate response ***
  // at end to send any db error back to client
  // response is: (generated in order)

  // new user: id, password

  // isInitRequestAcknowledged

  // hasVerificationSucceeded
  // phoneNumber

  // user updates
  // allows/blocks
  // checkPhoneNumbers
  // forgets

  // errors

  function buildResponse(){
    console.log("User " + user.id + " Building response..."); 
    var r = {};

    // fetch data with respect to the most recent safe timestamp
    var last = user.lastUpdate_timestamp; // client is currently up to date with everything up to and including this value
    var now = nextUserUpdateTimestamp; // will be up to date with everything up to and including this value

    var updated = function(timestamp){
      if (isNaN(timestamp)) {
        console.log("timestamp NaN."); 
        return false;
      }
      return timestamp>last && timestamp<=now;
    }

    if (isNewUser===true){
      r["id"] = user.id;
      r["password"] = user.password;
    }

    if (isInitRequest){
      r["isInitRequestAcknowledged"] = true;
    }

    if (user.hasVerificationSucceeded){
      r["hasVerificationSucceeded"] = user.hasVerificationSucceeded;
      r["phoneNumber"] = user.phoneNumber;
      user.hasVerificationSucceeded=false; // note: this isn't needed, as it is set to db in updateUser
    }


    // *** LOAD FRIEND DATA ***

    r["users"] = [];
    r["checkPhoneNumbers"] = [];
    r["allows"] = [];
    r["blocks"] = [];
    r["forgets"] = [];

    // friends returns:
    db.query("SELECT * FROM friends($1);",[user.id],cb);

    function cb(err, result){
      result.rows.forEach(function(f){
        // if friends
        if (f['me_perm']>=2 && f['them_perm']>=2){
          var rs = {};
          var empty=true;

          // forced if we haven't been recently syncing FRIEND data
          // (if we have only just become friends, or, if the user has only just logged on)
          // (we should send everything the user would have known on the last time it logged on)
          // dirty is with respect to the current user (and doesn't correspond to any other user's dirty)
          var forced = (f['me_perm_dirty'] && f['me_perm']==2) || 
                       (f['them_perm_dirty'] && f['them_perm']==2) || isInitRequest;
          if (forced)
            console.log("User " + user.id + " new friend sync to user "+ f['user_id']);
          // friends data
          if ( (updated(f['last_online_at_timestamp']) || forced) && f['last_online_at']!==null) {
            rs["onlineAge"] = millis - f['last_online_at'];
            empty=false;
          }
          if (updated(f['phone_number_timestamp']) || forced){
            rs["phoneNumber"] = f['phone_number'];
            empty=false;
          }
          if (updated(f['is_verified_timestamp']) || forced){
            rs["isPhoneNumberVerified"] = f['is_verified'];
            empty=false;
          }

          // if tracking
          if (f['me_perm']==4 && f['them_perm']==4){
            var forced = f['me_perm_dirty'] || 
                         f['them_perm_dirty'] || isInitRequest;              
            if (forced)
              console.log("User " + user.id + " new tracking sync to user "+ f['user_id']);
            // tracking data
            // if permission has CHANGED to 3, (or gps has changed)
            if ( (updated(f['gps_timestamp']) || forced) &&
              f['lat']!==null && f['lon']!==null &&
              f['acc']!==null && f['gpsFixAt']!==null){
              rs["lat"] = f['lat']
              rs["lon"] = f['lon']
              rs["acc"] = f['acc']
              rs["gpsAge"] = millis - f['gpsFixAt'];
              empty=false;
            }
          }
          // if any data in rs, send it
          if (!empty){
            // id
            rs["id"]=f['user_id'];
            r["users"].push(rs);
          }
        }

        // forgets
        // if my permission has been moved down to 1 (other user changed phone number)
        if (f['me_perm_dirty'] && f['me_perm']==1)
          r['forgets'].push(f['user_id']);

        if (f['them_perm_dirty'] || isInitRequest){
          if (f['them_perm']==2 && f['me_perm']<2 && f['phone_number']!=null) // them friended me
            r['checkPhoneNumbers'].push(f['phone_number']);
          else if (f['them_perm']==3) // them blocked me
            r['blocks'].push(f['user_id']);
          else if (f['them_perm']==4) // them allowed me
            r['allows'].push(f['user_id']);
        }

      });
    
      console.log("User " + user.id + " Building response...done."); 
      
      resp.writeHead(200, { 'Content-Type' : 'application/json' });
      resp.write( JSON.stringify(r) );
      resp.end();      
    console.log("User " + user.id + " Response sent.");  
    }
  }
};





function copyDataIntoUser(user, data){
  if (!(user instanceof User))
    return console.error("user not user!");

  if (data.hasOwnProperty("user_id")) user.id = makeInt(data["user_id"]);
  if (data.hasOwnProperty("password")) user.password = data["password"];

  if (data.hasOwnProperty("v_code_sms")) user.vCodeSms = makeInt(data["v_code_sms"]);
  if (data.hasOwnProperty("v_code_sms_received_at")) user.vCodeHttpReceivedAt = makeInt(data["v_code_sms_received_at"]);

  // need to load everything, as it will be rewritten to db
  if (data.hasOwnProperty("phone_number")) user.phoneNumber = data["phone_number"];
  if (data.hasOwnProperty("is_verified")) user.isVerified = makeBool(data["is_verified"]);
  if (data.hasOwnProperty("last_online_at")) user.lastOnlineAt = makeInt(data["last_online_at"]);
  
  if (data.hasOwnProperty("lat")) user.lat = makeReal(data["lat"]);
  if (data.hasOwnProperty("lon")) user.lon = makeReal(data["lon"]);
  if (data.hasOwnProperty("acc")) user.acc = makeReal(data["acc"]);
  if (data.hasOwnProperty("gps_fix_at")) user.gpsFixAt = makeInt(data["gps_fix_at"]);
  if (data.hasOwnProperty("v_code_http")) user.vCodeHttp = makeInt(data["v_code_http"]);
  if (data.hasOwnProperty("v_code_http_received_at")) user.vCodeHttpReceivedAt = makeInt(data["v_code_http_received_at"]);
  if (data.hasOwnProperty("has_verification_succeeded")) user.hasVerificationSucceeded = makeBool(data["has_verification_succeeded"]);
 
  if (data.hasOwnProperty("last_online_at_timestamp")) user.lastOnlineAt_timestamp = makeInt(data["last_online_at_timestamp"]);
  if (data.hasOwnProperty("phone_number_timestamp")) user.phoneNumber_timestamp = makeInt(data["phone_number_timestamp"]);
  if (data.hasOwnProperty("is_verified_timestamp")) user.isVerified_timestamp = makeInt(data["is_verified_timestamp"]);
  if (data.hasOwnProperty("gps_timestamp")) user.gps_timestamp = makeInt(data["gps_timestamp"]);  
  if (data.hasOwnProperty("last_update_timestamp")) user.lastUpdate_timestamp = makeInt(data["last_update_timestamp"]);

  //console.log("COPYIED the user into user:");
  //console.log(user);
}

function makeInt(v){
  if (!isNaN(v))
    return Math.round(v);
  else
    return null;
}

function makeBool(v){
  if (v===true || v===false)
    return v;
  else
    return null;
}

function makeReal(v){  
  if (!isNaN(v))
    return v;
  else
    return null;
}