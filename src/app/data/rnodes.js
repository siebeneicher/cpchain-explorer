const mongo = require('../mongo');
const config = require('../config');
const {convert_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const {unitTs} = require('../middleware/aggregate');
const {web3} = require('../../cpc-fusion/api');

module.exports = {last, last_rpt, type, items, blocks, blocks_count}

async function type (addr) {
	// sanitize given addr
	addr = web3.utils.toChecksumAddress(addr);

	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('rnodes')
			.find()
			.limit(1)
			.toArray((err, result) => {
resolve("NOT-IMPLEMENTED");
				if (result.length == 0) {
					console.log("rnodes.type empty");
					resolve(null);
				} else if (err) {
					console.error("rnodes.type error: ", err);
					resolve(null);
				} else {
					resolve(result);
				}
			});
	});
}

async function last_rpt (addr = null) {
	let match = {};

	// sanitize given addr
	if (addr) {
		addr = web3.utils.toChecksumAddress(addr);
	}

	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('rnodes')
			.aggregate([
				{ $sort: { ts: -1 } },
				{ $limit: 1 },
				{ $unwind: '$rnodes' },
				{ $sort: { 'rnodes.Rpt': -1 } },
				{ $project: { _id:-1, address: '$rnodes.Address', rpt: '$rnodes.Rpt', status: '$rnodes.Status' } },
/*				{ $lookup: {
					from: 'balances',
					localField: 'address',
					foreignField: 'address',
					as: 'address_info'
				} }*/
			])
			.toArray((err, result) => {
				if (result.length == 0 || err) {
					//console.log("rnodes.last_rpt empty");
					resolve(null);
				} else {
					// attach rank
					result.forEach((_,i) => _.rank = i+1);

					if (addr) {
						let find = result.filter(_ => _.address == addr);
						if (find && find.length)
							resolve(find[0])
						else
							resolve({ts: null, rpt: null, rank: null});
					} else {
						resolve(result);
					}
				}
			});
	});
}

async function last () {
	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('rnodes')
			.find()
			.sort({ts: -1})
			.limit(1)
			.toArray((err, result) => {
				if (err || result.length == 0) {
					console.error("rnodes.last error:", err);
					reject();
				} else {
					resolve(result[0]);
				}
			});
	});
}

async function blocks (addr, offset = 0, limit = null) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();
		addr = web3.utils.toChecksumAddress(addr);

		mongo.db(config.mongo.db.sync).collection('blocks')
			.aggregate([
				{ $match: {__proposer: addr} },
				{
					$project: {
						_id: 0,
						miner: 1,
						number: 1,
						timestamp: 1,
						transactions: 1,
						__impeached: 1,
						__proposer: 1,
						gasUsed: 1,
						gasLimit: 1,
						__gasPrice: 1,
						__reward: 1,
						__fee: 1,
						__fixed_reward: 1,
					}
				},
				{ $sort: { number: -1 } },
			]).toArray((err, result) => {
				console.log("rewards.blocks(", addr, ")", now() - t_start);

				if (err) {
					console.error("rnodes.blocks error:", err);
					reject();
				} else {
					resolve(result || []);
				}
			});
	});
}

async function blocks_count (addr) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();
		addr = web3.utils.toChecksumAddress(addr);

		mongo.db(config.mongo.db.sync).collection('blocks')
			.find({__proposer: addr})
			.count()
			.then((result, err) => {
				console.log("rewards.blocks_count(", addr, "):",result,"in", now() - t_start);

				if (err) {
					console.error("rnodes.blocks_count error:", err);
					reject();
				} else {
					resolve(result);
				}
			});
	});
}


async function items (unit, times, ts_start) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();

		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate([
				{ $project: { _id:0, ts:1, 'rnodes':1 } },
				{ $sort: { ts: 1 } },
				{ $match: { ts: { $gte: convert_ts(ts_start, 10) } } },
				{ $limit: times },
			])
			.toArray((err, result) => {
				console.log("rewards.items(", unit, times, ts_start, ")", now() - t_start);
				//console.log(result);

				if (err || result.length == 0) {
					console.error("rewards.items(",unit, times ,") error:", err);
					resolve(null);
				} else {
					resolve(result);
				}
			});
	});
}