const mongoose = require('mongoose');

const { BlockSchema } = require('./model/Block.js')
const { ChainSchema } = require('./model/Chain.js');

class Database {
	constructor(options = {}) {
		this._host = options.hasOwnProperty('host') ? 
			options.host : "localhost";
		this._name = options.hasOwnProperty('name') ? 
			options.name : "Blockchain";
		this._url = options.hasOwnProperty('url') ? 
			options.url : `mongodb://${this._host}/${this._name}`

		this._connectingOperation = null;
		this._isConnecting = false;
		this._isConnected = false;
	}

	async close() {
		return this._db.close();
	}

	async connect(url = this._url) {
		if(this._isConnected) {
			return Promise.resolve(this._db);
		}
		if(this._isConnecting) {
			return this._connectingOperation;
		}

		this._isConnecting = true;

		this._connectingOperation = mongoose.createConnection(url, {
				useNewUrlParser: true,
				useUnifiedTopology: true,
				useCreateIndex: true,
				useFindAndModify: false,
			}).then(db => {
				this._db = db;
				this.blockModel = 
					this._db.model('Block', BlockSchema, 'blocks');
				this.chainModel = 
					this._db.model('Chain', ChainSchema, 'chains');
				this._isConnected = true;
				this._isConnecting = false;
				return Promise.resolve(this);
			}).catch(err => {
				this._isConnected = false;
				this._isConnecting = false;
				return Promise.reject(err);
			});

		return this._connectingOperation;
	}

	clone(name = `${this._name}-CLONE`) {
		return new Database({
			host: this._host,
			name
		});
	}

	get host() { return this._host; }

	get name() { return this._name; }

	get url() { return this._url; }

	set host(value) {
		this._host = value;
		this.url = `mongodb://${this._host}/${this._name}`;
	}

	set name(value) {
		this._name = value;
		this.url = `mongodb://${this._host}/${this._name}`;
	}

	set url(value) {
		this._url = value;

		let protoSplit = value.split("//");
		if(protoSplit.length > 1) {
			let slashesSplit = protoSplit[1].split("/");
			this._host = slashesSplit[0];
			this._name = slashesSplit.slice(1).join("/");
		}
	}
}

module.exports = Database;