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
		let data = !forceUpdate ? await redis.get(user.cache_key(addr)) : null;
		return data || await user.update(addr);
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

				let items = await rewards.last(unit, times);

				if (!items || !items.length)
					resolve([]);

				let rpts = await rnodes.last_rpt();
				let addrs = rpts.map(_ => _.address);
				let _addresses = await addresses.get(addrs);

				// assign latest rpt
				rpts.forEach(_ => {
					// assign balance and owned_by
					let f2 = _addresses.filter(_2 => _2.address == _.address);
					let addr = {balance: -1, owned_by: null};
					if (f2 && f2.length) {
						addr.balance = f2[0].latest_balance + config.cpc.rnode_lock_amount_min;
						addr.owned_by = f2[0].owned_by;
					} else {
						balances.update(_.address);			// update unknown address unobserved
					}


					let f = items.filter(_2 => _2.rnode == _.address);

					if (f && f.length) {
						f[0].rpt = _.rpt;
						f[0].rpt_rank = _.rank;
						f[0].elected = _.status == 0;
						f[0].owned_by = _.address_info && _.address_info[0] ? _.address_info[0].owned_by : null;
						Object.assign(f[0], addr);
					} else {
						// push current rnodes without stats
						items.push(Object.assign({
							rnode: _.address,
							rpt: _.rpt,
							rpt_rank: _.rank,
							elected: _.status == 0,
							owned_by: _.address_info && _.address_info[0] ? _.address_info[0].owned_by : null
						}, addr));
					}

				});


				redis.set(all.cache_key(unit, times, ts_start, options), items);
				redis.expire(all.cache_key(unit, times, ts_start, options), CACHE_EXPIRE_FOREVER);

				console.log('rnodes.all.update took', now()-t_start);

				resolve(items);
			});
		}
	}
}

async function blocks (addr) {
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

module.exports = {user, streamgraph, all, blocks};
