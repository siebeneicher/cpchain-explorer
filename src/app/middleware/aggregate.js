const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {convert_ts, clone, unique_array} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const {blockNumber, rnodes, versions, generation, block, transaction, balance} = require('../../cpc-fusion/api');

const units = {
	'minute': {},
	'hour': {},
	'day': {},
	'month': {},
	'year': {}
};

const max_blocks_per_aggregation = 500;		// limit blocks per aggregation, specially when aggregating from 0
const cpc_digits = parseInt(1+("0".repeat(18)));
const cpc_reward_per_block = 12.65;



module.exports = async function run () {
	const t_start = now();

	// sequential aggregate all timespan units
	const result = await Object.keys(units).reduce(async (previousPromise, unit) => {
		await previousPromise;		// wait previous chunk to finish
		return aggregate_all(unit);
	}, Promise.resolve());

	// create/ensure indexes
	await ensure_indexes();

	console.log("Run aggregation took", now() - t_start);

	return result;
}

async function aggregate_all (unit) {
	const t_start = now();

	let total_new_blocks = 0;

	// aggregate until no more new blocks
	while (1) {
		let {new_blocks} = await aggregate_process(unit);
		total_new_blocks += new_blocks;
		if (new_blocks == 0) break;
	}

	console.log(unit+": aggregated, new blocks:", total_new_blocks, "took", now() - t_start);

	return Promise.resolve({new_blocks: total_new_blocks});
}

async function aggregate_process (unit) {
	const t_start = now();

/*	// get min/max block numbers stored
	const {min: stored_min, max: stored_max} = await getStoredBlocksMinMax();

	// get min/max block numbers aggregated
	const {min: aggregated_min, max: aggregated_max} = await getAggregatedBlocksMinMax(unit);

	console.log('Found stored blocks min/max: '+stored_min+'/'+stored_max);
	console.log('Found aggregated blocks min/max: '+aggregated_min+'/'+aggregated_max);

	// no new blocks, everything aggregated yet
	if (stored_max == aggregated_max)
		return Promise.resolve({stored_min, stored_max, aggregated_min, aggregated_max, new_blocks: 0});

	// load all stored blocks ahead in time, to cluster timespan units
	const new_block_min = aggregated_max == null ? stored_min : aggregated_max + 1;*/

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
	let from = blocksUnitTs(blocks[0], unit);
	let to = blocksUnitTs(blocks[blocks.length-1], unit);

	// chunk blocks by timespan/unit
	let b, ts;
	for (let key in blocks) {
		b = blocks[key];
		ts = blocksUnitTs(b, unit);

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
			transactions_volume: 0,		// TODO
			rnodes: {},
			ts,
			_incomplete: false
		};

		const rnode_tpl = {
			mined: 0,
			impeached: 0,
			proposer: 0,
			balance_first: 0,
			balance_last: 0,
			balances: [],
			locked_cpc: 0,
			rewards_cpc_estimated: 0
		};

		// aggregate by unit, use allready aggreated data (if exists)
		const aggregate = Object.assign(aggregate_tpl, chunk.aggregated || {});
//debugger;
		// BLOCKS
		let b, t, m, is_impeached, gen, proposer, bnum, balance;
		for (let key in chunk.blocks) {
			b = chunk.blocks[key];
			m = b.miner;
			bnum = b.number;
			t = moment(b.timestamp);
			gen = b.__generation || null;
			proposer = gen ? gen.Proposers[gen.View] : null;
			is_impeached = m == '0x0000000000000000000000000000000000000000';
			balance = await (async () => {
				if (proposer === null) return null;
				try {
					let b = await balances(proposer, bnum);
				} catch (err) {
					console.error(err);
					return null;
				}
				if (b && b.length && b[0] !== null) return b[0];
				return null;
			})();

			if (balance === null) aggregate._incomplete = true;
			if (proposer === null) aggregate._incomplete = true;

			// block_min/max (number)
			if (aggregate.block_min === null || aggregate.block_min > bnum) aggregate.block_min = bnum;
			if (aggregate.block_max === null || aggregate.block_max < bnum) aggregate.block_max = bnum;

			// transactions count
			aggregate.transactions_count += b.transactions.length;

			// transactions volume
			try {
				aggregate.transactions_volume = await transactionsVolume(b.transactions);
			} catch (err) {
				console.error(err);
				aggregate.transactions_volume = null;		// error
				aggregate._incomplete = true;
			}

			// init miner & proposer
			if (!aggregate.rnodes[m]) aggregate.rnodes[m] = rnode_tpl;
			if (proposer && !aggregate.rnodes[proposer]) aggregate.rnodes[proposer] = rnode_tpl;

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
			if (proposer && balance !== null) {
				aggregate.rnodes[proposer].balances.push(balance);
				aggregate.rnodes[proposer].balances = unique_array(aggregate.rnodes[proposer].balances);

				if (aggregate.rnodes[proposer].balance_first === null) 
					aggregate.rnodes[proposer].balance_first = balance;

				aggregate.rnodes[proposer].balance_last = balance;
			}

			// rnode locked cpc
			// TODO

			// blocks total / impeached
			if (!is_impeached) aggregate.blocks_mined++;
			else aggregate.blocks_impeached++;
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

async function transactionsVolume (transactions) {
	if (!(transactions instanceof Array))
		transactions = [transactions];

	if (transactions.length == 0)
		return Promise.resolve(0);

	const collection = mongo.db(config.mongo.db.sync).collection('transactions');

	console.log("calculating transactions volume of", transactions.length, "transactions");

	collection.aggregate(
		{ $match: { hash: transactions, value: { $gt: 0 } } },
		{ $group: { _id: null, sum: { $sum: "$value" } } },
		//{ $project: { _id: 0, sum: 1 } }
	).toArray().then((value, err) => {
		console.log(value, err);
		if (err) throw err;
		if (value === null) throw 'getTransaction('+txn+') unknown error: empty err and null value';
		return value / cpc_digits;
	});
}

async function balances (nodes, blockNum) {
	if (!(nodes instanceof Array))
		nodes = [nodes];

	return Promise.all(nodes.map(async (node) => {
		return balance(node, blockNum).then((value, err) => {
			console.log(value, err);
			if (err) throw err;
			return value;
		});
	}));
}

function blocksUnitTs (block, unit) {
	// set time to start time of timespan
	t = moment(block.timestamp);

	if (unit == "minute") {
		t.seconds(0);
	}
	if (unit == "hour") {
		t.seconds(0);
		t.minutes(0);
	}
	if (unit == "day") {
		t.seconds(0);
		t.minutes(0);
		t.hours(0);
	}
	if (unit == "month") {
		t.seconds(0);
		t.minutes(0);
		t.hours(0);
		t.days(0);
	}
	if (unit == "year") {
		t.seconds(0);
		t.minutes(0);
		t.hours(0);
		t.days(0);
		t.month(0);
	}

	return parseInt(t.unix());				// 10 digit timestamp enough to cluster by unit
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