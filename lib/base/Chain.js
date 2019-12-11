/**
 * @typedef {import('./Block')} Block
 */
const Block = require('./Block');

/**
 * @typedef {import('./Constants')} Constants
 */
const Constants = require('./Constants');

/**
 * A base class for a simple blockchain. This class is not stateful; extending 
 * classes must implement {@link Chain.load} and {@link Chain.commit} methods.
 * 
 * @class Chain
 */
class Chain {
	constructor(options = {}) {
		const {
				autocommit = true, 
				autocommitTimeoutMs = Constants.DEFAULT_AUTOCOMMIT_TIMER_MS,
				blocks = []
			} = options;
		
		this._autocommit = autocommit;
		this._autocommitDebouncer = null;
		this._autocommitTimeoutMs = autocommitTimeoutMs;
		this._isOrdered = false;

		// Use setter to assign blocks
		this.blocks = blocks;
	}

	get blocks() {
		return this._blocks;
	}

	/**
	 * Some chains may need to close opened entities used for storage and this 
	 * method will expose this to implementations for proper clean up.
	 * 
	 * @return {Boolean} - Whether the chain should be closed via 'close' 
	 * 		method when finished using.
	 */
	get isClosable() {
		return (typeof this.close === 'function');
	}

	set blocks(blocks) {
		if(Array.isArray(blocks)) {
			this._blocks = [];

			for(let i=0; i<blocks.length; i++) {
				if(blocks[i] instanceof Block) {
					this._blocks.push(blocks[i]);
				} else {
					throw new Error(`Block at index ${i} is not an instance ` + 
						`of class Block!`);
				}
			}

			if(this._blocks.length > 1) {
				this.order();
			}
		}
	}

	/**
	 * Adds a given block of type {@link Block} to this chain. Chain is checked 
	 * for order before adding the given block.
	 * 
	 * @param {Block} b - The block to add.
	 */
	async add(b) {
		if(b instanceof Block) {
			await this.order();

			let current;
			if(this._blocks.length > 0) {
				current = this._blocks[this._blocks.length-1].hash
			} else {
				current = Constants.GENESIS_HASH;
			}

			if(b.previous === current) {
				if (!this._lastOperations) this._lastOperations = [];
				
				this._lastOperations.push({
					type: Constants.CHAIN_OPERATIONS.ADD,
					blocks: [b]
				});

				this._blocks.push(b);

				if(this._autocommit) {
					if(this._autocommitDebouncer) {
						clearTimeout(this._autocommitDebouncer);

						this._autocommitDebouncer = setTimeout(this.commit(), 
							this._autocommitTimeoutMs);
					}
				}
			} else {
				throw new Error(`Block previous hash is not valid, therefore ` + 
					`the block cannot be added!`);
			}
		} else {
			throw new Error(`Parameter is not of instance block!`);
		}
	}

	/**
	 * Creates and returns a clone of the chain.
	 */
	clone() {
		return new Chain({
			autocommit: this._autocommit,
			autocommitTimeoutMs: this._autocommitTimeoutMs,
			blocks: this._blocks && this._blocks.length > 0 ? 
				this.blocks.slice(0) : []
		});
	}

	/**
	 * Method to be overriden by extending classes. 
	 * 
	 * @throws {Exception}
	 */
	commit() {
		throw new Error(`Method 'commit' not implemented for 'chain' base ` + 
			`class.`);
	}

	/**
	 * Removes a given block or block found by lookup of given hash from the 
	 * chain. Chain is checked for order before performing the removal.
	 * 
	 * @param {Block|String} blockOrHash - The block or hash of block to remove.
	 */
	async delete(options) {
		let toFind;
		let spliceIndex;
		let spliceLength;

		if (options) {
			let { hash, index, length } = options;

			if(hash) toFind = hash;

			if (index) {
				spliceIndex = index; 
			} else {
				let hashes = this._blocks.slice(0).map((b) => b._hash);
				spliceIndex = hashes.indexOf(toFind);
			}

			if (length) {
				spliceLength = length;
			} else {
				length = 1;
			}
		}

		await this.order();

		if (!this._lastOperations) this._lastOperations = [];

		if (spliceIndex) {
			let deleted = this._blocks.splice(spliceIndex, spliceLength);

			this._lastOperations.push({
				type: Constants.CHAIN_OPERATIONS.DELETE,
				blocks: deleted
			});

			return deleted;
		} else {
			throw new Error(`Given block not found in chain for deletion.`);
		}
	}

	/**
	 * Compares this chain with another given chain and returns the difference.
	 * It is assumed that either this chain or the other chain provided is a 
	 * subset of the alternate. If not, this function may return unexpected 
	 * results.
	 * 
	 * @param {Chain} other - A Chain object to compare against this Chain 
	 * 		object.
	 * @return {Array} - The difference between this chain and the given other.
	 */
	async diff(other) {
		if(!(other instanceof Chain)) {
			throw new Error(`Parameter 'other' is not of type 'Chain'.`);
		}

		await Promise.all([ this.order(), other.order() ]);

		if(!this._isOrdered || !other._isOrdered) {
			throw new Error(`Awaited ordering operation but chains are not ` + 
				`ordered!`);
		}

		if(this.blocks.length === 0 && other.blocks.length !== 0) {
			return other.blocks.slice(0);
		} else if(this.blocks.length !==0 && other.blocks.length === 0) {
			return this.blocks.slice(0);
		}

		let larger = null;
		let smaller = null;
		let i = 0;
		let j = 0;

		if(this.blocks.length > other.blocks.length) {
			larger = this.blocks.slice(0);
			smaller = other.blocks.slice(0);
		} else {
			larger = other.blocks.slice(0);
			smaller = this.blocks.slice(0);
		}

		while(i < larger.length && larger[i].hash !== smaller[0].hash) i++;

		let result = larger.slice(0, i);

		while(i < larger.length && j < smaller.length && 
			larger[i].hash === smaller[j].hash) {
				result.push(null);
				i++;
				j++;
		}

		return result.concat(larger.slice(i));
	}

	/**
	 * Performs an equality check between this Chain and another given Chain. 
	 * If the quick Boolean option is set in the options parameter, the chain 
	 * blocks will be compared via hash only, else, the chain blocks will be
	 * compared using a comparator if set in the options parameter. If no 
	 * comparator is given, a default comparator is used.
	 * 
	 * @param  {Chain} other - Another Chain in which to compare to this chain.
	 * @param  {Object} options - The options used to determine the equality.
	 * @return {Boolean} - Whether or not the two chains are equal.
	 */
	async equals(other, options = { quick: true }) {
		if(!other || !(other instanceof Chain)) {
			throw new Error(`Parameter 'other' not an instance of Chain!`);
		}

		if(this._blocks.length !== other._blocks.length) return false;

		await Promise.all([this.order(), other.order()]);

		for (let i=0; i<this._blocks.length; i++) {
			if(!this._blocks[i].equals(other._blocks[i], options)) {
					return false;
			}
		}

		if(this._autocommit !== other._autocommit || 
			this._autocommitTimeoutMs !== other._autocommitTimeoutMs) {
				return false;
		}

		return true;
	}

	/**
	 * Method to be overriden by extending classes. 
	 * 
	 * @throws {Exception}
	 */
	load() {
		throw new Error(`Method 'load' not implemented for 'chain' base ` + 
			`class.`);
	}

	/**
	 * Orders the chain such that the first index of {@link Chain.blocks} is 
	 * the genesis block and the last index of {@link Chain.blocks} is the 
	 * latest block if the chain is not already ordered. Note, this method only 
	 * needs to be called once, as a chain in oder can only be appended.
	 * 
	 * @return {Promise} A {@link Promise} that resolves when the chain is 
	 * 		ordered.
	 */
	order() {
		if(this._isOrdered) {
			return Promise.resolve(this);
		} else if(this._isOrdering && this._orderOperation) {
			return this._orderOperation;
		}

		this._isOrdered = false;
		this._isOrdering = true;

		if(this._blocks.length > 1) {
			this._orderOperation = new Promise((success) => {
				// Find the genesis (first) block
				for(let i=0; i<this._blocks.length; i++) {
					if(this._blocks[i].previous === Constants.GENESIS_HASH) {
						// ES6 swap using destructuring
						[ this._blocks[0], this._blocks[i] ] = 
							[ this._blocks[i], this._blocks[0] ];
					}
				}

				// Order the rest of the chain
				for(let i=0; i<this._blocks.length-1; i++) {
					if(this._blocks[i+1].previous !== this._blocks[i].hash) {
						for(let j=i+2; j<this._blocks.length; j++) {
							if(this._blocks[j].previous === 
								this._blocks[i].hash) {
									// ES6 swap using destructuring
									[ this._blocks[i+1], this._blocks[j] ] = 
										[ this._blocks[j], this._blocks[i+1] ];
									break;
							}
						}
					} else {
						continue;
					}
				}

				this._isOrdered = true;
				this._isOrdering = false;
				this._orderOperation = null;

				return success(this);
			});
		} else {
			this._isOrdered = true;
			this._isOrdering = false;
			this._orderOperation = new Promise((success) => success(this));
		}

		return this._orderOperation;
	}


	/**
	 *	Performs a rollback to the given hash in the chain or the first invalid 
	 *	block found in the chain if not hash is passed as an argument.
	 * 
	 * @param  {String} hash - The hash in the chain in which to peform the 
	 * 		rollback.
	 * @return {Boolean} - Whether or not the rollback was successful.
	 */
	async rollback(hash) {
		// Wait for ordering to complete if in process, start if not.
		await this.order();

		if (!this._isOrdered) {
			throw new Error(`Awaited ordering operation but chain is not ` + 
				`ordered!`);
		}

		if (this._blocks.length > 0) {
			if (!hash && !this._blocks[0].verify(false)) {
				await this.delete({ index: 0, length: this._blocks.length});
				return true;
			} else if (hash && this._blocks[0]._hash === hash) {
				await this.delete({ index: 1, 
					length: this._blocks.length - 1 });
				return true;
			}

			for(let i=1; i<this._blocks.length; i++) {
				// Check that the block's hash and previous are correct
				if ((!hash && !this._blocks[i].verify(false)) || 
					(this._blocks[i-1]._hash !== this._blocks[i]._previous)) {
						await this.delete({ index: i, 
							length: this._blocks.length - i });
						return true;
				} else if (hash && this._blocks[i]._hash === hash) {
					await this.delete({ index: i + 1, 
						length: this._blocks.length - (i + 1) });
					return true;
				}
			}
		} else {
			return true;
		}

		throw new Error(`Could not perform rollback: Either the chain is ` + 
			`valid and no hash was given, or the given hash was not found!`);
	}
	
	stringify() {
		let blocksString = this._blocks.slice(0).map(b => b.stringify()).join();

		return JSON.stringify({
			autocommit: this._autocommit,
			autocommitTimeoutMs: this._autocommitTimeoutMs,
			blocks: `[${blocksString}]`
		});
	}

	/**
	 * @param {Boolean} quick - Whether to perform an in-depth check of the 
	 * 		chain or to perform a quick check of the chain's block's hash value 
	 * 		(always ending with four zeros).
	 * @return {Boolean}
	 */
	async verify(quick = true) {
		// Wait for ordering to complete if in process, start if not.
		await this.order();

		if (!this._isOrdered) {
			throw new Error(`Awaited ordering operation but chain is not ` + 
				`ordered!`);
		}

		if (this._blocks.length > 0) {
			if (!this._blocks[0].verify(quick)) return false;

			for(let i=1; i<this._blocks.length; i++) {
				// Check that the block's hash is correct.
				if (!this._blocks[i].verify(quick)) return false;

				if (this._blocks[i-1]._hash !== this._blocks[i]._previous) {
					return false;
				}
			}
		}

		return true;
	}
}

module.exports = Chain;