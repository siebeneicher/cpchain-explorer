const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const {convert_ts, last_unit_ts} = require('../helper');

module.exports = {last_sum}

async function last_sum (unit, times = 1) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();
		const last_ts = last_unit_ts(unit, times);

		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate([
				{ $match: { ts: { $gte: last_ts } } },
				{ $group: {
					_id: 'sum',
					count: { $sum: '$transactions_count' },
					volume: { $sum: '$transactions_volume' },
				} },
			])
			.toArray((err, result) => {
				console.log("transactions.last_sum(",unit, times,")", now() - t_start);

				if (err || result.length == 0) {
					console.error("transactions.last_sum(",unit, times,"):", err, result);
					resolve(null);
				} else {
					resolve(result[0]);
				}
			});
	});
}