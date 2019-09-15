const fs = require('fs');
const path = require('path');

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
 * A class for file-based blockchain. This class extends the base {@link Chain} 
 * class.
 * 
 * @class Chain
 */
class Chain extends BaseChain {
	constructor(options) {
		super(options);

		this._directory = options.hasOwnProperty('directory') && 
			typeof options.directory === 'string' ? options.directory : `./`;
	}

	/**
	 * Creates and returns a clone of the chain. This method overrides the 
	 * extended class {@link Chain}'s 'clone' method to include the 'directory' 
	 * property.
	 */
	clone(directory) {
		if(!directory || (directory && directory === this._directory)) {
			directory = `${this._directory}-CLONE`;
		}

		return new Chain({
			autocommit: this._autoCommit,
			autocommitTimeoutMs: this._autocommitTimeoutMs,
			directory: directory,
			blocks: this._blocks && this._blocks.length > 0 ? 
				this.blocks.slice(0) : [],
		});
	}

	/**
	 * Writes the file-based blockchain to the given directory. This method 
	 * overrides the extended class {@link Chain}'s 'commit' method.
	 * 
	 * @param {string} [directory=this._directory] - The path to which the 
	 * 		blockchain will be written.
	 */
	async commit(directory = this._directory) {
		if(!fs.existsSync(directory)) fs.mkdirSync(directory);

		let commitOne = (operations) => {
			if(operations.length > 0) {
				const operation = operations.splice(0, 1)[0];

				let promises = [];
				for(let b of operation.blocks) {
					promises.push(b.commit(this._directory, operation.type));
				}

				return Promise.all(promises).then(() => commitOne(operations));
			} else {
				return Promise.resolve(true);
			}
		};

		await commitOne(this._lastOperations);
	}

	/**
	 * Loads a file-based blockchain from the given directory. This method 
	 * overrides the extended class {@link Chain}'s 'load' method.
	 * 
	 * @param {string} [directory=this._directory] - The file path from which 
	 * 		to read block info.
	 */
	async load(directory = this._directory) {
		let loaders = [];

		const files = fs.readdirSync(directory)
			.filter(file => /[A-Z0-9]{60}0000/ig.test(file));

		for(let file of files) {
			loaders.push((new Block()).load(path.join(directory, file)));
		}

		return Promise.all(loaders).then(blocks => {
			this._blocks = blocks;
			return this.order();
		})
	}
}

module.exports = Chain;