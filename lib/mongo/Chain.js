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

/**
 * A class for file-based blockchain. This class extends the base {@link Chain} 
 * class.
 * 
 * @class Chain
 */
class Chain extends BaseChain {
	constructor(options) {
		super(options);

		const { database=null } = options;

		if(!database || !(database instanceof Database)) {
			throw new Error(`Must provide database reference to constructor!`);
		}

		this._database = database;
	}

	get height() {
		return this._height;
	}

	get name() {
		return this._database.name;
	}

	async get({ hash, index, previous }) {
		await this._database.connect();
		let query = {};
		if(hash) {
			query.hash = hash;
		}
		if(index) {
			query.index = index;
		}
		if(previous) {
			query.previous = previous;
		}
		return this._database.blockModel
			.findOne(query)
			.then(block => {
				if(!block) {
					return Promise.reject(new Error(
						`Block query ${JSON.stringify(query)} failed!`));
				}
				return Promise.resolve(block);
			})
	}

	async add(block) {
		if(!(block instanceof Block)) {
			return Promise.reject(new Error(
				`Parameter is not of instance block!`));
		}

		if(block.previous !== Constants.GENESIS_HASH) {
			try {
				const prevBlock = await this.get(block.previous);
				if(!prevBlock) {
					return Promise.reject(
						new Error(`Invalid reference to previous block at ` +
							`"${block.previous}"!`));
				}
			} catch(err) {
				return Promise.reject(
						new Error(`Invalid reference to previous block at ` +
							`"${block.previous}"!`));
			}
		}

		return block.commit({ database: this._database, height: this.height })
			.then(result => {
				this._height++;
				return result;
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
	async clone(name=`${this._database._name}-CLONE`) {
		const db = this._database.clone(name);
		await db.connect();

		const cloneBlock = async (block) => {
			return db.blockModel.findOne({ hash: block.hash })
				.then(otherBlock => {
					if(!otherBlock) {
						otherBlock = new db.blockModel();
					}
			        otherBlock.index = block._index;
					otherBlock.data = block._data;
					otherBlock.hash = block.hash;
					otherBlock.nonce = block._nonce;
					otherBlock.previous = block._previous;
					otherBlock.salt = block._salt;
			        return otherBlock.save();
			    }
			);
		};

		const clone = new Chain({
			database: db,
			height: this._height,
		});

		await this.walk({ operation: cloneBlock });
		return clone;
	}

	/**
	 * Loads a mongo-based blockchain from the given name. This method 
	 * overrides the extended class {@link Chain}'s 'load' method.
	 * 
	 * @param {string} [name=this._database._name] - The database name from which 
	 * 		to read block info.
	 */
	async load(name = this._database._name) {
		await this._database.connect();
		return this._database.chainModel
			.findOne({ name })
			.then(chain => {
				if (!chain) {
					return Promise.reject(new Error(
						`Error loading chain with name '${name}'!`));
				}
				this._height = chain.height;
				return Promise.resolve(chain);
			});
	}

	/**
	 * Writes the mongo-based blockchain to database with the given name. This 
	 * method overrides the extended class {@link Chain}'s 'commit' method.
	 * 
	 * @param {string} [name=this._database._name] - The database name to which 
	 *      the blockchain will be written.
	 */
	async commit(name = this._database._name) {
		await this._database.connect();
		return this._database.chainModel.findOne({ name: this._database._name })
			.then(chain => {
				if(!chain) {
					chain = new this._database.chainModel();
				}
				chain.height = this._height;
				chain.name = this.name;
				return chain.save();
			});
	}

	async close() {
		await this.commit();
		await this._database.close();
	}

	stringify() {
		return JSON.stringify({
			height: this._height,
			name: this.name,
		});
	}
}

module.exports = Chain;