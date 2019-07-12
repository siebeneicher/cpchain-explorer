const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {balances, rnodes, blocks, rewards, transactions} = require('../data');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const kpi = require('./kpi');



const streamgraph = {
	update_promise_chain: Promise.resolve(),

	cache_key: function (unit, times, ts_start, options = {}) {
		return 'CPC-DATA-TRX-STREAMGRAPH_'+unit+'_'+times+'_'+ts_start+'_'+JSON.stringify(options);
	},
	cache_flush_all: async function () {
		return redis.delPrefix('CPC-DATA-TRX-STREAMGRAPH_');
	},
	get: async function (unit, times, ts_start = 'latest', options = {}, forceUpdate = false) {
		let data = await redis.get(streamgraph.cache_key(unit, times, ts_start, options));

		if (!forceUpdate && data) console.log("Serving transactions.streamgraph from redis");
		if (forceUpdate || !data)
			data = await streamgraph.update(unit, times, ts_start, options);

		return data;
	},

	update: async function (unit, times, ts_start = 'latest', options = {}) {
		//const target = options.target || 'mined';
		let ts = ts_start == 'latest' ? last_unit_ts(unit, times, 10) : unit_ts(ts_start, 10);

		// avoid parallel calls, instead chain them
		return streamgraph.update_promise_chain = streamgraph.update_promise_chain.then(_update);

		async function _update () {
			return new Promise(async function (resolve, reject) {
				const t_start = now();

				let items = await transactions.items(unit, times, ts);
debugger;
console.log(items);
return resolve(null);

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
	debugger;
	return new Promise(async function (resolve, reject) {
		try {
			resolve(await transactions.ofAddress(addrHash));
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err});
		}
	});
}

module.exports = {streamgraph, get, ofAddress, ofBlock};