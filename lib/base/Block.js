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
		if(!previous) {
			// throw new Error(`Must provide a previous block hash when ` + 
			// 	`creating a new block.`);
			console.warn("Previous block hash null or not provided!");
		}

		this._nonce = nonce;
		this._previous = previous;
		this._salt = salt;
		this._data = data;
		this._hashingAlgorithm = hashingAlgorithm;
		this.hash = hash;
	}

	get data() {
		return this._data;
	}

	/**
	 * Sets the data property of the block and updates the block hash to 
	 * reflect the new data.
	 * 
	 * @param {*} data - The data to set for the block.
	 */
	set data(data) {
		this._data = data;

		do {
			this._nonce++;
			this._hash = this._hashingAlgorithm({
				data: this._data,
				nonce: this._nonce,
				previous: this._previous,
				salt: this._salt
			});
		} while(this._hash.slice(-4) !== '0000');
	}

	get hash() {
		return this._hash;
	}

	/**
	 * Sets the hash property of the block only if the given hash matches the
	 * block's calculated hash. Redundant, yet can be used for block 
	 * verification.
	 * 
	 * @param {String} hash - The hash to set for the block.
	 */
	set hash(hash) {
		if(!hash) return;

		if(!this.verify(false, hash)) {
			throw new Error(`Attempted to set invalid hash for block data!`);
		} else {
			this._hash = hash;
		}
	}

	get nonce() {
		return this._nonce;
	}

	get previous() {
		return this._previous;
	}

	set previous(previous) {
		this._previous = previous;
	}

	get salt() {
		return this._salt;
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

		const defaultComparator = (a, b, quick) => {
			if(!a || !(a instanceof Block) || !b || !(b instanceof Block)) {
				throw new Error(`Given block(s) not an instance of Block!`);
			} else {
				if(quick) {
					return a._hash === b._hash;
				} else {
					return a.stringify() === b.stringify();
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
		throw new Error(`Method 'load' not implemented for 'block' base class.`);
	}

	/**
	 * Parses a {@link Block} from a given JSON string.
	 * @param  {string} data - The JSON string to parse.
	 * @return {Block}
	 */
	parse(data) {
		if(!data || typeof data !== "string" || data.length < 1) {
			return Promise.reject(new Error("No data given!"));
		}

		let o = JSON.parse(data);

		this._salt = o.hasOwnProperty('salt') ? o.salt : this._salt;
		this._previous = 
			o.hasOwnProperty('previous') ? o.previous : this._previous;
		this._nonce = o.hasOwnProperty('nonce') ? o.nonce : this._nonce;
		this._hash = o.hasOwnProperty('hash') ? o.hash : this._hash;
		this._data = o.hasOwnProperty('data') ? o.data : this._data;

		return this;
	}
	
	stringify() {
		return JSON.stringify({
			data: this.data,
			hash: this._hash,
			nonce: this.nonce,
			previous: this.previous,
			salt: this.salt
		});
	}

	verify(quick = true, hash = this._hash) {
		if(quick) {
			return this._hash.slice(-4) === '0000';
		} else {
			let computed = this._hashingAlgorithm({
					data: this._data,
					nonce: this._nonce,
					previous: this._previous,
					salt: this._salt
				});

			return computed === hash;
		}
	}
}

module.exports = Block;