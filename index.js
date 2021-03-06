const Constants = require('./lib/base/Constants');
const Database = require('./lib/mongo/Database');

module.exports = function(mode = Constants.CHAIN_STORAGE_MODES.NONE) {
	let Block;
	let Chain;

	switch(mode) {
		case Constants.CHAIN_STORAGE_MODES.FILE:
			Block = require('./lib/file/Block');
			Chain = require('./lib/file/Chain');
			break;
		case Constants.CHAIN_STORAGE_MODES.MONGO:
			Block = require('./lib/mongo/Block');
			Chain = require('./lib/mongo/Chain');
			break;
		default:
			Block = require('./lib/base/Block.js');
			Chain = require('./lib/base/Chain.js');
	}

	return { Block, Chain, Constants, Database };
}