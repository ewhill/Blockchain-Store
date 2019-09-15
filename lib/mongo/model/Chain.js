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
    blocks: [{ type: Schema.Types.ObjectId, ref: 'Block' }],
    autocommit: {type: Boolean, required: false, default: true},
    autocommitTimeoutMs: {type: Number, required: false, 
    	default: Constants.DEFAULT_AUTOCOMMIT_TIMER_MS},
    name: {type: String, required: true}
});

let ChainModel = mongoose.model('Chain', ChainSchema);

module.exports = {
	ChainSchema,
	ChainModel
};