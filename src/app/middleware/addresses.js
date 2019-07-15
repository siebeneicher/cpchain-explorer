const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {addresses, balances} = require('../data');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts, isAddress} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const kpi = require('./kpi');

async function get (hash) {
	return new Promise(async function (resolve, reject) {
		try {
			if (!isAddress(hash)) {
				return resolve({invalidAddress: true});
			}

			let b = await balances.latest(hash);
			resolve({address: hash, balance: b, rank: await rankings(hash)});
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err: err.message});
		}
	});
}

async function rankings (addr = null) {
	return new Promise(async function (resolve, reject) {
		try {
			let r = await balances.ranking(addr);
			resolve(r);
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err: err.message});
		}
	});
}

module.exports = {get};