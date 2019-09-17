const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const {convert_ts, last_unit_ts, isAddress} = require('../helper');
const {web3, balance} = require('../../cpc-fusion/api');
const price = require('./price');


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

async function all (ignoreSmallBalances = true, calculateUSD = false) {

	const match = {};

	let aggr = [
		{ $match: match },
		{ $project: { _id:0 } }
	];

	if (ignoreSmallBalances) match.latest_balance = { $gt: 0.1 };

	if (calculateUSD) {
		let usd_price = await price.last();
		aggr.push({ $project: { address: 1, balance_pct_of_total: 1, rnode_block_first_ts:1, rnode_block_last_ts:1, latest_balance: 1, rank: 1, latest_balance_usd: { $multiply: [ "$latest_balance", usd_price.USD.price ] } } });
	}

	aggr.push({ $sort: { rank: 1 } });

	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances')
			.aggregate(aggr)
			.toArray((err, addrs) => {
				if (err) return reject(err);
				else if (!addrs || !addrs.length) return resolve([]);

				resolve(addrs);
			});
	});
}

module.exports = {get, all}
