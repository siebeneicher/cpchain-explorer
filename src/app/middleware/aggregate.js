const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {convert_ts, clone} = require('../helper');
const now = require('performance-now');
const moment = require('moment');

const units = {
	'minute': {},
	'hour': {},
	'day': {},
	'month': {},
	'year': {}
};

const max_blocks_per_aggregation = 2000;		// limit blocks per aggregation, specially when aggregating from 0

module.exports = async function run () {
	// sequential aggregate all units
	return Object.keys(units).reduce(async (previousPromise, unit) => {
		await previousPromise;		// wait previous chunk to finish
		return aggregate_all(unit);
	}, Promise.resolve());
}

async function aggregate_all (unit) {
	let total_new_blocks = 0;

	// aggregate until no more new blocks
	while (1) {
		let {new_blocks} = await aggregate_process(unit);
		total_new_blocks += new_blocks;
		if (new_blocks == 0) break;
	}

	console.log("Aggregated all ("+unit+"), new blocks:", total_new_blocks);

	return Promise.resolve({new_blocks: total_new_blocks});
}

async function aggregate_process (unit) {
	const t_start = now();

	// get min/max block numbers stored
	const {min: stored_min, max: stored_max} = await getStoredBlocksMinMax();

	// get min/max block numbers aggregated
	const {min: aggregated_min, max: aggregated_max} = await getAggregatedBlocksMinMax(unit);

	console.log('Found stored blocks min/max: '+stored_min+'/'+stored_max);
	console.log('Found aggregated blocks min/max: '+aggregated_min+'/'+aggregated_max);

	// no new blocks, everything aggregated yet
	if (stored_max == aggregated_max)
		return Promise.resolve({stored_min, stored_max, aggregated_min, aggregated_max, new_blocks: 0});

	// load all stored blocks ahead in time, to cluster timespan units
	const new_block_min = aggregated_max == null ? stored_min : aggregated_max + 1;

	// prepare chunks of timespan units based on new blocks
	const new_blocks = await getBlocksByNumberLimit(new_block_min, max_blocks_per_aggregation);
	const chunks = await chunkAggregationByBlockUnit(new_blocks, unit);

	console.log("max_blocks_per_aggregation:", max_blocks_per_aggregation);
	console.log("Clustered blocks (min: "+new_block_min+") into", Object.keys(chunks).length, "chunks");

	// chunk by chunk / sequential & asynchronious
	const p = Object.entries(chunks).reduce(async (previousPromise, chunk) => {
		await previousPromise;		// wait previous chunk to finish
		return aggregate_unit(unit, parseInt(chunk[0]), chunk[1]);			// aggregate chunk
	}, Promise.resolve());

	return p.then(_ => {
		return {stored_min, stored_max, aggregated_min, aggregated_max, new_blocks: new_blocks.length}
	});
}

async function chunkAggregationByBlockUnit (blocks, unit) {
	const chunks = {};

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

	// load aggreated data for each chunk
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
			throw "NOT FULLY IMPLEMENTED: make sure, to not double aggregate a block into exiting aggregation"
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
			rnodes: [],
			ts
		};

		// aggregate by unit, use allready aggreated data (if exists)
		const aggregate = Object.assign(aggregate_tpl, chunk.aggregated || {});

		// BLOCKS
		let b, t, m, is_impeached;
		for (let key in chunk.blocks) {
			b = chunk.blocks[key];
			m = b.miner;
			t = moment(b.timestamp);
			is_impeached = m == '0x0000000000000000000000000000000000000000';

			// block_min/max (number)
			if (aggregate.block_min === null || aggregate.block_min > b.number) aggregate.block_min = b.number;
			if (aggregate.block_max === null || aggregate.block_max < b.number) aggregate.block_max = b.number;

			// Blocks mined by node
			if (aggregate.blocks_mined_by_node[m] === undefined) aggregate.blocks_mined_by_node[m] = 0;
			aggregate.blocks_mined_by_node[m]++;

			// blocks total / impeached
			if (!is_impeached) aggregate.blocks_mined++;
			else aggregate.blocks_impeached++;

			// transactions count
			aggregate.transactions_count += b.transactions.length;

			// transactions volume
			//let trxs = await mongo.db(config.mongo.db.chain).collection('transactions').find().toArray();

			// rnode count
			if (!is_impeached && !aggregate.rnodes.includes(m)) aggregate.rnodes.push(m);
		}

		// SYNC MONGO
		// insert/update aggregation
		delete aggregate._id;		// delete mongo internal _id object reference
		const collection = mongo.db(config.mongo.db.aggregation).collection('by_'+unit);
		await collection.updateOne({ts}, { $set: aggregate }, { upsert: true });

		console.log('Aggregated unit ('+aggregate.block_min+'-'+aggregate.block_max+') '+ts+' (by '+unit+') done in ', now() - t_start);
		resolve();
	});
}

async function getStoredBlocksMinMax () {
	return await new Promise(function (resolve, reject) {
		mongo.db(config.mongo.db.chain).collection('blocks')
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
		mongo.db(config.mongo.db.chain).collection('blocks')
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
		mongo.db(config.mongo.db.chain).collection('blocks')
			.find({number: {$gte: min, $lte: max}})
			.sort({timestamp: 1})
			.toArray((err, blocks) => {
				if (err) reject(err);
				resolve(blocks);
			})
		;
	});
}

async function getBlocksByNumberLimit (min, limit) {
	return await new Promise(function (resolve, reject) {
		mongo.db(config.mongo.db.chain).collection('blocks')
			.find({number: {$gte: min}})
			.sort({timestamp: 1})
			.limit(limit)
			.toArray((err, blocks) => {
				if (err) reject(err);
				resolve(blocks);
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