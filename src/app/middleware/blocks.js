const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {convert_ts, clone, unique_array, last_unit_ts, unit_ts, calculate_future_block_number} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const {blocks} = require('../data');

const CACHE_EXPIRE_FOREVER = 99999999999;			// redis cache lives forever, values are updated via aggregate.js

const squared = {
	update_promise_chain: Promise.resolve(),

	cache_key: function (unit, ts) {
		return 'CPC-DATA-BLOCKS-SQUARED_'+unit+'_'+ts;
	},
	get: async function (unit, ts, forceUpdate = false) {
		// sanitize parameters
		ts = unit_ts(ts, unit, 13);

		let data = await redis.get(squared.cache_key(unit, ts));

		if (!forceUpdate && data) console.log("Serving blocks.squared from redis");
		if (forceUpdate || !data)
			data = await squared.update(unit, ts);

		return data;
	},

	update: async function (unit, ts) {

		// avoid parallel calls, instead chain them
		return squared.update_promise_chain = squared.update_promise_chain.then(_update);

		async function _update () {
			return new Promise(async function (resolve, reject) {
				ts = unit_ts(ts, unit, 13);

				const ts_now = moment.utc().unix()*1000;

				// allways get last block, to eventually calculate future block numbers ahead
				const last_synced_block = await blocks.last();

				const t_start = now();
				const select = ['timestamp','number','transactions','miner'];
				const data = await blocks.byUnit(unit, ts, select);
				//console.log("blocks.squared took:", now() - t_start);

				const sec_per_block = config.cpc.block_each_second;
				const from_ = convert_ts(ts,13);
				const to_ = convert_ts(moment.utc(ts).add(1, unit).unix(), 13);

				// build block structure from unit start to end
				// must block idealy, because impeached blocks take 20secs instead of a single block
				const must_blocks_idealy = (to_ - from_) / 1000 / sec_per_block;		// 10 blocks / second
				const _blocks = [];

				let assumed_time, matched_block, time_pretty, block, next_block, next_block_timespan, count_impeached_blocks = 0;

				// its imperative that blocks in data are ordered via timestamp/number
				let i = -1;
				while (1) {
					i++;

					// we have to add impeached time for each found impeached block
					let impeached_block_time_extra = count_impeached_blocks * (config.cpc.block_impeached_second - config.cpc.block_each_second);

					// taking impeached blocks into account (taking 20secs)
					assumed_time = from_+(i*sec_per_block*1000)+(impeached_block_time_extra*1000);		// 13 digit ts
					time_pretty = moment.utc(assumed_time).format('HH:mm:ss');

					// end reached
					if (assumed_time >= to_) break;

					// we can not assume all blocks exist in database, so we have to individually pick the next block
					// impeached blocks take 20secs!

					// prepare next block to be assigned
					if (!next_block && data.length) {
						next_block = data.splice(0, 1)[0];

						delete next_block._id;
						next_block.impeached = next_block.miner == config.cpc.impeached_miner;
						next_block.timespan = next_block.impeached ? config.cpc.block_impeached_second : config.cpc.block_each_second;
						next_block.synced = true;
						next_block.trx_count = next_block.transactions ? next_block.transactions.length : 0;
						delete next_block.transactions;
					}


					if (next_block) {
						// block timestamp just need to fit into assumed timespan
						// next_block.timespan takes impeached blocks into account
						matched_block = (next_block.timestamp >= assumed_time && next_block.timestamp < assumed_time + (next_block.timespan*1000));
					} else {
					}


					block = matched_block ? next_block : {
						number: calculate_future_block_number(last_synced_block, assumed_time),
						impeached: null,
						synced: false,
						timestamp: assumed_time,
						trx_count: 0
					};

					block.i = i;
					block.time_pretty = time_pretty;

					if (matched_block) {
						// count impeached blocks to adjust assumed_time and time_pretty
						// count++ should be after block has been assigned, so assumed_time can be correct for future blocks
						if (next_block.impeached)
							count_impeached_blocks++;

						next_block = null;
						matched_block = false;
					}

					_blocks.push(block);
				}

				redis.set(squared.cache_key(unit, ts), _blocks);
				redis.expire(squared.cache_key(unit, ts), CACHE_EXPIRE_FOREVER);

				resolve(_blocks);
			});
		}
	}
}

async function get (number) {
	number = parseInt(number);

	return new Promise(async function (resolve, reject) {
		try {
			resolve(await blocks.get(number));
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err});
		}
	});
}

async function last (forceUpdate = false) {
	return new Promise(async function (resolve, reject) {
		try {
			let key = 'CPC-DATA-LAST-BLOCK';
			let cached = await redis.get(key);
			let block = forceUpdate ? await blocks.last() : cached || await blocks.last();

			if (!cached || forceUpdate) await redis.set(key, block);

			resolve(block);
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err});
		}
	});
}

module.exports = {squared, get, last};
