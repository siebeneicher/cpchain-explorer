const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {addresses, balances, rnodes, transactions} = require('../data');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts, isAddress} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const kpi = require('./kpi');

async function get (hash, extended = true) {
	return new Promise(async function (resolve, reject) {
		try {
			if (!isAddress(hash)) {
				return resolve({invalidAddress: true});
			}

			addresses.get(hash).then(async (addr) => {
				if (!extended) return resolve(addr);

				addr.transactions_count = await transactions.ofAddress_count(hash);

// TODO: is rnode
				// IS RNODE ???
				let is_rnode = 1;
				if (is_rnode) {
					addr.blocks_count = await rnodes.blocks_count(hash);
				}

				resolve(addr);
			});
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