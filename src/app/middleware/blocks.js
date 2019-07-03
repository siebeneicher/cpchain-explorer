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
				console.log("blocks.squared took:", now() - t_start);

				const sec_per_block = config.cpc.block_each_second;
				const from_ = convert_ts(ts,13);
				const to_ = convert_ts(moment.utc(ts).add(1, unit).unix(), 13);

				// build block structure from unit start to end
				const must_blocks = (to_ - from_) / 1000 / sec_per_block;		// 10 blocks / second
				const _blocks = [];

				for (let i = 0; i < must_blocks; i++) {
					const assumed_time = from_+(i*sec_per_block*1000);
					const time_pretty = moment.utc(assumed_time).format('HH:mm:ss');

					// make sure we find block even with timestamp not matching
					const find_block = data.filter(_ => _.timestamp >= assumed_time && !(_.timestamp > (config.cpc.block_each_second*1000)+assumed_time));
					const block = find_block.length ? find_block[0] : {number: calculate_future_block_number(last_synced_block, assumed_time), impeached: null};
					block.synced = !!find_block.length;

					if (block.synced) {
						block.impeached = block.miner == "0x0000000000000000000000000000000000000000";
					} else {
						block.timestamp = assumed_time;
					}

					block.i = i;
					block.time_pretty = time_pretty;

					_blocks.push(block);
				}

				redis.set(squared.cache_key(unit, ts), _blocks);
				redis.expire(squared.cache_key(unit, ts), CACHE_EXPIRE_FOREVER);

				resolve(_blocks);
			});
		}
	}
}

module.exports = {squared};
