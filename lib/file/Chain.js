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
	_blocksDirectory = './';
	_directory = './';

	constructor(options) {
		super(options);

		const { directory=this._directory } = options;

		this._directory = directory;
		this._blocksDirectory = directory;
	}

	get height() {
		return this._height;
	}

	async findBlockName({ hash, index }) {
		return new Promise((resolve, reject) => {
			if(!hash || !index) {
				let indexRegexPart = index;
				let hashRegexPart = hash;
				if(!indexRegexPart) {
					indexRegexPart = '[0-9]+';
				}
				if(!hashRegexPart) {
					hashRegexPart = '[A-Z0-9]{64}';
				}
				const blockRegex = 
					new RegExp(`^${indexRegexPart}\\.${hashRegexPart}$`, 'i');
				fs.readdir(this._directory, (err, files) => {
					if(err) {
						return reject(err);
					}
					files = files.filter((f) => blockRegex.test(f));
					if (!files || files.length < 1) {
						return reject(new Error(
							`Could not find block file matching ` + 
							`${blockRegex.toString()}`))
					}
					return resolve(files[0]);
				});
			} else {
				return resolve(`${index}.${hash}`);
			}
		});
	}

	async get({ hash, index, previous }) {
		if (previous) {
			if(previous === Constants.GENESIS_HASH) {
				return this.get({ index: 0 });
			}

			return this.findBlockName({ hash: previous })
				.then((blockPath) => {
					try {
						const index = parseInt(blockPath.split('.')[0]);
						return this.get({ index: index+1 });
					} catch(e) {
						return Promise.reject(e);
					}
				});
		}

		return this.findBlockName({ hash, index, previous })
			.then(blockFilename => {
				return new Promise((resolve, reject) => {
					const blockPath = path.join(this._directory, blockFilename);
					fs.access(blockPath, fs.F_OK, (err) => {
							if(err) {
								return reject(err);
							}
							fs.readFile(blockPath, (err, data) => {
									if(err) {
										return reject(err);
									}
									try {
										const obj = JSON.parse(data);
										return resolve(new Block(obj));
									} catch(e) {
										return reject(new Error(
											`Block corrupt or not JSON!`));
									}
								});
						});
					});
			});
	}

	async add(block) {
		if(!(block instanceof Block)) {
			throw new Error(`Parameter is not of instance block!`);
		}

		if(block.previous === Constants.GENESIS_HASH) {
			return block.commit({
					directory: this._blocksDirectory,
					index: this._height,
				}).then(result => {
					this._height++;
					return result;
				});
		}

		return this.get({ hash: block.previous })
			.then(prevBlock => {
				return block.commit({
						directory: this._blocksDirectory,
						index: this._height,
					}).then(result => {
						this._height++;
						return result;
					});
			}).catch(e => {
				console.error(e.stack);
				return Promise.reject(
					new Error(`Invalid reference to previous block at ` +
						`"${block.previous}"!`));
			});
	}

	/**
	 * Creates and returns a clone of the chain.
	 */
	async clone(options = {}) {
		const {
			name=`${this._name}-CLONE`,
			directory=`${this._directory}-CLONE`,
		} = options;

		const clone = new Chain({
			directory,
			name,
		});
		await clone.commit();
		await this.walk({
				operation: (block) => {
					return clone.add(block);
				},
			});
		return Promise.resolve(clone);
	}

	/**
	 * Loads a file-based blockchain from the given directory. This method 
	 * overrides the extended class {@link Chain}'s 'load' method.
	 * 
	 * @param {string} [directory=this._directory] - The file path from which 
	 * 		to read block info.
	 */
	async load(directory = this._directory, name=this._name) {
		return new Promise((resolve, reject) => {
			const filepath = path.join(directory, `.chain`);
			fs.readFile(filepath,
				(err, data) => {
					if(err) {
						return reject(err);
					}

					const {
							blocksDirectory=this._directory,
							height=0,
							name=this._name,
						} = data.length ? JSON.parse(data) : {};
					this._blocksDirectory = blocksDirectory;
					this._height = height;
					this._name = name;

					return resolve(this);
				});
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
		if(!fs.existsSync(directory)) {
			fs.mkdirSync(directory);
		}

		return new Promise((resolve, reject) => {
			const filepath = path.join(directory, `.chain`);
			fs.writeFile(
				filepath,
				this.stringify(),
				(err) => {
					if(err) {
						return reject(err);
					}
					return resolve(filepath);
				});
		});
	}

	/**
	 * Overrides base stringify method for file-based Chain.
	 * 
	 * @return {string} A JSON string representation of this Chain.
	 */
	stringify() {
		return JSON.stringify({
			blocksDirectory: this._blocksDirectory,
			height: this._height,
			name: this._name,
		});
	}
}

module.exports = Chain;