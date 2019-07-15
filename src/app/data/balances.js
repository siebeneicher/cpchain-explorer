const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const moment = require('moment');
const {web3, balance} = require('../../cpc-fusion/api');
const {isAddress} = require('../helper');


module.exports = {getByUnit, latest, update};

async function update (addr) {
	const t_start = now();

	// is address
	if (!isAddress(addr))
		return Promise.reject({invalidAddress: true});

	// sanitize given addr
	addr = web3.utils.toChecksumAddress(addr);

	return new Promise(async (resolve, reject) => {
		try {
			let b = await balance(addr);
			await mongo.db(config.mongo.db.sync).collection('balances')
				.updateOne({ address: addr }, { $set: { address: addr, latest_balance: b} }, { upsert: true });
			console.log("balance updated,",addr,"to",b);
			resolve(b);
		} catch (err) {
			reject(err.message);
		}
	});
}

async function latest (addr) {
	const t_start = now();

	// is address
	if (!isAddress(addr))
		return Promise.reject({invalidAddress: true});

	// sanitize given addr
	addr = web3.utils.toChecksumAddress(addr);

	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances')
			.find({address: addr})
			.project({history: 0})
			.toArray((err, result) => {
				//console.log('balances: ', err, result);

				if (result && result.length) {
					return resolve(result[0].latest_balance);
				}

				try {
					resolve(update(addr));
				} catch (err) {
					reject(err);
				}

			});
	});
}


async function getByUnit (addr, unit, ts) {
	const t_start = now();

	const from = ts;
	const to = moment(ts).add(1, unit);

	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances').find({address: addr}).toArray((err, result) => {
			if (!result || result.length == 0) {
				resolve(null);
				return;
			}

			if (err) {
				console.error(err);
				reject(null /*balance(node, blockNum)*/);
				return;
			}
// TODO: make history mandatory
return resolve(result[0].latest_balance);

			// only during the timespan and 1st before is relevant
			// after is not relevant, as we store only changes in history
			let from_close = null;
			let to_close = null;
			let during = [];

			result[0].history.forEach(_ => {
				if (_.ts < from) {
					if (from_close === null) from_close = _;
					if (from_close.ts < _.ts) from_close = _;
				}
				if (_.ts > to) {
					if (to_close === null) to_close = _;
					if (to_close.ts > _.ts) to_close = _;
				}
				if (_.ts > from && _.ts < to) {
					during.push(_);
				}
			});

			if (from_close) during.push(from_close);

			let latest = null;

			// return only last balance, most relevant
			if (during.length)
				latest = during[during.length-1].balance;

			//console.log("balances.getByUnit for", addr, " found: "+latest+" took", now()-t_start);
			resolve(latest);
		});
	});
}