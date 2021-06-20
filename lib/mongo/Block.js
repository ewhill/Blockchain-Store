/**
 * @typedef {import('../base/Block')} BaseBlock
 */
const BaseBlock = require('../base/Block');

/**
 * @typedef {import('../base/Constants')} Constants
 */
const Constants = require('../base/Constants');

/**
 * @typedef {import('./Database')} Database
 */
const Database = require('./Database');

/**
 * A class for file-based block. This class extends the base {@link Block} 
 * class.
 * 
 * @class Block
 */
class Block extends BaseBlock {

	constructor(options) {
		super(options);

		const { index=null } = options;
		this._index = index;
	}

	get index() {
		return this._index;
	}

	/**
	 * Writes the mongo-based block to the mongo database. If the database 
	 * connection isn't established, this method will attempt to do so. This 
	 * method overrides the extended class {@link Block}'s 'commit' method.
	 */
	async commit({ database, height }) {
		if(!database || !(database instanceof Database)) {
			throw new Error(`Must provide database reference to 'commit()'!`);
		}

		await database.connect();
		return database.blockModel.findOne({ hash: this.hash })
			.then(block => {
				if(!block) {
					block = new database.blockModel();
				}
				block.index = this._index ? this._index : height;
				block.data = this._data;
				block.hash = this.hash;
				block.nonce = this._nonce;
				block.previous = this._previous;
				block.salt = this._salt;
				return block.save();
			});
	}

	/**
	 * Loads a block from the mongodb collection with the specified block hash.
	 * 
	 * @param  {string} hash - The specific block hash to load.
	 * @return {Block}
	 */
	async load({ database, hash }) {
		if(!database || !(database instanceof Database)) {
			throw new Error(`Must provide database reference to 'commit()'!`);
		}

		await database.connect();
		return database.blockModel.findOne({ hash })
			.then(block => {
				if(block) {
					this._index = block.index;
					this._data = block.data;
					this._hash = block.hash;
					this._nonce = block.nonce;
					this._previous = block.previous;
					this._salt = block.salt;

					return Promise.resolve(this);
				} else {
					return Promise.reject(
						new Error(`Error loading block with hash '${hash}'!`));
				}
			});
	}
}

module.exports = Block;