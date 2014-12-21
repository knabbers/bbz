var pg = require('pg');
var conString = process.env.DATABASE_URL;
//"postgres://username:password@localhost/database"

function query(text, values, cb) {
	// get a pg client from the connection pool
	pg.connect(conString,
	function(err, client, done) {
    	if (err)
    		return console.error("Error retrieving db client: " + err);

        client.query(text, values, function(err, result) {
            done();
            if (err)
            	console.error("Query resulted in error: " + err);
            cb(err, result);
        })
    });
}

exports.query = query;