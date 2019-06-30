const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {balances, rnodes, blocks, rewards} = require('../data');
const {convert_ts, clone, unique_array, unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');



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
						year: await blocks.last('year', addr),
						month: await blocks.last('month', addr),
						day: await blocks.last('day', addr),
						hour: await blocks.last('hour', addr),
					},
					last_rewards: {
						hour: await rewards.last_merged('minute', 60, addr),
						day: await rewards.last_merged('minute', 60 * 24, addr),
						week: await rewards.last_merged('minute', 60 * 24 * 7, addr),
						month: await rewards.last_merged('minute', 60 * 24 * 31, addr),
						quarter: await rewards.last_merged('minute', 60 * 24 * 31 * 3, addr),
						year: await rewards.last_merged('minute', 60 * 24 * 31 * 12, addr),
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

module.exports = {user};
