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
	last_blocks: {
		options: {
			minute: { short: 'Minute', abbrev: 'm', full: 'Last Minute' },
			hour: { short: 'Hour', abbrev: 'h', full: 'Last Hour' },
			day: { short: 'Day', abbrev: 'd', full: 'Last Day' },
			//week: { short: 'Week', abbrev: 'w', full: 'Last Week' },
			month: { short: '30 Days', abbrev: 'm', full: 'Last Month' },
			//quarter: { short: 'Quarter', abbrev: 'q', full: 'Last Quarter (12 weeks)' },
			year: { short: 'Year', abbrev: 'y', full: 'Last Year' }
		},
		get: {
			minute: async (params = {}) => blocks.last('minute', params.addr || null),
			hour: async (params = {}) => blocks.last('hour', params.addr || null),
			day: async (params = {}) => blocks.last('day', params.addr || null),
//			week: async (params = {}) => blocks.last('minute', params.addr || null),
			month: async (params = {}) => blocks.last('month', params.addr || null),
			//quarter: async (params = {}) => blocks.last('day', params.addr || null),
			year: async (params = {}) => blocks.last('year', params.addr || null),
		}
	},
	last_rewards: {
		options: {
			hour: { short: 'Hour', abbrev: 'h', full: 'Last Hour' },
			day: { short: 'Day', abbrev: 'd', full: 'Last Day' },
			week: { short: 'Week', abbrev: 'w', full: 'Last Week' },
			month: { short: '30 Days', abbrev: 'm', full: 'Last Month' },
			//quarter: { short: 'Quarter', abbrev: 'q', full: 'Last Quarter (12 weeks)' },
			year: { short: 'Year', abbrev: 'y', full: 'Last Year' }
		},
		get: {
			hour: async (params) => rewards.last_merged('minute', 60, params.addr || null),
			day: async (params) => rewards.last_merged('minute', 60*24, params.addr || null),
			week: async (params) => rewards.last_merged('minute', 60*24*7, params.addr || null),
			month: async (params) => rewards.last_merged('minute', 60*24*30, params.addr || null),
			//quarter: async (params) => rewards.last_merged('day', 31+30+31, params.addr || null),
			year: async (params) => rewards.last_merged('day', 365, params.addr || null),
		}
	},
	last_transactions: {
		options: {
			minute: { short: 'Minute', abbrev: 'm', full: 'Last Minute' },
			hour: { short: 'Hour', abbrev: 'h', full: 'Last Hour' },
			day: { short: 'Day', abbrev: 'd', full: 'Last Day' },
			week: { short: 'Week', abbrev: 'w', full: 'Last Week' },
			month: { short: 'Month', abbrev: 'm', full: 'Last Month' },
			//quarter: { short: 'Quarter', abbrev: 'q', full: 'Last Quarter' },
			year: { short: 'Year', abbrev: 'y', full: 'Last Year' }
		},
		get: {
			minute: async () => transactions.last('minute', 1),
			hour: async () => transactions.last('minute', 60),
			day: async () => transactions.last('minute', 60*24),
			week: async () => transactions.last('hour', 24*7),
			month: async () => transactions.last('hour', 24*30),
			//quarter: async () => transactions.last('day', 31+30+31),
			year: async () => transactions.last('day', 365),
		}
	}
};


async function options (key, unit = null) {
	return new Promise((resolve, reject) => {
		resolve(unit ? kpis[key].options[unit] : kpis[key].options);
	});
}

async function get (key, unit, params = {}, forceUpdate = true) {
	return new Promise(async (resolve, reject) => {
		try {
			const cache_key = _cache_key(key, unit, params);

			let data = !forceUpdate ? await redis.get(cache_key) : null;

			if (data) {
				//console.log("Serving kpi (",key,unit,params,") from cache");
				resolve(data);
			} else {
				let t = now();
				data = await kpis[key].get[unit](params);
				await redis.set(cache_key, data);
				redis.expire(cache_key, CACHE_EXPIRE_FOREVER);
				//console.log("kpi.get(",key,unit,params,") generated data, took", now()-t);
				resolve(data);
			}
		} catch (err) {
			console.error("kpi.get(",key,unit,params,") throws error: ",err);
			reject();
		}
	});
}

function _cache_key (kpi_key, unit, params = {}) {
	return 'cpc-kpi_'+kpi_key+'_'+unit+'_'+JSON.stringify(params);
}