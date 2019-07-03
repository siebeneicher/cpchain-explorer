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
			minute: async () => blocks.last('minute'),
			hour: async () => blocks.last('hour'),
			day: async () => blocks.last('day'),
//			week: async () => blocks.last('minute'),
			month: async () => blocks.last('month'),
			//quarter: async () => blocks.last('day'),
			year: async () => blocks.last('year'),
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
			//quarter: async (addr = null) => rewards.last_merged('day', 31+30+31, params.addr || null),
			year: async (params) => rewards.last_merged('day', 365, params.addr || null),
		}
	},
	last_transactions_sum: {
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
			minute: async () => transactions.last_sum('minute', 1),
			hour: async () => transactions.last_sum('minute', 60),
			day: async () => transactions.last_sum('minute', 60*24),
			week: async () => transactions.last_sum('hour', 24*7),
			month: async () => transactions.last_sum('hour', 24*30),
			//quarter: async () => transactions.last_sum('day', 31+30+31),
			year: async () => transactions.last_sum('day', 365),
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
		try {
			const cache_key = _cache_key(key, unit, params);

			let data = await redis.get(cache_key);

			if (!forceUpdate && data) {
				console.log("Serving kpi (",key,unit,params,") from cache");
				resolve(data);
			} else {
				data = await kpis[key].get[unit](params);
				redis.set(cache_key, data);
				redis.expire(cache_key, CACHE_EXPIRE_FOREVER);
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