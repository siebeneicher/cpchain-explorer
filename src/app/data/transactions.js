const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const {convert_ts, last_unit_ts} = require('../helper');
const {web3, balance} = require('../../cpc-fusion/api');


module.exports = {last_sum, items, get, ofBlock, ofAddress}

async function last_sum (unit, times = 1) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();
		const last_ts = last_unit_ts(unit, times);

		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate([
				{ $match: { ts: { $gte: last_ts } } },
				{ $group: {
					_id: 'sum',
					count: { $sum: '$transactions_count' },
					volume: { $sum: '$transactions_volume' },
				} },
			])
			.toArray((err, result) => {
				console.log("transactions.last_sum(",unit, times,")", now() - t_start);

				if (err || result.length == 0) {
					console.error("transactions.last_sum(",unit, times,"):", err, result);
					resolve(null);
				} else {
					resolve(result[0]);
				}
			});
	});
}

async function items (unit, times, ts_start) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();

		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate([
				{ $project: { _id:0, ts:1, 'transactions_receiver':1, 'transactions_sender':1, transactions_count:1, transactions_volume:1 } },
				{ $sort: { ts: 1 } },
				{ $match: { ts: { $gte: convert_ts(ts_start, 10) } } },
				{ $limit: times },
			])
			.toArray((err, result) => {
				console.log("transactions.items(", unit, times, ts_start, ")", now() - t_start);

				if (err || result.length == 0) {
					console.error("transactions.items(",unit, times ,") error:", err);
					resolve(null);
				} else {
					resolve(result);
				}
			});
	});
}

async function get (trxHash) {
	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('transactions')
			.findOne({hash: trxHash})
			.then((block, err) => {
				//console.log(block, err);
				if (err) return reject(err);
				else if (!block) return reject(null);
				resolve(block);
			});
	});
}

async function ofBlock (blockNumber) {
	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('transactions')
			.find({blockNumber})
			.toArray((err, trxs) => {
				//console.log(trxs, err);
				if (err) return reject(err);
				else if (!trxs) return reject(null);
				resolve(trxs);
			});
	});
}

async function ofAddress (addrHash) {
	// sanitize given addr
	addrHash = web3.utils.toChecksumAddress(addrHash);

	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances')
			.aggregate([
				{ $match: {address: addrHash} },
				{
					$lookup:{
						from: "transactions",
						localField: "address",
						foreignField: "from",
						as: "transactions_from"
					}
				},
				{
					$lookup:{
						from: "transactions",
						localField: "address",
						foreignField: "to",
						as: "transactions_to"
					}
				},
/*				{
					$lookup:{
						from: "blocks",
						localField: "address",
						foreignField: "miner",
						as: "blocks_mined"
					}
				},*/
				{ $project: {
					address:1,
					'transactions_from.hash':1,
					'transactions_from.__ts':1,
					'transactions_from.value':1,
					'transactions_from.to':1,
					'transactions_from.from':1,
					'transactions_from.blockNumber':1,
					'transactions_to.hash':1,
					'transactions_to.__ts':1,
					'transactions_to.value':1,
					'transactions_to.to':1,
					'transactions_to.from':1,
					'transactions_to.blockNumber':1,
				} }
			])
			.toArray((err, addr) => {

				if (err) return reject(err);
				else if (!addr || !addr.length) return reject(null);

				// merge from/to transactions
				const trxs = addr[0].transactions_from.concat(addr[0].transactions_to);

				// sort
				trxs.sort((a,b) => (a.__ts > b.__ts) ? 1 : ((b.__ts > a.__ts) ? -1 : 0));

				addr[0].transactions = trxs;
				delete addr[0].transactions_from;
				delete addr[0].transactions_to;

				resolve(addr[0]);
			});
	});
}