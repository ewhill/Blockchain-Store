const crypto = require('crypto');

const SHA1 = (data) =>
	crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex');

const SHA224 = (data) =>
	crypto.createHash('sha224').update(JSON.stringify(data)).digest('hex');

const SHA256 = (data) =>
	crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

const SHA384 = (data) =>
	crypto.createHash('sha384').update(JSON.stringify(data)).digest('hex');

const SHA512 = (data) =>
	crypto.createHash('sha512').update(JSON.stringify(data)).digest('hex');

module.exports = { SHA1, SHA224, SHA256, SHA384, SHA512 };