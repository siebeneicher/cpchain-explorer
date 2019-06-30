const mongo = require('../mongo');
const config = require('../config');
const {convert_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const {unitTs} = require('../middleware/aggregate');


module.exports = {last, last_rpt, type}

async function type (addr) {
	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('rnodes')
			.find()
			.limit(1)
			.toArray((err, result) => {
resolve("NOT-IMPLEMENTED");
				if (result.length == 0) {
					console.log("rnodes.type empty");
					resolve(null);
				} else if (err) {
					console.error("rnodes.type error: ", err);
					resolve(null);
				} else {
					resolve(result);
				}
			});
	});
}

async function last_rpt (addr) {
	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('rnodes')
			.aggregate(
				{ $match: { rnodes: { $elemMatch: { 'Address': addr } } } },
				{ $sort: { ts: -1 } },
				{ $limit: 1 }
			)
			.toArray((err, result) => {
				if (result.length == 0) {
					console.log("rnodes.last_rpt empty");
					resolve(null);
				} else if (err) {
					console.error("rnodes.last_rpt error: ", err);
					resolve(null);
				} else {
					// sort, for ranking
					result[0].rnodes.sort(function(a, b) { return a[1] - b[1] });
					let rank = 0;
					let rpt = null;
					result[0].rnodes.forEach((_,i) => {
						if (_.Address == addr) {
							rank = i + 1;
							rpt = _.Rpt;
						}
					});
					resolve({ts: result[0].ts, rpt, rank});
				}
			});
	});
}

async function last () {
	return new Promise(async function (resolve, reject) {
		mongo.db(config.mongo.db.sync).collection('rnodes')
			.find()
			.sort({ts: -1})
			.limit(1)
			.toArray((err, result) => {
				if (err || result.length == 0) {
					console.error("rnodes.last error:", err);
					reject();
				} else {
					resolve(result[0]);
				}
			});
	});
}