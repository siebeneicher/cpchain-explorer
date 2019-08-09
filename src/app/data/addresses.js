const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const {convert_ts, last_unit_ts, isAddress} = require('../helper');
const {web3, balance} = require('../../cpc-fusion/api');

async function get (hashOrHashes) {
	return new Promise((resolve, reject) => {
		let hashes = [];

		try {
			hashes = (typeof hashOrHashes == "string") ? [hashOrHashes] : hashOrHashes;
			hashes = hashes.map(_ => web3.utils.toChecksumAddress(_));
		} catch (e) {
			console.error(e);
			reject(e);
			return;
		}

		mongo.db(config.mongo.db.sync).collection('balances')
			.aggregate([
				{ $match: {address: { $in: hashes }} }
			])
			.toArray((err, addr) => {
				if (err) return reject(err);
				else if (!addr || !addr.length) return reject(null);
				else if (typeof hashOrHashes == "string") resolve(addr[0]);
				else resolve(addr);
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
