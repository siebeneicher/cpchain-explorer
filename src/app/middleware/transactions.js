const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {balances, rnodes, blocks, rewards, transactions} = require('../data');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const kpi = require('./kpi');

const CACHE_EXPIRE_FOREVER = 9999999999999;

const graph = {
	update_promise_chain: Promise.resolve(),

	cache_key: function (unit, times, ts_start, options = {}) {
		return 'CPC-DATA-TRX-GRAPH_'+unit+'_'+times+'_'+ts_start+'_'+JSON.stringify(options);
	},
	cache_flush_all: async function () {
		return redis.delPrefix('CPC-DATA-TRX-GRAPH_');
	},
	get: async function (unit, times, ts_start = 'latest', options = {}, forceUpdate = false) {
		let data = await redis.get(graph.cache_key(unit, times, ts_start, options));

		if (!forceUpdate && data) console.log("Serving transactions.graph from cache");
		if (forceUpdate || !data)
			data = await graph.update(unit, times, ts_start, options);

		return data;
	},

	update: async function (unit, times, ts_start = 'latest', options = {}) {
		const exclude_last = options.exclude_last !== undefined ? options.exclude_last*1 : 0;

		let ts = ts_start == 'latest' ? last_unit_ts(unit, times + exclude_last, 10) : unit_ts(ts_start, 10);

		// avoid parallel calls, instead chain them
		return graph.update_promise_chain = graph.update_promise_chain.then(_update);

		async function _update () {
			return new Promise(async function (resolve, reject) {
				const t_start = now();

				let items = await transactions.items(unit, times, ts, ['ts','transactions_count','transactions_volume']);

				if (!items || !items.length)
					resolve(null);

				let count_max = 0;
				let count_sum = 0;

				let volume_max = 0;
				let volume_sum = 0;

				items.forEach(item => {
					count_sum += item.transactions_count;
					volume_sum += item.transactions_volume;

					count_max = Math.max(item.transactions_count, count_max);
					volume_max = Math.max(item.transactions_volume, volume_max);
				});

				let data = {data: items, count_max, count_sum, volume_max, volume_sum};

				redis.set(graph.cache_key(unit, times, ts_start, options), data);
				redis.expire(graph.cache_key(unit, times, ts_start, options), CACHE_EXPIRE_FOREVER);

				//console.log('rnodes.graph.update took', now()-t_start);

				resolve(data);
			});
		}
	}
}

async function get (trxHash) {
	return new Promise(async function (resolve, reject) {
		try {
			resolve(await transactions.get(trxHash));
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err});
		}
	});
}

async function ofBlock (blockNumber) {
	return new Promise(async function (resolve, reject) {
		try {
			resolve(await transactions.ofBlock(parseInt(blockNumber)));
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err});
		}
	});
}

async function ofAddress (addrHash) {
	return new Promise(async function (resolve, reject) {
		try {
			resolve(await transactions.ofAddress(addrHash));
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err});
		}
	});
}

module.exports = {graph, get, ofAddress, ofBlock};