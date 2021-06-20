/**
 * The operations used when storing actions performed on a chain between 
 * commits.
 * @const {Object}
 */
const CHAIN_OPERATIONS = {
	ADD: 0,
	DELETE: 1
};

/**
 * The possible storage modes for storing the blockchain.
 * @const {Object}
 */
const CHAIN_STORAGE_MODES = {
	FILE: 'file',
	MONGO: 'mongo',
	NONE: null
};

/**
 * @const {string}
 */
const GENESIS_HASH = (new Array(65)).join('0');

module.exports = {
	CHAIN_OPERATIONS,
	CHAIN_STORAGE_MODES,
	GENESIS_HASH,
};