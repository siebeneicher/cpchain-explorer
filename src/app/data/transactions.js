const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const {convert_ts, last_unit_ts} = require('../helper');

module.exports = {last_sum, items, get}

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
				console.log(block, err);
				if (err) return reject(err);
				else if (!block) return reject(null);
				resolve(block);
			});
	});
}