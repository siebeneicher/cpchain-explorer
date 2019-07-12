const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const {convert_ts, last_unit_ts} = require('../helper');


async function get (hash) {
	return new Promise((resolve, reject) => {
		mongo.db(config.mongo.db.sync).collection('balances')
			.aggregate([
				{ $match: {address: hash} },
				{ $project: {
					address:1,
					latest_balance:1
				} }
			])
			.toArray((err, addr) => {
				if (err) return reject(err);
				else if (!addr || !addr.length) return reject(null);
				resolve(addr[0]);
			});
	});
}

module.exports = {get}
