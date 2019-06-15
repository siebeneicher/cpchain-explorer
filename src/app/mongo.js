const mongo = require('mongodb').MongoClient;
const config = require('./config');
const {promisify} = require('util');
let client;

function connect () {
	mongo.connect(config.mongo.url, config.mongo.options, function(err, _client) {
		if (err) {
			console.error("error connecting to mongo", err);
			return;
		}

		client = _client;
		console.log("Connected to mongo", config.mongo.url);
	});
}
function db (name) {
	return client.db(name);
}

connect();

module.exports = {client, db};