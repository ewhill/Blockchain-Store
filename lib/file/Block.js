const fs = require('fs');
const path = require('path');

/**
 * @typedef {import('../base/Block')} Block
 */
const BaseBlock = require('../base/Block');

/**
 * @typedef {import('../base/Constants')} Constants
 */
const Constants = require('../base/Constants');

/**
 * A class for file-based block. This class extends the base {@link Block} 
 * class.
 * 
 * @class Block
 */
class Block extends BaseBlock {
	constructor(options = {}) {
		super(options);
	}

	/**
	 * Writes the file-based block to the given directory. This method 
	 * overrides the extended class {@link Block}'s 'commit' method.
	 * 
	 * @param {string} [directory="./"] - The directory to which the 
	 * 		block will be written.
	 */
	commit(directory = `./`, operation = Constants.CHAIN_OPERATIONS.ADD) {
		const filePath = path.normalize(path.join(directory, `/${this._hash}`));

		return new Promise((success, failure) => {
			if(operation === Constants.CHAIN_OPERATIONS.ADD) {
				fs.writeFile(filePath, this.stringify(), 'utf8', function(err) {
					if(err) {
						return failure(err);
					} else {
						return success(filePath);
					}
				});
			} else if(operation === Constants.CHAIN_OPERATIONS.DELETE) {
				fs.unlink(filePath, function(err) {
					if(err) {
						return failure(err);
					} else {
						return success(filePath);
					}
				});
			}
		})
	}

	/**
	 * Reads the file-based block from the given path. This method 
	 * overrides the extended class {@link Block}'s 'load' method.
	 * 
	 * @param {string} path - The path from which the block will be read.
	 */
	load(path) {
		if(!path || typeof path !== "string" || path.length < 1) {
			return Promise.reject(new Error("No path given!"));
		}

		let self = this;
		return new Promise((success, failure) => {
			fs.readFile(path, 'utf8', function(err, data) {
				if(err) {
					return failure(err);
				} else {
					return success(self.parse(data));
				}
			})
		})

	}
}

module.exports = Block;