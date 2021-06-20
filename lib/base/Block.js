const crypto = require('crypto');

const { SHA256 } = require('../misc/sha');

/**
 * A base class for a simple block. This class is not stateful; extending 
 * classes must implement {@link Block.load} and {@link Block.commit} methods.
 * 
 * @class Block
 */
class Block {
	constructor({
		data = [],
		hash,
		hashingAlgorithm = SHA256,
		nonce = 0,
		previous,
		salt = crypto.randomBytes(8).toString('hex')
	}) {
		// if(!previous) {
		// 	throw new Error(`Must provide a previous block hash when ` + 
		// 		`creating a new block.`);
		// 	console.warn("Previous block hash null or not provided!");
		// }

		this._nonce = nonce;
		this._previous = previous;
		this._salt = salt;
		this._data = data;
		this._hashingAlgorithm = hashingAlgorithm;

		this._dataProxy = new Proxy(this._data, {
			set: (target, prop, value) => {
				if(!target.hasOwnProperty(prop) || target[prop] !== value) {
    				target[prop] = value;
    				this._recomputeHash();
    			}
    			return true;
			},
		});

		this._recomputeHash();
	}

	get data() {
		return this._dataProxy;
	}

	/**
	 * Sets the data property of the block and updates the block hash to 
	 * reflect the new data.
	 * 
	 * @param {*} data - The data to set for the block.
	 */
	set data(data) {
		this._data = data;
		this._recomputeHash();
	}

	get hash() {
		return this._hash;
	}

	get nonce() {
		return this._nonce;
	}

	get previous() {
		return this._previous;
	}

	set previous(previous) {
		if (this._previous !== previous) {
			this._previous = previous;
			this._recomputeHash();
		}
	}

	get salt() {
		return this._salt;
	}

	_recomputeHash() {
		this._hash = '';
		this._nonce = -1;
		while(this._hash.slice(-4) !== '0000') {
			this._nonce++;
			this._hash = this._hashingAlgorithm({
				data: this._data,
				nonce: this._nonce,
				previous: this._previous,
				salt: this._salt
			});
		}
	}

	/*
	 * commit method to be implemented by extending classes.
	 */
	commit() {
		throw new Error(`Method 'commit' not implemented for 'block' base class.`);
	}

	/**
	 * Performs an equality check between this Block and another given Block. 
	 * If the quick Boolean option is set in the options parameter, the chain 
	 * blocks will be compared via hash only, else, the chain blocks will be
	 * compared using a comparator if set in the options parameter. If no 
	 * comparator is given, a default comparator is used.
	 * 
	 * @param  {Block} other - The other Block in which to compare to this 
	 * 		Block.
	 * @param  {Object} options - The options defining how the equality is 
	 * 		performed.
	 * @return {Boolean} - Whether the this block and the given other block is 
	 * 		the same
	 */
	equals(other, options) {
		if(!other || !(other instanceof Block)) {
			throw new Error(`Given block is not an instance of Block!`);
		}

		const defaultComparator = async (a, b, quick) => {
			if(!a || !(a instanceof Block) || !b || !(b instanceof Block)) {
				throw new Error(`Given block(s) not an instance of Block!`);
			} else {
				if(quick) {
					const selfHash = a.hash;
					const otherHash = b.hash;
					return selfHash === otherHash;
				} else {
					const selfStringify = a.stringify();
					const otherStringify = b.stringify();
					return selfStringify === otherStringify;
				}
			}
		};

		const { quick, comparator = defaultComparator } = options;

		return comparator(this, other, quick);
	}

	/*
	 * load method to be implemented by extending classes.
	 */
	load() {
		throw new Error(
			`Method 'load' not implemented for 'block' base class.`);
	}

	/**
	 * Parses a {@link Block} from a given JSON string.
	 * @param  {string} data - The JSON string to parse.
	 * @return {Block}
	 */
	parse(jsonData) {
		if(!jsonData || typeof jsonData !== "string" || jsonData.length < 1) {
			throw new Error("No data given!");
		}

		const {
				salt=this._salt,
				previous=this._previous,
				nonce=this._nonce,
				hash=this._hash,
				data=this._data
			} = JSON.parse(jsonData);

		this._salt = salt;
		this._previous = previous;
		this._nonce = nonce;
		this._hash = hash;
		this._data = data;
		return this;
	}
	
	stringify() {
		return JSON.stringify({
			data: this._data,
			hash: this.hash,
			nonce: this._nonce,
			previous: this._previous,
			salt: this._salt
		});
	}

	verify(quick=true) {
		if(quick) {
			return this._hash.slice(-4) === '0000';
		}
		let computed = this._hashingAlgorithm({
				data: this._data,
				nonce: this._nonce,
				previous: this._previous,
				salt: this._salt
			});
		return computed === this._hash;
	}
}

module.exports = Block;