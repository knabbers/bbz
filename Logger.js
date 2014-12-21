'use strict';

module.exports = Logger;

function Logger(){
	this.verbose = false;
}

Logger.prototype.log = console.log;

Logger.prototype.vlog = function(item){
	if (this.verbose)
		this.log(item);
}