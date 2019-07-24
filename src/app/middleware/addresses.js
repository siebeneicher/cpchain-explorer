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

			resolve(await addresses.get(hash));
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err: err.message});
		}
	});
}

async function all () {
	return new Promise(async function (resolve, reject) {
		try {
			let r = await addresses.all();
			resolve(r);
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err: err.message});
		}
	});
}

module.exports = {get, all};