const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const balances = require('../data/balances');
const {convert_ts, clone, unique_array, unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const {blockNumber, rnodes, versions, generation, block, transaction, balance, web3} = require('../../cpc-fusion/api');

const units = {
	'minute': {},
	'hour': {},
	'day': {},
	//'week': {},
	'month': {},
	'year': {}
};

const fetch_balance_enabled = true;
const max_blocks_per_aggregation = 500;		// limit blocks per aggregation, specially when aggregating from 0
const cpc_digits = parseInt(1+("0".repeat(18)));

if (!fetch_balance_enabled) console.warn("warn: fetching balance is disabled");

let run_promise = Promise.resolve();		// keep promise to chain run() calls and avoid parallelism




module.exports = {run, reset, test};



async function reset () {
	const blocks = await mongo.db(config.mongo.db.sync).collection('blocks');

	await mongo.db(config.mongo.db.aggregation).dropDatabase();

	return blocks.updateMany({}, {$set: {
		'__aggregated.by_minute': false,
		'__aggregated.by_hour': false,
		'__aggregated.by_day': false,
		'__aggregated.by_month': false,
		'__aggregated.by_year': false,
	}}).then((result, err) => {
		console.log("reset all blocks for aggregation:", result.modifiedCount, err);
	});
}

async function run () {
	const t_start = now();

	// avoid parallel calls, instead chain them
	return run_promise = run_promise.then(_run);

	async function _run () {
		// sequential aggregate all timespan units
		const result = await Object.keys(units).reduce(async (previousPromise, unit) => {
			await previousPromise;		// wait previous chunk to finish
			return aggregate_all(unit);
		}, Promise.resolve());

		// create/ensure indexes
		await ensure_indexes();

		console.log("Aggregation took", now() - t_start);

		return result;
	}
}

async function aggregate_all (unit) {
	const t_start = now();

	let total_new_blocks = 0;

	// aggregate until no more new blocks
	while (1) {
		let {new_blocks} = await aggregate_process_blocks(unit);		// limits new blocks to max_blocks_per_aggregation
		total_new_blocks += new_blocks;
		if (new_blocks == 0) break;
	}

	console.log(unit+": aggregated, new blocks:", total_new_blocks, "took", now() - t_start);

	return Promise.resolve({new_blocks: total_new_blocks});
}

async function aggregate_process_blocks (unit) {
	const t_start = now();

	// prepare chunks of timespan units based on new blocks
	const new_blocks = await getBlocksByAggregated(unit, max_blocks_per_aggregation);

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

		// update all new blocks __aggregated.by_ object
		await mongo.db(config.mongo.db.sync).collection('blocks').bulkWrite(bulk).then((result, err) => {
			//console.log('flagged blocks to be aggregated', result.modifiedCount);
		});

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
		if (chunks[ts].max === null || chunks[ts].max > b.number) chunks[ts].max = b.number;
		chunks[ts].blocks.push(b);
	}

//debugger;

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
				overlaps.push(i);
		});
		if (overlaps.length)
			;//throw "NOT FULLY IMPLEMENTED: make sure, to not double aggregate a block into exiting aggregation"
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
			blocks_mined_by_node: {},
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
			proposer: 0,
			balance: null,
			//locked_cpc: 0,
			//rewards_cpc_estimated: 0
		};

		// aggregate by unit, use allready aggreated data (if exists)
		const aggregate = Object.assign(clone(aggregate_tpl), chunk.aggregated || {});

//debugger;

		// BLOCKS
		let b, t, m, is_impeached, gen, proposer, bnum, _balance;
		for (let key in chunk.blocks) {
			b = chunk.blocks[key];
			m = b.miner;
			bnum = b.number;
			t = moment.utc(b.timestamp);
			gen = b.__generation || null;
			proposer = gen ? gen.Proposers[gen.View] : null;
			is_impeached = m == '0x0000000000000000000000000000000000000000';

			_balances = await (async () => {
				if (!fetch_balance_enabled) return null;
				if (proposer === null && is_impeached) return null;
				try {
					async function __balance (addr) {
						if (!addr)
							return null;
						let b = await balances.getByUnit(addr, unit, ts);
						if (b === null)
							b = await balances.latest(addr);
						return b;
					}

					return {
						proposer: await __balance(proposer),
						miner: await __balance(m)
					};
				} catch (err) {
					console.error(err);
					return null;
				}
			})();

			if (_balances === null) aggregate._incomplete = true;
			if (proposer === null) aggregate._incomplete = true;

			// block_min/max (number)
			if (aggregate.block_min === null || aggregate.block_min > bnum) aggregate.block_min = bnum;
			if (aggregate.block_max === null || aggregate.block_max < bnum) aggregate.block_max = bnum;

			// transactions count
			aggregate.transactions_count += b.transactions.length;

			// transactions volume, fee
			try {
				const {volume: trx_volume, fee: trx_fee} = await transactionsVolumeFee(b.transactions);
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

			// init miner & proposer
			if (!aggregate.rnodes[m]) aggregate.rnodes[m] = clone(rnode_tpl);
			if (proposer && !aggregate.rnodes[proposer]) aggregate.rnodes[proposer] = clone(rnode_tpl);

			// rnode mined
			aggregate.rnodes[m].mined++;

			// proposer
			if (proposer) aggregate.rnodes[proposer].proposer++;

			// rnode impeached
			if (is_impeached) {
				if (proposer) {
					aggregate.rnodes[proposer].impeached++;
				}
			}

			// rnode balance cpc
			if (_balances !== null && _balances.miner !== null) aggregate.rnodes[m].balance = _balances.miner;
			if (_balances !== null && _balances.proposer !== null) aggregate.rnodes[proposer].balance = _balances.proposer;

			// rnode locked cpc
			// TODO

			// blocks total / impeached
			if (!is_impeached) aggregate.blocks_mined++;
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
	return await new Promise(function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('blocks')
			.find({ ['__aggregated.by_'+unit]: false })
			.sort({timestamp: 1})
			.limit(limit)
			.toArray((err, blocks) => {
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

	console.log("calculating volume of", transactions.length, "transactions");

	return new Promise ((resolve, reject) => {
		collection.aggregate([
			{ $match: { hash: {$in: transactions} } },
			{ $project: { _id:1, value: { $divide: [ "$value", config.cpc.unit_convert ] }, fee: { $divide: [ { $multiply: [ "$gas", "$gasPrice" ] }, config.cpc.unit_convert ] } } },
			{ $group: { _id: null, volume: { $sum: "$value" }, fee: { $sum: "$fee" } } },
		]).toArray((err, value) => {
			console.log("sum volume of", transactions.length, "transactions, took", now()-t_start);

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
				console.log("count/volume "+what+" of transactions took", now()-t_start);

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