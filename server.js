'use strict';

var express = require('express');
var url = require('url');
var bodyParser = require('body-parser');

var User = require('./User');
var Logger = require('./Logger');
var Updater = require('./Updater');
var Verifier = require('./Verifier');
var TimeManager = require('./TimeManager');

var port = Number(process.env.PORT || 3000);
var app = express();
var jsonParser = bodyParser.json()

var logger = new Logger();
var timeManager = new TimeManager();
var updater = new Updater(timeManager,logger);
var verifier = new Verifier(timeManager,logger);

console.log("database url = " + process.env.DATABASE_URL);

// ***** SERVER *****

// need anon. functions wrapping updater.update, or update is not boxed (for some reason?)
app.post('/update', jsonParser, function(req,resp){updater.update(req,resp);});

app.get('/verify',function(req,resp){verifier.verify(req,resp);});

app.post('/verify',function(req,resp){ // need to respond to post as well as get (for nexmo)
  resp.writeHead(200, {"Content-Type": "text/html"});
  resp.end();
});


var server = app.listen(port, function() { // prev :3000
    console.log('Listening on port %d', server.address().port);
});

console.log("Allocating time for this server instance...");
timeManager.nextTimestamp(function(now){console.log("Allocating time for this server instance...done. now="+now);});

/*

var test = [
 "phoneNumber=1",
  "phoneNumber=2",
  "id=1&password=p&contactsPhoneNumbers[]=2",
  "id=2&password=p",
  "id=2&password=p&contactsPhoneNumbers[]=1",
  "id=1&password=p&allows[]=2",
  "id=2&password=p",
  "http://localhost:3000/update?id=2&password=p&allows[]=1"
]

var testResp = function(){
  this.send = function(data){
    console.log(data)
  }
}


test.forEach(function(e){
  console.log(url.parse(e).query)
})


*/