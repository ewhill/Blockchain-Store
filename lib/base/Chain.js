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
				blocks = [],
				height = 0,
				name = 'chain',
			} = options;
		
		this.blocks = blocks; // Use setter to assign blocks
		this._height = height;
		this._name = name;
	}

	get blocks() {
		return this._blocks;
	}

	get height() {
		return this._blocks.length;
	}

	get name() {
		return this._name;
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
		}
	}

	async get({ hash, index }) {
		let i = -1;
		const checkBlock = async (block) => {
			i++;
			const hashMatches = block.hash === hash;
			const indexMatches = i === index;
			if(hashMatches || indexMatches) {
				return Promise.resolve(block);
			}
			return Promise.resolve(null);
		};
		return this.walk({ operation: checkBlock })
			.then(results => {
				for(let result of results) {
					if(result !== null) {
						return Promise.resolve(result);
					}
				}
				return Promise.reject(new Error(
					`Could not find block at with hash "${hash}"!`));
			});
	}

	async _getByPrevious(previous) {
		for(let block of this.blocks) {
			if(block.previous === previous) {
				return Promise.resolve(block);
			}
		}
		return Promise.reject(new Error(
			`Could not find block by previous: ${previous}!`));
	}

	async walk({
		operation=async (block) => Promise.resolve(block),
		start=Constants.GENESIS_HASH,
		end,
		index=0,
		limit=this._height-1,
		results=[]
	}) {
		try {
			const block = await this._getByPrevious(start);
			const after = async (result) => {
				results.push(result);

				const hash = await block.hash;
				if((end && hash === end) || (limit > 0 && index > limit)) {
					return Promise.resolve(results);
				}

				return this.walk({
						operation,
						start: hash,
						end,
						index: index+1,
						limit,
						results,
					});
			};

			if(typeof operation === 'function') {
				const result = await operation(block);
				return after(result);
			}
			return after(block);
		} catch(e) {
			return Promise.resolve(results);
		}
	}

	/**
	 * Adds a given block of type {@link Block} to this chain. Chain is checked 
	 * for order before adding the given block.
	 * 
	 * @param {Block} b - The block to add.
	 */
	async add(b) {
		if(!(b instanceof Block)) {
			throw new Error(`Parameter is not of instance block!`);
		}

		if(this.height > 0) {
			try {
				const previous = await this._getByPrevious(b.previous);
			} catch(e) {
				throw new Error(`Invalid block previous!`);
			}
		}
		this._blocks.push(b);
	}

	/**
	 * Creates and returns a clone of the chain.
	 */
	clone(name=`${this._name}-CLONE`) {
		return new Chain({
			blocks: this.blocks.slice(0),
			name,
		});
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
	async diff(other, options = {}) {
		if(!other || !(other instanceof Chain)) {
			throw new Error(`Parameter 'other' not an instance of Chain!`);
		}

		const { quick=true } = options;

		const checkDiff = async (selfBlock) => {
			try {
				const otherBlock = await other.get({ hash: selfBlock.hash });
				if(!otherBlock) {
					return Promise.resolve(selfBlock);
				}

				if(!quick) {
					const selfBlockData = JSON.stringify(selfBlock.data);
					const otherBlockData = JSON.stringify(otherBlock.data);
					if(selfBlockData !== otherBlockData) {
						return Promise.resolve(selfBlock);
					}
				}
				
				return Promise.resolve(null);
			} catch(err) {
				return Promise.resolve(selfBlock);
			}
		};

		return this.walk({ operation: checkDiff });
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

		const { quick } = options;

		const checkEquals = async (selfBlock) => {
			try {
				const otherBlock = await other.get(selfBlock.hash);
				if(!otherBlock) {
					return Promise.resolve(false);
				}
				if(quick) {
					return Promise.resolve(true);
				}
				const selfBlockData = JSON.stringify(selfBlock.data);
				const otherBlockData = JSON.stringify(otherBlock.data);
				if(selfBlockData === otherBlockData) {
					return Promise.resolve(true);
				}
				return Promise.resolve(false);
			} catch(err) {
				return Promise.resolve(false);
			}
		};

		return this.walk({ operation: checkEquals })
			.then(results => {
				return results.reduce((prev, curr) => prev && curr, true);
			});
	}

	stringify() {
		let blocksString = this._blocks.slice(0).map(b => b.stringify()).join();

		return JSON.stringify({
			blocks: `[${blocksString}]`,
			name: this.name,
		});
	}

	/**
	 * @param {Boolean} quick - Whether to perform an in-depth check of the 
	 * 		chain or to perform a quick check of the chain's block's hash value 
	 * 		(always ending with four zeros).
	 * @return {Boolean}
	 */
	async verify(quick = true) {
		const checkBlock = async (block) => block.verify(quick);
		return this.walk({ operation: checkBlock })
			.then(results => {
				return results.reduce((prev, curr) => prev && curr, true);
			});
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
	 * Method to be overriden by extending classes. 
	 * 
	 * @throws {Exception}
	 */
	commit() {
		throw new Error(`Method 'commit' not implemented for 'chain' base ` + 
			`class.`);
	}
}

module.exports = Chain;