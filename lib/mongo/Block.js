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

const { BlockSchema, BlockModel } = require('./model/Block.js')

/**
 * A class for file-based block. This class extends the base {@link Block} 
 * class.
 * 
 * @class Block
 */
class Block extends BaseBlock {
	constructor(options) {
		super(options);

		this._database = {
			host: options.hasOwnProperty('host') ? options.host :
				"localhost",
			name: options.hasOwnProperty('name') ? options.name :
				"Blockchain"
		};

		this._database.url = options.hasOwnProperty('url') ? options.url : 
			`mongodb://${this._database.host}/${this._database.name}`

		Database.url = this._database.url;
	}

	/**
	 * Writes the mongo-based block to the mongo database. If the database 
	 * connection isn't established, this method will attempt to do so. This 
	 * method overrides the extended class {@link Block}'s 'commit' method.
	 *
	 * @param {Constants.CHAIN_OPERATIONS} operation - the operation (add 
	 * 		[including upsert] and delete) to commit to the mongo database.
	 */
	commit(operation = Constants.CHAIN_OPERATIONS.ADD) {
		return Database.connect()
			.then(db => {
				return new Promise((success, failure) => {
					let query = { hash: this._hash };

					if(operation === Constants.CHAIN_OPERATIONS.ADD) {
						let data = {
							data: this._data,
							hash: this._hash,
							nonce: this._nonce,
							previous: this._previous,
							salt: this._salt
						};
						let options = { upsert: true, new: true };

						BlockModel
							.findOneAndUpdate(query, data, options, 
								function(err, savedBlock) {
									if (err) return failure(err);
									return success(savedBlock._id);
								});
					} else {
						BlockModel
							.findOneAndDelete(query, {}, 
								function(err, deletedBlock) {
									if (err) return failure(err);
									return success(deletedBlock._id);
								});
					}
				});
			});
	}

	/**
	 * Loads a block from the mongodb collection with the specified block hash.
	 * 
	 * @param  {string} hash - The specific block hash to load.
	 * @return {Block}
	 */
	load(hash) {
		return Database.connect()
			.then(BlockModel.findOne({hash}))
			.then(block => {
				if(block) {
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