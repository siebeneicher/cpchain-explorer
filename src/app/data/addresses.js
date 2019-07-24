const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const {convert_ts, last_unit_ts} = require('../helper');


async function get (hash) {
	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances')
			.aggregate([
				{ $match: {address: hash} }
			])
			.toArray((err, addr) => {
				if (err) return reject(err);
				else if (!addr || !addr.length) return reject(null);
				resolve(addr[0]);
			});
	});
}

async function all (ignoreSmallBalances = true) {

	const match = {};

	if (ignoreSmallBalances) match.latest_balance = { $gt: 0.1 };

	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances')
			.aggregate([
				{ $match: match },
				{ $project: { _id:0 } },
				{ $sort: { rank: 1 } }
			])
			.toArray((err, addrs) => {
				if (err) return reject(err);
				else if (!addrs || !addrs.length) return resolve([]);
				resolve(addrs);
			});
	});
}

module.exports = {get, all}
