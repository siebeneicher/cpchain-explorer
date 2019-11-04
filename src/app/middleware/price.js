const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {price} = require('../data');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const kpi = require('./kpi');

const CACHE_EXPIRE_FOREVER = 9999999999999;

const graph = {
	update_promise_chain: Promise.resolve(),

	cache_key: function (unit, times, ts_start, options = {}) {
		return 'CPC-DATA-PRICE-GRAPH_'+unit+'_'+times+'_'+ts_start+'_'+JSON.stringify(options);
	},
	cache_flush_all: async function () {
		return redis.delPrefix('CPC-DATA-PRICE-GRAPH_');
	},
	get: async function (unit, times, ts_start = 'latest', options = {}, forceUpdate = false) {
		let data = await redis.get(graph.cache_key(unit, times, ts_start, options));

		if (!forceUpdate && data) console.log("Serving price.graph from cache");
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

				const callFn = unit == "hour" ? "items_byHour" : "items_byDay";
				let items = await price[callFn](times, ts);

				let usd_avg_max = 0;
				let usd_avg_sum = 0;

				items.forEach(item => {
					item.usd_avg = parseFloat(item.usd_avg.toFixed(4));
					usd_avg_sum += item.usd_avg;
					usd_avg_max = Math.max(item.usd_avg, usd_avg_max);
				});

				let data = {data: items, usd_avg_max, usd_avg_sum};

				redis.set(graph.cache_key(unit, times, ts_start, options), data);
				redis.expire(graph.cache_key(unit, times, ts_start, options), CACHE_EXPIRE_FOREVER);

				resolve(data);
			});
		}
	}
}

module.exports = {graph};