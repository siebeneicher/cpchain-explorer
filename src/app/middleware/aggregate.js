const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const balances = require('../data/balances');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts, execShellCommand} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const {blockNumber, rnodes, versions, generation, block, transaction, balance, web3} = require('../../cpc-fusion/api');
const data_rnodes = require('../data/rnodes');

const units = {
	'minute': {},
	'hour': {},
	'day': {},
	//'week': {},
	'month': {},
	'year': {}
};

const max_blocks_per_aggregation = 5000;		// limit blocks per aggregation, specially when aggregating from 0
const cpc_digits = parseInt(1+("0".repeat(18)));
let indexes_ensured = false;

let run_promise = Promise.resolve();		// keep promise to chain run() calls and avoid parallelism



async function init () {
	// TODO: find better way to go: get informed when mongo is ready
	setTimeout(() => {
		if (process.argv.length > 2 && process.argv[2] && units[process.argv[2]] !== undefined) {
			aggregate_all(process.argv[2]);
		}
	}, 3000);
}

init();




module.exports = {run, reset, test, aggregate_all};



async function reset (unit = null, times = null) {
	const blocks = mongo.db(config.mongo.db.sync).collection('blocks');

	let del_block_min = 0;
	let del_block_max = 999999999999999999;

	return Promise.all(Object.keys(units).map((_unit) => {
		if (unit != null && _unit != unit) return Promise.resolve();

		let ts_start = 0;
		if (unit != null && times != null)
			ts_start = last_unit_ts(unit, times, 10);

		return new Promise((resolve) => {
			try {
				let collection = mongo.db(config.mongo.db.aggregation).collection('by_'+_unit);

				if (times == null) {
					collection.drop();
					console.log("dropped aggregations."+_unit);
					resolve();
				} else {
					collection
						.find()
						.project({ _id: 1, block_min: 1, block_max: 1 })
						.sort({ts: -1})
						.limit(times)
						.toArray(async (err, res) => {
							try {
								del_block_min = res[res.length-1].block_min;		// most lowest block
								del_block_max = res[0].block_max;					// most highest block
								await collection.deleteMany({ _id: { $in: res.map(_ => _._id) } }).then((result, err) => {
									console.log("deleted aggregations."+_unit+":", result.deletedCount, err);
									resolve();
								});
							} catch (e) {
								console.error(e);
								resolve();
							}
						});
				}
			} catch (err) { /*console.error(err); */resolve(); }
		}).then(() => {
			console.log("resetting blocks... ", _unit, del_block_min, del_block_max);
			return blocks.updateMany({ number: { $gte: del_block_min, $lte: del_block_max } }, {$set: {['__aggregated.by_'+_unit]: false}}).then((result, err) => {
				console.log("reseted aggregations."+_unit+":", result.modifiedCount, err);
			});
		});
	})).then(() => {
		console.log("reset fin");
	});
}

async function run (unit = null) {
	const t_start = now();

	// avoid parallel calls, instead chain them
	return run_promise = run_promise.then(_run);

	async function _run () {
		// parellel: aggregate all timespan units
		return Promise.all(Object.keys(units).map(_unit => {
			//return execShellCommand("node aggregate.js "+_unit);
			return aggregate_all(_unit);
		})).then(async () => {
			// create/ensure indexes
			if (!indexes_ensured) {
				await ensure_indexes();
				indexes_ensured = true;
			}

			console.log("Aggregation took", now() - t_start);
		});
	}
}

async function aggregate_all (unit) {
	const t_start = now();

	let total_new_blocks = 0;

	// aggregate until no more new blocks
	while (1) {
		let {new_blocks} = await aggregate_process_blocks(unit);		// limits new blocks to max_blocks_per_aggregation
		console.log();
		total_new_blocks += new_blocks;
		if (new_blocks == 0) break;
	}

	console.log("aggregated, new blocks:", total_new_blocks, unit, "took", now() - t_start);

	return Promise.resolve({new_blocks: total_new_blocks});
}

async function aggregate_process_blocks (unit) {
	const t_start = now();

	// prepare chunks of timespan units based on new blocks
	const new_blocks = await getBlocksByAggregated(unit, max_blocks_per_aggregation);

	console.log("new_blocks: ", new_blocks.map(_ => _.number));

	if (new_blocks.length == 0)
		return Promise.resolve({new_blocks: 0});

	const chunks = await chunkAggregationByBlockUnit(new_blocks, unit);

	console.log(unit+": Clustered "+new_blocks.length+" blocks ("+new_blocks[0].number+" ... "+new_blocks[new_blocks.length-1].number+") into", Object.keys(chunks).length, "chunks");

	// chunk by chunk / sequential & asynchronious
	const p = Object.entries(chunks).reduce(async (previousPromise, chunk) => {
		await previousPromise;		// wait previous chunk to finish
		return aggregate_unit(unit, parseInt(chunk[0]), chunk[1]);			// aggregate chunk
	}, Promise.resolve());

	return p.then(async (_) => {
		const bulk = new_blocks.map(block => {
			return { updateOne: { filter: { number: block.number }, update: { $set: { ['__aggregated.by_'+unit]: true } } } };
		});

		console.log('bulk update:', bulk.map(_ => _.updateOne));

		// update all new blocks __aggregated.by_ object
		await mongo.db(config.mongo.db.sync).collection('blocks').bulkWrite(bulk).then((result, err) => {
			console.log('flagged blocks as aggregated', unit, result.modifiedCount);
		});

		console.log("aggregate_process_blocks() done, new_blocks: ", new_blocks.length);

		return {new_blocks: new_blocks.length}
	});
}

async function chunkAggregationByBlockUnit (blocks, unit) {
	const chunks = {};

	if (!blocks || blocks.length == 0) return Promise.resolve(chunks);

	// from/to timespan
	let from = unit_ts(blocks[0].timestamp, unit);
	let to = unit_ts(blocks[blocks.length-1].timestamp, unit);

	// chunk blocks by timespan/unit
	let b, ts;
	for (let key in blocks) {
		b = blocks[key];
		ts = unit_ts(b.timestamp, unit);

		// init chunk
		if (chunks[ts] === undefined)
			chunks[ts] = { blocks: [], min: null, max: null, aggregated: null };

		// min/max/block
		if (chunks[ts].min === null || chunks[ts].min > b.number) chunks[ts].min = b.number;
		if (chunks[ts].max === null || chunks[ts].max < b.number) chunks[ts].max = b.number;
		chunks[ts].blocks.push(b);
	}

	// load aggregated data for each chunk
	const aggregations = await getAggregatedUnitByTime(from, to, unit);
	for (let key in aggregations) {
		if (!chunks[aggregations[key].ts])
			continue;

		chunks[aggregations[key].ts].aggregated = aggregations[key];

		// make sure, to not double aggregate a block into exiting aggregation
		let overlaps = [];
		chunks[aggregations[key].ts].blocks.forEach((block,i) => {
			if (block.number >= aggregations[key].block_min && block.number <= aggregations[key].block_max)
				overlaps.push({block, aggregation: aggregations[key]});
		});
		if (overlaps.length) {
			// this is not necessary a problem, because these blocks ARE definetly not aggregated for this unit, so they are missing
			// beside, the check is not 100% solid, anytime a block can be missed and then would overlap automatically as soon as synced
			//console.error("ERROR: overlap of aggregated blocks with new blocks!!", overlaps, unit);//throw "NOT FULLY IMPLEMENTED: make sure, to not double aggregate a block into exiting aggregation"
			//debugger;

			// what should be improved: when a block signed as aggregated but due to any reasons not aggregated, a rejection whatever
		}
	}

	return Promise.resolve(chunks);
}

async function aggregate_unit (unit, ts, chunk) {
	const t_start = now();

	return new Promise(async function (resolve, reject) {
		const aggregate_tpl = {
			block_min: null,			// block number
			block_max: null,				// block number
			blocks_mined: 0,
			blocks_impeached: 0,
			transactions_count: 0,
			transactions_volume: 0,
			transactions_fee: 0,
			transactions_sender: {},
			transactions_receiver: {},
			rnodes: {},
			ts,
			_incomplete: false,
			_blocks_aggregated: 0,
			_blocks_aggregate_should: config.cpc.should_blocks_per_unit[unit]
		};

		const rnode_tpl = {
			mined: 0,
			impeached: 0,
			balance: 0,
			rewards_from_fixed: 0,
			rewards_from_fee: 0,
			rewards: 0,
			rpt_max: 0,
			rpt_min: 0,
			//locked_cpc: 0,
			//rewards_cpc_estimated: 0
		};

		// aggregate by unit, use allready aggreated data (if exists)
		const aggregate = Object.assign(clone(aggregate_tpl), chunk.aggregated || {});

//debugger;

		// BLOCKS
		let b, t, m, bnum, _balance;
		for (let key in chunk.blocks) {
			b = chunk.blocks[key];
			m = b.__proposer;
			bnum = b.number;
			t = moment.utc(b.timestamp);

			// block_min/max (number)
			if (aggregate.block_min === null || aggregate.block_min > bnum) aggregate.block_min = bnum;
			if (aggregate.block_max === null || aggregate.block_max < bnum) aggregate.block_max = bnum;

			// transactions count
			aggregate.transactions_count += b.transactions.length;

			// transactions volume, fee
			let trx_volume = 0, trx_fee = 0;
			try {
				const _trx = await transactionsVolumeFee(b.transactions);
				trx_volume = _trx.volume;
				trx_fee = _trx.fee;
				aggregate.transactions_volume += trx_volume;
				aggregate.transactions_fee += trx_fee;
			} catch (err) {
				console.error(err);
				aggregate._incomplete = true;
			}

			// transactions unique sender/receiver count
			try {
				await mergeTransactionsSenderReceiver(b.transactions, aggregate);
			} catch (err) {
				console.error(err);
				aggregate._incomplete = true;
			}

			// init rnode proposer
			if (!aggregate.rnodes) aggregate.rnodes = {};
			if (!aggregate.rnodes[m]) aggregate.rnodes[m] = clone(rnode_tpl);
			if (b.__impeached) aggregate.rnodes[m].impeached++;								// impeached
			if (!b.__impeached) aggregate.rnodes[m].mined++;								// or mined
			try {
				aggregate.rnodes[m].balance = (await balances.getByUnit(m, unit, ts)) || (await balances.latest(m));		// rnode balance cpc
			} catch (e) {
				aggregate.rnodes[m].balance = await balances.latest(m);
			}
			if (!b.__impeached) {				// rnode rewards, fixed, fees
				aggregate.rnodes[m].rewards_from_fixed += config.cpc.rewardsPerBlock;
				aggregate.rnodes[m].rewards_from_fee += trx_fee;
				aggregate.rnodes[m].rewards += config.cpc.rewardsPerBlock + trx_fee;
			}

			// all rnodes RPT of current block time
			const rpts = await data_rnodes.last_rpt(null, b.timestamp);
			if (!rpts || rpts.length == 0) console.error("aggregate: missing rpts");
			else {
				for (let i in rpts) {
					let _rpt = rpts[i];

					if (!_rpt || !_rpt.address || !_rpt.rpt) continue;

					// store RPT only on rnodes being registered (and having mined or impeached blocks!). We dont want 0-block entries each unit, which is expensive for rewards calculations
					if (aggregate.rnodes[_rpt.address]) {
						aggregate.rnodes[_rpt.address].rpt_max = Math.max(aggregate.rnodes[_rpt.address].rpt_max, _rpt.rpt);
						aggregate.rnodes[_rpt.address].rpt_min = Math.min(aggregate.rnodes[_rpt.address].rpt_min, _rpt.rpt);
					}
				}
			}

			// blocks total / impeached
			if (!b.__impeached) aggregate.blocks_mined++;
			else aggregate.blocks_impeached++;

			aggregate._blocks_aggregated++;
		}

		// SYNC MONGO
		// insert/update aggregation
		delete aggregate._id;		// delete mongo internal _id object reference
		const collection = mongo.db(config.mongo.db.aggregation).collection('by_'+unit);
		await collection.updateOne({ts}, { $set: aggregate }, { upsert: true });

		//console.log('Aggregated unit ('+aggregate.block_min+'-'+aggregate.block_max+') '+ts+' (by '+unit+') done in ', now() - t_start);
		resolve();
	});
}

async function getStoredBlocksMinMax () {
	return await new Promise(function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('blocks')
			.aggregate([
				{ "$group": {
					"_id": null,
					"max": { "$max": "$number" },
					"min": { "$min": "$number" }
				}}
			])
			.toArray((err, _) => {
				if (err) reject(err);
				else if (_.length == 0) resolve({min: null, max: null});
				else resolve({min: _[0].min, max: _[0].max});
			})
		;
	});
}

async function getAggregatedBlocksMinMax (unit) {
	return await new Promise(function (resolve, reject) {
		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate([
				{ "$group": {
					"_id": null,
					"max": { "$max": "$block_max" },
					"min": { "$min": "$block_min" }
				}}
			])
			.toArray((err, _) => {
				if (err) reject(err);
				else if (_.length == 0) resolve({min: null, max: null});
				else resolve({min: _[0].min, max: _[0].max});
			})
		;
	});
}

async function getBlocksByTime (from, to) {
	// from, to (13 digit timestamp)
	from = convert_ts(from, 13);
	to = convert_ts(to, 13);

	return await new Promise(function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('blocks')
			.find({timestamp: {$gte: from, $lte: to}})
			//.sort({timestamp: 1})
			.toArray((err, blocks) => {
				if (err) reject(err);
				resolve(blocks);
			})
		;
	});
}

async function getBlocksByNumber (min, max) {
	return await new Promise(function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('blocks')
			.find({number: {$gte: min, $lte: max}})
			.sort({timestamp: 1})
			.toArray((err, blocks) => {
				if (err) reject(err);
				resolve(blocks);
			})
		;
	});
}

async function getBlocksByAggregated (unit, limit) {
	const t_start = now();

	return await new Promise(function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('blocks')
			.find({ ['__aggregated.by_'+unit]: false })
			.sort({number: 1})
			.limit(limit)
			.toArray((err, blocks) => {
				console.log("getBlocksByAggregated("+unit+", "+limit+"): got:",blocks.length," in", now() - t_start);

				if (err) console.error(err);
				resolve(blocks || []);
			})
		;
	});
}

async function getAggregatedUnitByTime (from, to, unit) {
	from = convert_ts(from, 10);
	to = convert_ts(to, 10);

	return await new Promise(function (resolve, reject) {
		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.find({ts: {$gte: from, $lte: to}})
			.sort({timestamp: 1})
			.toArray((err, blocks) => {
				if (err) reject(err);
				resolve(blocks);
			})
		;
	});
}

async function transactionsVolumeFee (transactions) {
	const t_start = now();

	if (!(transactions instanceof Array))
		transactions = [transactions];

	if (transactions.length == 0)
		return Promise.resolve({volume: 0, fee: 0});

	const collection = mongo.db(config.mongo.db.sync).collection('transactions');

	//console.log("calculating volume of", transactions.length, "transactions");

	return new Promise ((resolve, reject) => {
		collection.aggregate([
			{ $match: { hash: {$in: transactions} } },
			{ $project: { _id:1, value: { $divide: [ "$value", config.cpc.unit_convert ] }, fee: { $divide: [ { $multiply: [ "$gas", "$gasPrice" ] }, config.cpc.unit_convert ] } } },
			{ $group: { _id: null, volume: { $sum: "$value" }, fee: { $sum: "$fee" } } },
		]).toArray((err, value) => {
			//console.log("sum volume of", transactions.length, "transactions, took", now()-t_start);

			if (err) throw err;
			if (value === null) throw 'getTransaction('+txn+') unknown error: empty err and null value';
			if (!(value instanceof Array) || value.length == 0) return resolve({volume: 0, fee: 0});
			resolve({volume: value[0].volume, fee: value[0].fee});
		});
	});
}

async function mergeTransactionsSenderReceiver (transactions, aggregate) {
	const t_start = now();

	if (!(transactions instanceof Array))
		transactions = [transactions];

	if (transactions.length == 0)
		return Promise.resolve();

	const collection = mongo.db(config.mongo.db.sync).collection('transactions');

	await _count('from', aggregate.transactions_sender);
	await _count('to', aggregate.transactions_receiver);

	return Promise.resolve();

	async function _count (what, mergeInto) {
		return new Promise ((resolve, reject) => {
			collection.aggregate([
				{ $match: { hash: { $in: transactions } } },
				//{ $project: { _id:1, value:1, trx_fee: { $multiply: [ "$gas", "$gasPrice" ] } } },
				{ $project: { _id:1, from:1, to:1, value:1, gasPrice: { $divide: [ "$gasPrice", config.cpc.unit_convert ] }, fee: { $divide: [ { $multiply: [ "$gas", "$gasPrice" ] }, config.cpc.unit_convert ] } } },
				{ $group: {
					_id: '$'+what,
					count: {
						$sum: 1
					},
					volume: {
						$sum: '$value'
					},
					fee: { $sum: '$fee' },
					//price_avg: { $avg: '$gasPrice' }
				} },
			]).toArray((err, value) => {
				//console.log("count/volume "+what+" of transactions took", now()-t_start);

				value.forEach(_ => {
					// init if no previous state
					if (!mergeInto[_._id]) mergeInto[_._id] = {count: 0, volume: 0, fee: 0};

					// cummulate
					mergeInto[_._id].count += _.count;
					mergeInto[_._id].volume += _.volume;
					mergeInto[_._id].fee += _.fee;
				});

				resolve();
			});
		});
	}

}

async function ensure_indexes () {
	const t_start = now();

	return Promise.all(Object.keys(units).map(unit => {
		// CREATE INDEXES FOR AGGREGATIONS
		const collection = mongo.db(config.mongo.db.aggregation).collection('by_'+unit);

		return collection.indexInformation((err, indexes) => {
			if (err) return;
			if (!indexes.ts_1)
				return collection.createIndex({ ts: 1 }, { unique: true });
		});
	})).then(() => {
		console.log("Ensured indexes took", now() - t_start);
	});
}



async function test (unit) {
	// minute(s) vs hour
	const db_hour = await mongo.db(config.mongo.db.aggregation).collection('by_hour');

	try {
		await test_unit('hour', 'minute');
		await test_unit('day', 'minute');
		await test_unit('month', 'minute');
		await test_unit('year', 'minute');
	} catch (err) {
		console.error('aggregate test failed, un-equal units for', err);
	}
}

async function test_unit (unit, vsUnit) {
	const db_unit = await mongo.db(config.mongo.db.aggregation).collection('by_'+unit);
	const db_vsUnit = await mongo.db(config.mongo.db.aggregation).collection('by_'+vsUnit);

	return new Promise((resolve, reject) => {
		db_unit.find().toArray(async (err, units) => {
			for (let i in units) {
				try {
					await _test_unit(unit, vsUnit, units[i]);
				} catch (err) {
					console.error('aggregate test failed, un-equal units for', unit, 'vs', vsUnit, units);
				}
			}

			resolve();
		});
	});

	async function _test_unit (unit, vsUnit, doc) {
		let h = doc;
		let h_ts_max = moment.utc(h.ts*1000);
		h_ts_max.add(1, unit);

		console.log('=======================================');
		console.log(unit+':', moment.utc(h.ts*1000).toISOString(), "-", h_ts_max.toISOString());

		return new Promise(async (resolve, reject) => {
			db_vsUnit.find({ts: {$gte: h.ts, $lt: h_ts_max.unix()}}).sort({ts:1}).limit(60).toArray((err, vsUnits) => {
				console.log(vsUnit+":", vsUnits.length);


				// RNODES
				const rnodes_merged = {};

				// collect rnodes and merge manually
				vsUnits.forEach(min => {
					Object.entries(min.rnodes).forEach(_ => {

						let addr = _[0];
						let val = _[1];

						//addr = web3.utils.toChecksumAddress(addr);

						if (!rnodes_merged[addr])
							rnodes_merged[addr] = val;
						else {
							rnodes_merged[addr].mined += val.mined;
							rnodes_merged[addr].impeached += val.impeached;
							rnodes_merged[addr].proposer += val.proposer;
						}
					});
				});

				// compare
				const addr_merged = Object.keys(rnodes_merged);
				const has_all = Object.keys(h.rnodes).filter(r => addr_merged.includes(r)).length;
				const eq = JSON.stringify(h.rnodes) == JSON.stringify(rnodes_merged);

				console.log(unit+' vs '+vsUnit+' Rnodes present:', Object.keys(h.rnodes).length == has_all);
				console.log(unit+' vs '+vsUnit+' Rnodes equal:', eq);

				if (!eq) Object.keys(h.rnodes).forEach(h_addr => {
					let rnode = h.rnodes[h_addr];
					let rnode_merged = rnodes_merged[h_addr];
					let eq = JSON.stringify(rnode) == JSON.stringify(rnode_merged);
					if (!eq) console.log(rnode,'vs',rnode_merged);
				});

				if (eq)
					resolve(eq);
				else
					reject();
			});
		});
	}
}