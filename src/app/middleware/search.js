const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {addresses, balances} = require('../data');
const {convert_ts, clone, unique_array, unit_ts, last_unit_ts, isAddress} = require('../helper');
const now = require('performance-now');
const moment = require('moment');
const kpi = require('./kpi');

module.exports = { typeOf };


async function typeOf (term) {
	let out = {type: null};

	try {
		let isHex = !!(term+"").trim().match(/^0x/);
		let isNumber = !isNaN((term+"").trim());
		let len = (term+"").trim().length;

		if (isAddress(term)) {
			out.type = "address";
		} else if (!isHex && isNumber) {
			out.type = "blockNumber";
		} else if (isHex && len == 66) {
			out.type = "hash";
		} else if (!isHex && !isNumber && len == 64) {
			out.type = "hash";
		}

		if (out.type == "hash") {
			// block or trx hash?

// TODO:

		}

		return Promise.resolve(out);
	} catch (err) {
		console.error(err);
		return Promise.resolve({error: err.message});
	}
}

