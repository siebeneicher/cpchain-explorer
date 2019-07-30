const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const moment = require('moment');
const {convert_ts, clone, unique_array, last_unit_ts, unit_ts} = require('../helper');

module.exports = {last};

async function last () {
	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('price_cmc')
			.findOne({}, {ts: -1})
			.then((result, err) => {
				if (err) {
					console.error(err);
				} else if (result) {
					resolve(result.quote);
				} else {
					resolve(null);
				}
			});
	});
}
