const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {balances, rnodes, blocks, rewards} = require('../data');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const kpi = require('./kpi');


const CACHE_EXPIRE_FOREVER = 99999999999;			// redis cache lives forever, values are updated via aggregate.js

const user = {
	update_promise_chain: Promise.resolve(),

	cache_key: function (addr) {
		return 'CPC-DATA-RNODES-USER_'+addr;
	},
	cache_flush_all: async function () {
		return redis.delPrefix('CPC-DATA-RNODES-USER_');
	},
	get: async function (addr, forceUpdate = false) {
		let data = await redis.get(user.cache_key(addr));

		if (!forceUpdate && data) console.log("Serving rnodes.user from redis");
		if (forceUpdate || !data)
			data = await user.update(addr);

		return data;
	},
	update: async function (addr) {
		// avoid parallel calls, instead chain them
		return user.update_promise_chain = user.update_promise_chain.then(_update);

		async function _update () {
			return new Promise(async function (resolve, reject) {
				const t_start = now();

				/*
				ROI / Year: 12.5% (rank)
				See blocks + trxs
				Industry/Team/Community RNode
				*/
				const rnode = {
					last_rpt: await rnodes.last_rpt(addr),		// incl. rank
					last_balance: await balances.latest(addr),
					last_blocks: {
						minute: {
							option: await kpi.options('last_blocks', 'minute'),
							data: await kpi.get('last_blocks', 'minute', {addr})
						},
						hour: {
							option: await kpi.options('last_blocks', 'hour'),
							data: await kpi.get('last_blocks', 'hour', {addr})
						},
						day: {
							option: await kpi.options('last_blocks', 'day'),
							data: await kpi.get('last_blocks', 'day', {addr})
						},
						month: {
							option: await kpi.options('last_blocks', 'month'),
							data: await kpi.get('last_blocks', 'month', {addr})
						},
						year: {
							option: await kpi.options('last_blocks', 'year'),
							data: await kpi.get('last_blocks', 'year', {addr})
						},
					},
					last_rewards: {
						hour: {
							option: await kpi.options('last_rewards', 'hour'),
							data: await kpi.get('last_rewards', 'hour', {addr})
						},
						day: {
							option: await kpi.options('last_rewards', 'day'),
							data: await kpi.get('last_rewards', 'day', {addr})
						},
						week: {
							option: await kpi.options('last_rewards', 'week'),
							data: await kpi.get('last_rewards', 'week', {addr})
						},
						month: {
							option: await kpi.options('last_rewards', 'month'),
							data: await kpi.get('last_rewards', 'month', {addr})
						},
						year: {
							option: await kpi.options('last_rewards', 'year'),
							data: await kpi.get('last_rewards', 'year', {addr})
						}
					},
					type: await rnodes.type(addr)
				};


				console.log('rnodes.user.update took', now()-t_start);
				//console.log(rnode);

				redis.set(user.cache_key(addr), rnode);
				redis.expire(user.cache_key(addr), CACHE_EXPIRE_FOREVER);

				resolve(rnode);
			});
		}
	}
}

const streamgraph = {
	update_promise_chain: Promise.resolve(),

	cache_key: function (unit, times, ts_start, options = {}) {
		return 'CPC-DATA-RNODES-STREAMGRAPH_'+unit+'_'+times+'_'+ts_start+'_'+JSON.stringify(options);
	},
	cache_flush_all: async function () {
		return redis.delPrefix('CPC-DATA-RNODES-STREAMGRAPH_');
	},
	get: async function (unit, times, ts_start = 'latest', options = {}, forceUpdate = false) {
		let data = await redis.get(streamgraph.cache_key(unit, times, ts_start, options));

		if (!forceUpdate && data) console.log("Serving rnodes.streamgraph from redis");
		if (forceUpdate || !data)
			data = await streamgraph.update(unit, times, ts_start, options);

		return data;
	},

	update: async function (unit, times, ts_start = 'latest', options = {}) {

		const target = options.target || 'mined';

		let ts = ts_start == 'latest' ? last_unit_ts(unit, times, 10) : unit_ts(ts_start, 10);

		// avoid parallel calls, instead chain them
		return streamgraph.update_promise_chain = streamgraph.update_promise_chain.then(_update);

		async function _update () {
			return new Promise(async function (resolve, reject) {
				const t_start = now();

				let items = await rnodes.items(unit, times, ts);

				if (!items || !items.length)
					resolve(null);

				// TODO: discard from node.js 11+
				require('array-flat-polyfill');
				let all_rnodes = [...new Set(items.flatMap(item => Object.keys(item.rnodes)))];	// unique list of rnodes
				let rnodes_sum = {};
				let max_val = 0;
				let max_total = 0;

				items.forEach(item => {
					let total = 0;

					Object.entries(item.rnodes).forEach(rnode => {

						const val = rnode[1][target];

						// flatten rnodes array down to item object
						item[rnode[0]] = val;

						// total per unit
						total += val;

						// sum per rnode
						if (!rnodes_sum[rnode[0]]) rnodes_sum[rnode[0]] = 0;
						rnodes_sum[rnode[0]] += val;

						if (max_val < val)
							max_val = val;
					});

					if (max_total < total)
						max_total = total;

					// make sure to fill rnodes in all items, even non-existing
					all_rnodes.forEach(rnode => {
						if (!Object.keys(item).includes(rnode))
							item[rnode] = 0;
					});

					// flatten, remove rnodes property
					delete item.rnodes;
				});

				let data = {data: items, columns: all_rnodes, max_val, max_total, rnodes_sum};


				redis.set(streamgraph.cache_key(unit, times, ts_start, options), data);
				redis.expire(streamgraph.cache_key(unit, times, ts_start, options), CACHE_EXPIRE_FOREVER);

				console.log('rnodes.streamgraph.update took', now()-t_start);

				resolve(data);
			});
		}
	}
}

module.exports = {user, streamgraph};
