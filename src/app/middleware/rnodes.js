const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {balances, addresses, rnodes, rewards} = require('../data');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts, isAddress} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const kpi = require('./kpi');
const {web3} = require('../../cpc-fusion/api');


const CACHE_KEY = 'CPC-DATA-RNODES-USER_';
const CACHE_EXPIRE_FOREVER = 99999999999;			// redis cache lives forever, values are updated via aggregate.js

const user = {
	update_promise_chain: Promise.resolve(),

	cache_key: function (addr) {
		return CACHE_KEY+addr;
	},
	cache_flush_all: async function () {
		return redis.delPrefix(CACHE_KEY);
	},
	get: async function (addr, forceUpdate = false) {
		try {
			let data = !forceUpdate ? await redis.get(user.cache_key(addr)) : null;
			return data || await user.update(addr);
		} catch (e) {
			return {error: e};
		}
	},
	update: async function (addr) {
		// avoid parallel calls, instead chain them
		return user.update_promise_chain = user.update_promise_chain.then(_update);

		async function _update () {
			return new Promise(async function (resolve, reject) {
				const t_start = now();

				let addr_;

				// is address
				if (!isAddress(addr))
					return Promise.reject({invalidAddress: true});

				// sanitize given addr
				addr = web3.utils.toChecksumAddress(addr);

				try {
					addr_ = await addresses.get(addr);
				} catch (err) {
					try {
						// update balance via node
						await balances.update(addr);
						await balances.ranking_update();		// set rankings
						addr_ = await addresses.get(addr);			// get balance and rank from db
					} catch (err) {
						return reject("address ("+addr+") not found and could not be fetched from civilian node in realtime:", err);
					}
				}

				const rnode = {
					last_rpt: await rnodes.last_rpt(addr),		// incl. rank
					last_balance: addr_.latest_balance,
					last_balance_rank: addr_.rank,
					last_blocks: {
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



const all = {
	update_promise_chain: Promise.resolve(),

	cache_key: function (unit, times, ts_start, options = {}) {
		return 'CPC-DATA-RNODES-ALL_'+unit+'_'+times+'_'+ts_start+'_'+JSON.stringify(options);
	},
	cache_flush_all: async function () {
		return redis.delPrefix('CPC-DATA-RNODES-ALL_');
	},
	cache_timestamp: async function (unit, times, ts_start = 'latest', options = {}) {
		return await redis.get(all.cache_key(unit, times, ts_start, options)+'_timestamp');
	},
	get: async function (unit, times, ts_start = 'latest', options = {}, forceUpdate = false) {
		let data = await redis.get(all.cache_key(unit, times, ts_start, options));

		if (!forceUpdate && data) console.log("Serving rnodes.all from redis");
		if (forceUpdate || !data)
			data = await all.update(unit, times, ts_start, options);

		return data;
	},
	update: async function (unit, times, ts_start = 'latest', options = {}) {

		const target = options.target || 'mined';

		let ts = ts_start == 'latest' ? last_unit_ts(unit, times, 10) : unit_ts(ts_start, 10);

		// avoid parallel calls, instead chain them
		return all.update_promise_chain = all.update_promise_chain.then(_update);

		async function _update () {
			return new Promise(async function (resolve, reject) {
				const t_start = now();

				let _rnodes = [];
				let _rewards = await rewards.last(unit, times, 'latest');
				let _rewards_pre = [];
				try {
					_rewards_pre = await rewards.last(unit, times, 'prelatest');
				} catch (e) {}

				let _gen = await rnodes.last_generation();
				let rpts = await rnodes.last_rpt();
				let addrs = [...new Set(rpts.map(_ => _.address).concat(_rewards.map(_ => _.rnode)).concat(_gen.Proposers))];
				let _addresses = await addresses.get(addrs);

				addrs.forEach(addr => {
					let extend;
					let rnode = {rnode: addr};
					_rnodes.push(rnode);

					// RPT, IF EXIST
					let [f] = rpts.filter(_ => _.address == addr);
					_extend = {
						rpt: f ? f.rpt : 0,
						rpt_rank: f ? f.rank : 0,
						elected: _gen.Proposers.includes(addr),
						proposing: _gen.Proposers[_gen.ProposerIndex] == addr
					};
					Object.assign(rnode, _extend);

					// BALANCE, RANK, OWNED_BY, IF EXIST
					let [f2] = _addresses.filter(_ => _.address == addr);
					_extend = {
						owned_by: f2 ? f2.owned_by : null,
						balance: f2 ? f2.latest_balance + config.cpc.rnode_lock_amount_min : 0,
						balance_rank: f2 ? f2.rank == 0 : false,
					};
					Object.assign(rnode, _extend);

					// REWARDS, IF EXIST
					let [f3] = _rewards.filter(_ => _.rnode == addr);
					if (f3) {
						delete f3.rnode;
						//delete f3.balance;
						Object.assign(rnode, f3);
					} else {
						Object.assign(rnode, {
							impeached: 0,
							mined: 0,
							rewards: 0,
							rewards_from_fee: 0,
							rewards_from_fixed: 0,
							rewards_usd: 0,
							roi_year: 0,
						});
					}

					// REWARDS PRELATEST, IF EXISTS
					let [f4] = _rewards_pre.filter(_ => _.rnode == addr);
					if (f4) {
						rnode.mined_pre_diff = rnode.mined - f4.mined;
					}
				});


				redis.set(all.cache_key(unit, times, ts_start, options), _rnodes);
				redis.set(all.cache_key(unit, times, ts_start, options)+'_timestamp', moment().unix());
				redis.expire(all.cache_key(unit, times, ts_start, options), CACHE_EXPIRE_FOREVER);

				console.log('rnodes.all.update took', now()-t_start);

				resolve(_rnodes);
			});
		}
	}
}

const roi = {
	update_promise_chain: Promise.resolve(),

	cache_key: function (unit, times, ts_start, options = {}) {
		return 'CPC-DATA-RNODES-ROI_'+unit+'_'+times+'_'+ts_start+'_'+JSON.stringify(options);
	},
	cache_flush_all: async function () {
		return redis.delPrefix('CPC-DATA-RNODES-ROI_');
	},
	get: async function (unit, times, ts_start = 'latest', options = {}, forceUpdate = false) {
		let data = await redis.get(roi.cache_key(unit, times, ts_start, options));

		if (!forceUpdate && data) console.log("Serving rnodes.roi from redis");
		if (forceUpdate || !data)
			data = await roi.update(unit, times, ts_start, options);

		return data;
	},
	update: async function (unit, times, ts_start = 'latest', options = {}) {

		const target = options.target || 'mined';

		let ts = ts_start == 'latest' ? last_unit_ts(unit, times, 10) : unit_ts(ts_start, 10);

		// avoid parallel calls, instead chain them
		return roi.update_promise_chain = roi.update_promise_chain.then(_update);

		async function _update () {
			return new Promise(async function (resolve, reject) {
				const t_start = now();

				let _roi = await rewards.roi(unit, times, 'latest');

				redis.set(roi.cache_key(unit, times, ts_start, options), _roi);
				redis.expire(roi.cache_key(unit, times, ts_start, options), CACHE_EXPIRE_FOREVER);

				console.log('rnodes.roi.update took', now()-t_start);

				resolve(_roi);
			});
		}
	}
}

async function blocks (addr, offset = 0, limit = null) {
	return new Promise(async function (resolve, reject) {
		try {
			if (!isAddress(addr)) {
				return resolve({invalidAddress: true});
			}

			resolve(await rnodes.blocks(addr));
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err: err.message});
		}
	});
}

async function blocks_count (addr) {
	return new Promise(async function (resolve, reject) {
		try {
			if (!isAddress(addr)) {
				return resolve({invalidAddress: true});
			}

			resolve(await rnodes.blocks_count(addr));
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err: err.message});
		}
	});
}

module.exports = {user, streamgraph, all, blocks, blocks_count, roi};
