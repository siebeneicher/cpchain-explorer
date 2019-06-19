const mongo = require('mongodb').MongoClient;
const config = require('./config');
const {promisify} = require('util');
const on_subscriptions = {'connect': []};
let client;

function connect () {
	let mo = mongo.connect(config.mongo.url, config.mongo.options, function(err, _client) {
		if (err) {
			console.error("error connecting to mongo", err);
			return;
		}

		module.exports.client = client = _client;
		console.log("Connected to mongo", config.mongo.url);

		on_subscriptions.connect.forEach(fn => fn(err, _client));
	});
}
function db (name) {
	return client.db(name);
}
function on (event, callbackFn) {
	on_subscriptions[event].push(callbackFn);
}

connect();

module.exports = {client: {}, db, on};