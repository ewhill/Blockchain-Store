const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/*
 * Anatomy of a {@link Block}:
 * 		{
 * 			@property {*} data
 * 			@property {string} hash
 * 			@property {number } nonce
 * 			@property {string} previous
 * 			@property {string} salt
 * 		}
 */
let BlockSchema = new Schema({
    data: {type: Object, required: false, default: []},
    hash: {type: String, required: true},
    nonce: {type: Number, required: true},
    previous: {type: String, required: true},
    salt: {type: String, required: true}
});

let BlockModel = mongoose.model('Block', BlockSchema);

module.exports = {
	BlockSchema,
	BlockModel
};