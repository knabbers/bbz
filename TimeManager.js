'use strict';

var db = require('./db');

module.exports = TimeManager;

function TimeManager(){
  this._currentWriteTimestamps = []; // user should not try to update past (or on) any of these, or it will think it has updated something it hasn't  
  
  this._timeNext = null; // next available timestamp
  this._timeMin = null; // last allocation min-time (helps decide when to request new time)
  this._timeMax = null; // last allocation max-time. We are allowed to use all timestamps up to, not including, this value
  this._isAllocating = false;
  this._timeRequesters = [];
}

// attempts to get a fresh new timestamp for a user writer to use.
// note: if the callback is going to write, it is its responsibility to setWritingTimestamp.
TimeManager.prototype.nextTimestamp = function(cb) {
  var self = this;
  var isTimeAvailable = this._timeMin!==null && this._timeMax!==null && this._timeNext!==null && this._timeNext<this._timeMax;
  //console.log("TIME REQUESTED + avail?="+isTimeAvailable);
  // check if we need more time allocated (if null or more than half way through current window)
  if ( this._timeMin===null || this._timeMax===null || this._timeNext===null 
       || this._timeNext > (this._timeMin+this._timeMax)/2 ){    
    if (!this._isAllocating){ // initiate allocation
      console.log("Attempting to allocate time...");
      // allocates time enough for 100 billion queries
      // this allows 90 000 instances of this server, assuming one allocation per instance. (from JS's poor big int precision)
      this._isAllocating=true;
      db.query("UPDATE bbz_time SET time=time+100000000000 RETURNING time",[], 
        function(err, result){
          if (err)
            console.error("Error allocating time.");

          var row = result.rows[0];
          if (row.hasOwnProperty("time")){
            console.log("Attempting to allocate time...done");
            self._timeMax = row["time"];
            self._timeMin = self._timeMax-100000000000;
            if (self._timeNext==null)
              self._timeNext = self._timeMin;
            self._isAllocating=false;
            var oldRequesters = self._timeRequesters;
            self._timeRequesters = [];
            oldRequesters.forEach(function(e){
              self.nextTimestamp(e);
            }); // try again
          }
        }
      );
    }
  }
  if (!isTimeAvailable)
    this._timeRequesters.push(cb); // wait for time to become available
  else
    cb(this._timeNext++);
}

// don't call this before requesting timestamp
TimeManager.prototype.getSafeReadTimestamp = function() {
  if (isNaN(this._timeNext))
    return console.error("Error: current time is NaN. what!?");
  if (this._currentWriteTimestamps.length == 0)
    return this._timeNext-1;
  else
    return Math.min.apply(null,this._currentWriteTimestamps)-1;
}

TimeManager.prototype.setWritingTimestamp = function(timestamp){  
  var index = this._currentWriteTimestamps.indexOf(timestamp);
  if (index===-1)
    this._currentWriteTimestamps.push(timestamp);
}

TimeManager.prototype.forgetWritingTimestamp = function(timestamp){
  var index = this._currentWriteTimestamps.indexOf(timestamp);
  if (index!==-1)
    this._currentWriteTimestamps.splice(index,1);
}
