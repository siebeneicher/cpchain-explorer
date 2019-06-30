const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const kpi = require('./kpi');
const {convert_ts, clone, unique_array, last_unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const {rewards, blocks, transactions, rnodes} = require('../data');

const CACHE_KEY_DASHBOARD = 'CPC-DATA-DASHBOARD';
const CACHE_EXPIRE_FOREVER = 99999999999;			// redis cache lives forever, values are updated via sync.js

let update_promise = Promise.resolve();			

module.exports = {get: dashboard, update};


async function dashboard (forceUpdate = false) {
	let data = await redis.get(CACHE_KEY_DASHBOARD);

	if (!forceUpdate && data) console.log("Serving dashboard from redis");
	if (forceUpdate || !data)
		data = await update();

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
					hour: {
						option: await kpi.options('last_rewards', 'hour'),
						data: await kpi.get('last_rewards', 'hour')
					},
					day: {
						option: await kpi.options('last_rewards', 'day'),
						data: await kpi.get('last_rewards', 'day')
					},
					week: {
						option: await kpi.options('last_rewards', 'week'),
						data: await kpi.get('last_rewards', 'week')
					},
					month: {
						option: await kpi.options('last_rewards', 'month'),
						data: await kpi.get('last_rewards', 'month')
					},
					quarter: {
						option: await kpi.options('last_rewards', 'quarter'),
						data: await kpi.get('last_rewards', 'quarter')
					},
					year: {
						option: await kpi.options('last_rewards', 'year'),
						data: await kpi.get('last_rewards', 'year')
					},
				},
				reward_per_block: config.cpc.rewardsPerBlock,
				last_block: await blocks.last(),
				last_rnodes: await rnodes.last(),
			};

			console.log("dashboard took:", now() - t_start);
			//console.log(data.last_rewards.year);

			redis.set(CACHE_KEY_DASHBOARD, data);
			redis.expire(CACHE_KEY_DASHBOARD, CACHE_EXPIRE_FOREVER);

			resolve(data);
		});
	}
}
