const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * @typedef {import('./Constants')} Constants
 */
const Constants = require('../../base/Constants');

/*
 * Anatomy of a {@link Chain}:
 * 		{
 * 			@property {Array<Block>} blocks
 * 			@property {Boolean} autocommit
 * 			@property {Number} autocommitTimeoutMs
 * 			@property {String} name
 * 		}
 */
let ChainSchema = new Schema({
    height: {type: Number, required: false, default: 0 },
    name: {type: String, required: true}
});

module.exports = {
	ChainSchema,
};