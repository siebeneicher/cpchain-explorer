const mongo = require('../mongo');
const config = require('../config');
const now = require('performance-now');
const moment = require('moment');
const {convert_ts, clone, unique_array, last_unit_ts, unit_ts} = require('../helper');

module.exports = {last, byUnit};

async function byUnit (unit, ts, select = []) {
	// sanitize ts
	const from = convert_ts(ts, 13);			// sync db blocks timestamp is 13 digits
	const to = convert_ts(moment.utc(ts).add(1, unit).unix(), 13);

	const project = {};
	select.forEach(_ => project[_] = 1);

	return new Promise(async function (resolve, reject) {
		const t_start = now();

		let aggr = [
			{ $match: { timestamp: { $gte: from, $lte: to } } },
			{ $sort: { timestamp: 1 } },
			{ $project: project }
		];

/*		if (rnode_addr) {
			aggr = [
				{ $match: { timestamp: { $gte: from, $lte: to } } },
				{ $project: { ts: 1, rnodes_: { $objectToArray: '$rnodes' } } },
				{ $project: { ts: 1, rnodes_: { $objectToArray: '$rnodes' } } }
			];
		}*/

		mongo.db(config.mongo.db.sync).collection('blocks')
			.aggregate(aggr)
			.toArray((err, result) => {
				console.log(unit+".blocks.byUnit took: ", now() - t_start);

				if (err || result.length == 0) {
					console.error(unit+".blocks.byUnit.find:", err, result);
					resolve([]);
				} else {
					resolve(result);
				}
			});
	});
}

async function last (unit = null, rnode_addr = null) {

	// last_block from sync
	if (unit == null && rnode_addr == null) {
		return new Promise((resolve, reject) => {
			mongo.db(config.mongo.db.sync).collection('blocks')
				.find()
				.sort({number: -1})
				.limit(1)
				.toArray((err, block) => {
					resolve(block[0]);
				});
		});
	}

	// if unit given, get last blocks by unit aggregated
	return new Promise(async function (resolve, reject) {
		const t_start = now();

		const project = {_id:0, ts:1, blocks_mined:1, blocks_impeached:1};
		if (rnode_addr) project.rnodes = 1;

		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.find({})
			.project(project)
			.limit(1)
			.sort({ts: -1})
			.toArray((err, result) => {
				console.log(unit+".dashboard.blocks.last took:", now() - t_start);

				if (err || result.length == 0) {
					console.error("overview data, mongo_db_aggregation_by."+unit+".find:", err, result);
					resolve(null);
				} else {
					if (rnode_addr) {
						if (result[0].rnodes[rnode_addr]) {
							resolve(Object.assign({ts: result[0].ts}, result[0].rnodes[rnode_addr]));
						} else {
							resolve(null);
						}
						return;
					}

					resolve(result[0]);
				}
			});
	});
}