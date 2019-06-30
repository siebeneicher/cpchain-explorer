const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {convert_ts, clone, unique_array, last_unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const {rewards, blocks, transactions, rnodes} = require('../data');

const CACHE_EXPIRE_FOREVER = 99999999999;			// redis cache lives forever, values are updated via sync.js

module.exports = {options, get};



const kpis = {
	last_rewards: {
		options: {
			hour: { short: 'Hour', abbrev: 'h', full: 'Last Hour' },
			day: { short: 'Day', abbrev: 'd', full: 'Last Day' },
			week: { short: 'Week', abbrev: 'w', full: 'Last Week' },
			month: { short: '30 Days', abbrev: 'm', full: 'Last 30 Days' },
			quarter: { short: 'Quarter', abbrev: 'q', full: 'Last Quarter (12 weeks)' },
			year: { short: 'Year', abbrev: 'y', full: 'Last Year (365 days)' }
		},
		get: {
			hour: async () => rewards.last_merged('minute', 60),
			day: async () => rewards.last_merged('minute', 60*24),
			week: async () => rewards.last_merged('minute', 60*24*7),
			month: async () => rewards.last_merged('minute', 60*24*30),
			quarter: async () => rewards.last_merged('day', 31+30+31),
			year: async () => rewards.last_merged('day', 365),
		}
	}
};


async function options (key, unit = null) {
	return new Promise((resolve, reject) => {
		resolve(unit ? kpis[key].options[unit] : kpis[key].options);
	});
}

async function get (key, unit, params = {}, forceUpdate = false) {
	return new Promise(async (resolve, reject) => {
		const cache_key = _cache_key(key, unit);

		let data = await redis.get(cache_key);

		if (!forceUpdate && data) {
			console.log("Serving kpi (",key, unit,") from cache");
			resolve(data);
		} else {
			data = await kpis[key].get[unit]();
			redis.set(cache_key, data);
			redis.expire(cache_key, CACHE_EXPIRE_FOREVER);
			resolve(data);
		}
	});
}

function _cache_key (kpi_key, unit) {
	return 'cpc-kpi_'+kpi_key+'_'+unit;
}