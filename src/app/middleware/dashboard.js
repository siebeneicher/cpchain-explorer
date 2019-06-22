const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {convert_ts, clone, unique_array, last_unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const {rewards, blocks, transactions, rnodes} = require('../data');

const CACHE_KEY_DASHBOARD = 'CPC-DATA-DASHBOARD';
const CACHE_EXPIRE_FOREVER = 99999999999;			// redis cache lives forever, values are updated via sync.js

let update_promise = Promise.resolve();			

module.exports = {get: dashboard, update};


async function dashboard () {
	let data = await redis.get(CACHE_KEY_DASHBOARD);

	if (data) console.log("Serving dashboard from redis");
	if (!data)
		data = await update();

	redis.set(CACHE_KEY_DASHBOARD, data);
	redis.expire(CACHE_KEY_DASHBOARD, CACHE_EXPIRE_FOREVER);

	return data;
}

async function update () {
	// avoid parallel calls, instead chain them
	return update_promise = update_promise.then(_update);

	async function _update () {
		return new Promise(async function (resolve, reject) {
			const t_start = now();

			const data = {
				last_blocks: {
					minute: await blocks.last('minute'),
					hour: await blocks.last('hour'),
					day: await blocks.last('day'),
					month: await blocks.last('month'),
					year: await blocks.last('year')
				},
				last_transactions: {
					minute: await transactions.last('minute'),
					hour: await transactions.last('hour'),
					day: await transactions.last('day'),
					month: await transactions.last('month'),
					year: await transactions.last('year')
				},
				last_rewards: {
					// use minute as base unit, because "last" is from now() backwards and minute as smallest unit will provide best precision.
					hour: await rewards.last('minute', 60),
					day: await rewards.last('minute', 60 * 24),
					week: await rewards.last('minute', 60 * 24 * 7),
					month: await rewards.last('minute', 60 * 24 * 31),
					quarter: await rewards.last('minute', 60 * 24 * 31 * 3),
					year: await rewards.last('minute', 60 * 24 * 31 * 12),
				},
				reward_per_block: config.cpc.rewardsPerBlock
			};

			console.log("dashboard took:", now() - t_start);
			console.log(data.last_rewards);

			resolve(data);
		});
	}
}
