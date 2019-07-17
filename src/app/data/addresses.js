const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const {convert_ts, last_unit_ts} = require('../helper');


async function get (hash) {
	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances')
			.aggregate([
				{ $match: {address: hash} },
				{ $project: {
					address:1,
					latest_balance:1
				} }
			])
			.toArray((err, addr) => {
				if (err) return reject(err);
				else if (!addr || !addr.length) return reject(null);
				resolve(addr[0]);
			});
	});
}

async function all () {
	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances')
			.aggregate([
				{ $project: {
					_id:0,
					address:1
				} }
			])
			.toArray((err, addrs) => {
				if (err) return reject(err);
				else if (!addrs || !addrs.length) return resolve([]);
				resolve(addrs.map(_ => _.address));
			});
	});
}

module.exports = {get, all}
