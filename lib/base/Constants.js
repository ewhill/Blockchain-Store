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
 * @const {number}
 */
const DEFAULT_AUTOCOMMIT_TIMER_MS = 5000;

/**
 * @const {string}
 */
const GENESIS_HASH = (new Array(65)).join('0');

module.exports = {
	CHAIN_OPERATIONS,
	DEFAULT_AUTOCOMMIT_TIMER_MS,
	GENESIS_HASH,
};