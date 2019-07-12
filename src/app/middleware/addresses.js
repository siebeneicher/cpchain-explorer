const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {addresses} = require('../data');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const kpi = require('./kpi');

async function get (hash) {
	return new Promise(async function (resolve, reject) {
		debugger;
		try {
			resolve(await addresses.get(hash));
		} catch (err) {
			if (!err) resolve({empty: true});
			else resolve({err: err.message});
		}
	});
}

module.exports = {get};