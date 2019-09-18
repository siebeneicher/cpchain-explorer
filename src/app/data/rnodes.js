const mongo = require('../mongo');
const config = require('../config');
const {convert_ts, last_unit_ts, isAddress} = require('../helper');
const now = require('performance-now');
const {unitTs} = require('../middleware/aggregate');
const {web3} = require('../../cpc-fusion/api');

module.exports = {last, last_rpt, type, items, blocks, blocks_count, last_generation, update_firstNLastBlockDate, blocks_first, blocks_last, updateAll_firstNLastBlockDate}

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

async function last_rpt (addr = null, ts_start = 'latest') {
	const match = ts_start == 'latest' ?
		[{ $sort: { ts: -1 } }, { $limit: 1 }] :
		[{ $match: { ts: { $gte: convert_ts(ts_start, 10) } } }, { $sort: { ts: 1 } }, { $limit: 1 }];

	// sanitize given addr
	if (addr) {
		addr = web3.utils.toChecksumAddress(addr);
	}

	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('rnodes')
			.aggregate(
				match.concat([
				{ $unwind: '$rnodes' },
				{ $sort: { 'rnodes.Rpt': -1 } },
				{ $project: { _id:-1, address: '$rnodes.Address', rpt: '$rnodes.Rpt', status: '$rnodes.Status' } },
/*				{ $lookup: {
					from: 'balances',
					localField: 'address',
					foreignField: 'address',
					as: 'address_info'
				} }*/
			]))
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

async function last_generation () {
	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('generation')
			.find()
			.sort({BlockNumber: -1})
			.limit(1)
			.toArray((err, result) => {
				if (err || result.length == 0) {
					console.error("rnodes.last_generation error:", err);
					reject();
				} else {
					resolve(result[0]);
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

async function blocks_first (addr) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();
		addr = web3.utils.toChecksumAddress(addr);

		mongo.db(config.mongo.db.sync).collection('blocks')
			.find({__proposer: addr})
			.sort({timestamp: 1})
			.limit(1)
			.toArray((err, result) => {
				//console.log("rewards.blocks_first(", addr, "):",!!result, err,"in", now() - t_start);

				if (err) {
					console.error("rnodes.blocks_first error:", err);
					reject();
				} else {
					resolve(result.length ? result[0] : null);
				}
			});
	});
}

async function blocks_last (addr) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();
		addr = web3.utils.toChecksumAddress(addr);

		mongo.db(config.mongo.db.sync).collection('blocks')
			.find({__proposer: addr})
			.sort({timestamp: -1})
			.limit(1)
			.toArray((err, result) => {
				//console.log("rewards.blocks_last(", addr, "):",!!result, err,"in", now() - t_start);

				if (err) {
					console.error("rnodes.blocks_last error:", err);
					reject();
				} else {
					resolve(result.length ? result[0] : null);
				}
			});
	});
}


async function items (unit, times, ts_start, addr = null, fieldOnly = null) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();

		const project = { _id:0, ts:1 };

		if (addr) {
			addr = web3.utils.toChecksumAddress(addr);

			if (fieldOnly)
				project[fieldOnly] = '$rnodes.'+addr+'.'+fieldOnly;
			else
				project['rnodes.'+addr] = 1;
		} else {
			project.rnodes = 1;
		}

		const aggr = [
			{ $project: project },
			{ $sort: { ts: 1 } },
		];

		if (times != -1) {
			aggr.push({ $match: { ts: { $gte: convert_ts(ts_start, 10) } } });
			aggr.push({ $limit: times });
		} 

		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate(aggr)
			.toArray((err, result) => {
				console.log("rewards.items(", unit, times, ts_start, addr, ")", now() - t_start);
				console.log("rewards.items aggregate: ", JSON.stringify(aggr));

				if (err) {
					console.error("rewards.items(",unit, times ,addr,") error:", err);
					resolve(null);
				} else {
					resolve(result);
				}
			});
	});
}

async function updateAll_firstNLastBlockDate () {
	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances').find().toArray(async function (err, bs) {
			for (let i in bs) {
				try {
					await update_firstNLastBlockDate(bs[i].address);
				} catch (err) {
					console.log(err);
				}
			};
			resolve();
		});
	});
}


async function update_firstNLastBlockDate (addr) {
	const t_start = now();

//console.log(addr, "isAddress:", isAddress(addr));

	// is address
	if (!isAddress(addr))
		return Promise.reject({invalidAddress: true});

	// sanitize given addr
	addr = web3.utils.toChecksumAddress(addr);

	let first = await blocks_first(addr);
	let last = await blocks_last(addr);

//console.log(addr, "has: ", !!first, !!last);

	if (!first || !last) return Promise.resolve();

	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances')
			.updateOne({address: addr}, { $set: { rnode_block_first_ts: first.timestamp, rnode_block_last_ts: last.timestamp } }, { upsert: false })
			.then((res, err) => {
				console.log("update_firstNLastBlockDate("+addr+"), modCount:", res ? res.modifiedCount : err);
				resolve();
			});
	});
}