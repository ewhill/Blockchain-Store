const mongoose = require('mongoose');

class Database {
	constructor(options = {}) {
		this._connectingOperation = null;
		this._host = options.hasOwnProperty('host') ? 
			options.host : "localhost";
		this._isConnecting = false;
		this._isConnected = false;
		this._name = options.hasOwnProperty('name') ? 
			options.name : "Blockchain";
		this._url = options.hasOwnProperty('url') ? 
			options.url : `mongodb://${this._host}/${this._name}`
	}

	close() {
		return new Promise((success, failure) => {
			mongoose.disconnect((err) => {
				if(err) return failure(err);
				return success(true);
			});
		});
	}

	connect(url = this._url) {
		if(this._isConnected) return Promise.resolve(this._db)
		if(this._isConnecting) return this._connectingOperation;

		this._isConnecting = true;

		this._connectingOperation = mongoose.connect(url, 
			{ useFindAndModify: false })
				.then((db) => {
					this._db = db;
					this._isConnected = true;
					this._isConnecting = false;

					return Promise.resolve(this._db);
				})
				.catch(err => {
					this._connectingOperation = Promise.reject(err);
					this._isConnected = false;
					this._isConnecting = false;
					throw err;
				});

		return this._connectingOperation;
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

module.exports = new Database();