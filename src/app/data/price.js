const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const moment = require('moment');
const {convert_ts, clone, unique_array, last_unit_ts, unit_ts} = require('../helper');

module.exports = {last, items_byDay};

async function last () {
	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('price_cmc')
			.find({})
			.sort({ts: -1})
			.limit(1)
			.toArray((err, result) => {
				if (err) {
					console.error(err);
				} else if (result && result.length) {
					resolve(result[0].quote);
				} else {
					resolve(null);
				}
			});
	});
}

async function items_byDay (times, ts_start) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();

		let project = { _id:0, ts_date: { $add : [new Date(0), { $multiply: ["$ts", 1000] }] }, cmc_rank: 1, usd: '$quote.USD.price' };

// TODO:
// times, ts_end

		mongo.db(config.mongo.db.sync).collection('price_cmc')
			.aggregate([
				{ $match: { ts: { $gte: convert_ts(ts_start, 10) } } },
				{ $project: project },

				//
			    { $group: {
			    	'_id': {
						'year': { '$year': "$ts_date" },
						'month': { '$month': "$ts_date" },
						'day': { '$dayOfMonth': "$ts_date" }
					},
					'ts_date': { $last: '$ts_date' },
					'usd_avg': { $avg: "$usd" },
					'usd_min': { $min: "$usd" },
					'usd_max': { $max: "$usd" },
					'cmc_rank_avg': { $avg: "$cmc_rank" },
				}},
				{ $project: {
					_id: 0,
					ts: { $toLong: '$ts_date' },
					usd_avg: 1,
					usd_min: 1,
					usd_max: 1,
					cmc_rank_avg: 1
				} },
				{ $sort: { ts: 1 } },
				{ $limit: times }
			])
			.toArray((err, result) => {
				//console.log("price.items_byDay(", unit, times, ts_start, ")", now() - t_start);

				if (err || result.length == 0) {
					console.error("price.items_byDay(", times ,") error:", err, result);
					resolve([]);
				} else {
					resolve(result);
				}
			});
	});
}