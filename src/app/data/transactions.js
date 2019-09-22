const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const {convert_ts, last_unit_ts} = require('../helper');
const {web3, balance} = require('../../cpc-fusion/api');


module.exports = {last, items, get, ofBlock, ofAddress, ofAddress_count}


async function last (unit, times = 1) {
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
					fee: { $sum: '$transactions_fee' },
				} },
			])
			.toArray((err, result) => {
				//console.log("transactions.last(",unit, times,")", now() - t_start);

				if (err || result.length == 0) {
					console.error("transactions.last(",unit, times,"):", err);
					resolve({count: 0, volume: 0, fee: 0, fee_avg: 0});
				} else {
					result[0].fee_avg = result[0].fee / result[0].count;
					resolve(result[0]);
				}
			});
	});
}

async function last_feeByTrx (unit, times = 1) {
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
				//console.log("transactions.last_sum(",unit, times,")", now() - t_start);

				if (err || result.length == 0) {
					console.error("transactions.last_sum(",unit, times,"):", err, result);
					resolve(null);
				} else {
					resolve(result[0]);
				}
			});
	});
}

async function items (unit, times, ts_start, select = []) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();

		let project = {_id:0};

		if (select)
			select.forEach(s => project[s] = 1)
		else		// default
			project = { _id:0, ts:1, 'transactions_receiver':1, 'transactions_sender':1, transactions_count:1, transactions_volume:1, transactions_fee:1 };

		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate([
				{ $project: project },
				{ $sort: { ts: 1 } },
				{ $match: { ts: { $gte: convert_ts(ts_start, 10) } } },
				{ $limit: times },
			])
			.toArray((err, result) => {
				//console.log("transactions.items(", unit, times, ts_start, ")", now() - t_start);

				if (err || result.length == 0) {
					console.error("transactions.items(",unit, times ,") error:", err);
					resolve([]);
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

async function ofAddress (addrHash, offset = null, limit = null, sort = null, sortOrder = null) {
	return new Promise((resolve, reject) => {
		const t_start = now();

		// sanitize given addr
		addrHash = web3.utils.toChecksumAddress(addrHash);
		let _sort = sort === null ? {__ts: -1} : {[sort]: parseInt(sortOrder)};

		const aggr = [
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
			{ $project: { transactions: { $concatArrays: [ "$transactions_to", "$transactions_from" ] } } },
			{ $unwind: '$transactions' },
			{ $project: {
				_id: 0,
				'hash':'$transactions.hash',
				'__ts':'$transactions.__ts',
				'value':'$transactions.value',
				'to':'$transactions.to',
				'from':'$transactions.from',
				'blockNumber':'$transactions.blockNumber',
			} },
			{ $sort: _sort }
		];

		if (offset !== null) {
			aggr.push({ $skip: parseInt(offset) });
		}
		if (limit !== null && parseInt(limit) != -1) {
			aggr.push({ $limit: parseInt(limit) });
		}

		mongo.db(config.mongo.db.sync).collection('balances')
			.aggregate(aggr)
			.toArray((err, trxs) => {

				if (err) return reject(err);
				else if (!trxs || !trxs.length) return reject(null);

				console.log("transactions.ofAddress(", addrHash, offset, limit, ") took", now() - t_start);

				resolve(trxs);
			});
	});
}

async function ofAddress_count (addrHash) {
	return new Promise((resolve, reject) => {
		const t_start = now();

		// sanitize given addr
		addrHash = web3.utils.toChecksumAddress(addrHash);

		mongo.db(config.mongo.db.sync).collection('transactions')
			.find({ __from_to: { $elemMatch: { $eq: addrHash } } })
			.count()
			.then((cnt, err) => {
				console.log("transactions.ofAddress_count(", addrHash, "): ",cnt," took", now() - t_start);

				if (err) return reject(err);
				else resolve(cnt);
			});
	});
}