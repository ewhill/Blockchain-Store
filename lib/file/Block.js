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
	async commit({ directory='./', index }) {
		if(typeof index === 'undefined') {
			return Promise.reject(new Error(`Invalid index!`));
		}

		const data = await this.stringify();
		const hash = await this.hash;
		const filePath = 
			path.normalize(path.join(directory, `${index}.${hash}`));
		return new Promise((resolve, reject) => {
				fs.writeFile(filePath, data, 'utf8', function(err) {
						if(err) {
							return reject(err);
						} else {
							return resolve(filePath);
						}
					});
			});
	}

	/**
	 * Reads the file-based block from the given path. This method 
	 * overrides the extended class {@link Block}'s 'load' method.
	 * 
	 * @param {string} path - The path from which the block will be read.
	 */
	static load(path) {
		if(!path || typeof path !== "string" || path.length < 1) {
			return Promise.reject(new Error("No path given!"));
		}
		return new Promise((success, failure) => {
			fs.readFile(path, 'utf8', (err, data) => {
				if(err) {
					return failure(err);
				} else {
					const block = new Block();
					block.parse(data);
					return success(block);
				}
			})
		})

	}
}

module.exports = Block;