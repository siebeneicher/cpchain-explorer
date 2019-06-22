const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');

module.exports = {last}

async function last (unit) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();
		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.find({})
			.project({_id:0, ts:1, transactions_count:1, transactions_volume:1})
			.limit(1)
			.sort({ts: -1})
			.toArray((err, result) => {
				console.log(unit+".dashboard.transactions.last took:", now() - t_start);

				if (err || result.length == 0) {
					console.error("overview data, mongo_db_aggregation_by."+unit+".find:", err, result);
					resolve(null);
				} else {
					resolve(result[0]);
				}
			});
	});
}