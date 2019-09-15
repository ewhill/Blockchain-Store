/**
 * @typedef {import('../base/Chain')} BaseChain
 */
const BaseChain = require('../base/Chain');

/**
 * @typedef {import('./Block')} Block
 */
const Block = require('./Block');

/**
 * @typedef {import('../base/Constants')} Constants
 */
const Constants = require('../base/Constants');

/**
 * @typedef {import('./Database')} Database
 */
const Database = require('./Database');

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const { ChainSchema, ChainModel } = require('./model/Chain.js');

/**
 * A class for file-based blockchain. This class extends the base {@link Chain} 
 * class.
 * 
 * @class Chain
 */
class Chain extends BaseChain {
	constructor(options) {
		super(options);

		this._database = {
			connection: null,
			host: options.hasOwnProperty('host') && 
				typeof options.host === 'string' ? options.host : "localhost",
			name: options.hasOwnProperty('name') && 
				typeof options.name === 'string' ? options.name : "Blockchain"
		};

		this._database.url = options.hasOwnProperty('url') && 
			typeof options.url === 'string' ? options.url : 
			`mongodb://${this._database.host}/${this._database.name}`

		Database.url = this._database.url;

		this._name = options.hasOwnProperty('name') && 
			typeof options.name === 'string' ? options.name : 'Chain';
	}

	/**
	 * Writes the mongo-based blockchain to database with the given name. This 
	 * method overrides the extended class {@link Chain}'s 'commit' method.
	 * 
	 * @param {string} [name=this._name] - The database name to which the 
	 * 		blockchain will be written.
	 */
	async commit(name = this._name) {
		return Database.connect()
			.then((db) => {
				// Note that these operations must be done sequentially, in the 
				// order in which they were performed on the chain in memory.
				let commitOne = (operations, addedIds, deletedIds) => {
					if(operations.length > 0) {
						const operation = operations.splice(0, 1)[0];

						let promises = [];
						for(let b of operation.blocks) {
							promises.push(b.commit(operation.type));
						}

						return Promise.all(promises).then(ids => {
							if(operation.type === 
								Constants.CHAIN_OPERATIONS.ADD) {
									addedIds = addedIds.concat(ids);
							} else if(operation.type === 
								Constants.CHAIN_OPERATIONS.DELETE) {
									deletedIds = deletedIds.concat(ids);
							}

							return commitOne(operations, addedIds, deletedIds);
						});
					} else {
						return Promise.resolve({
							added: addedIds,
							deleted: deletedIds 
						});
					}
				};

				return commitOne(this._lastOperations, [], []);
			})
			.then(({ added, deleted }) => {
				let chainData = {
					autocommit: this._autocommit,
					autocommitTimeoutMs: this._autocommitTimeoutMs,
					name: this._name
				};

				if(added.length > 0) chainData.$push = { blocks: added };
				if(deleted.length > 0) chainData.$pullAll = { blocks: deleted };

				return new Promise((success, failure) => {
					let query = { name: this._name };
					let options = { upsert: true, new: true };

					ChainModel
						.findOneAndUpdate(query, chainData, options, 
							function(err, savedChain) {
								if (err) return failure(err);
								return success(savedChain);
							});
				});
			});
	}

	/**
	 * Generates a clone of this Chain. Please note that the clone name MUST BE 
	 * different than the original name, else there is risk that the clone will 
	 * overwrite the original in the mongo database when the clone is committed.
	 * 
	 * @param  {String} name = The name of the generated clone.
	 * @return {Chain} - The generated Chain clone.
	 */
	clone(name) {
		if(!name || (name && name === this._name)) {
			name = `${this._name}-CLONE`;
		}

		return new Chain({
			autocommit: this._autocommit,
			autocommitTimeoutMs: this._autocommitTimeoutMs,
			blocks: this._blocks && this._blocks.length > 0 ? 
				this.blocks.slice(0) : [],
			host: this._database.host,
			name,
			url: this._database.url
		});
	}

	async close() {
		let db = await Database.connect();

		if(this._lastOperations.length > 0) {
			await this.commit();
		}

		await Database.close();
	}

	/**
	 * Loads a mongo-based blockchain from the given name. This method 
	 * overrides the extended class {@link Chain}'s 'load' method.
	 * 
	 * @param {string} [name=this._name] - The database name from which 
	 * 		to read block info.
	 */
	load(name = this._name) {
		return Database.connect()
			.then(db => {
				return new Promise((success, failure) => {
					ChainModel
						.findOne({ name })
						.populate('blocks')
						.exec((err, chain) => {
							if (err) return failure(err);

							if (!chain) return failure(new Error(
								`Error loading chain with name '${name}'!`));

							if(chain.blocks) {
								for(let b of chain.blocks) {
									b.host = this._database.host;
									b.name = this._database.name;
									this._blocks.push(new Block(b))
								}
							}

							this._autocommit = chain.autocommit;
							this._autocommitTimeoutMs = 
								chain.autocommitTimeoutMs;
							this.name = chain.name;

							return success(chain);
						});
				});
			});
	}
}

module.exports = Chain;