const mongo = require('../mongo');
const config = require('../config');
const {convert_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const {unitTs} = require('../middleware/aggregate');

module.exports = {last};

async function last (unit, times) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();

		const last_ts = last_unit_ts(unit, times);


		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate([
				{ $match: { ts: { $gte: last_ts } } },
				//{ $sort: { ts: -1 } },
				//{ $limit: limit },
				{
					$project: {
						ts: 1,
						rnodes_: {
							$objectToArray: '$rnodes'
						},
						counter: { $literal: 1}
					}
				},
				{ $unwind: '$rnodes_' },
				{ $group: {
					_id: 'rewards',
					total_rnode: { $sum: '$counter' },
					total_mined: { $sum: '$rnodes_.v.mined' },
					total_impeached: { $sum: '$rnodes_.v.impeached' },
					total_proposer: { $sum: '$rnodes_.v.proposer' },
					avg_mined: { $avg: '$rnodes_.v.mined' },
					avg_impeached: { $avg: '$rnodes_.v.impeached' },
					avg_proposer: { $avg: '$rnodes_.v.proposer' },
				} }
			])
			.toArray((err, result) => {
				console.log(unit+".dashboard.rewards took:", now() - t_start);

				if (err || result.length == 0) {
					console.error(unit+".dashboard.rewards error:", err);
					resolve(null);
				} else {
					// calculate rewards
					delete result[0]._id;
					result[0].total_rewards = result[0].total_mined * config.cpc.rewardsPerBlock;
					result[0].avg_rewards = result[0].total_rewards / result[0].total_rnode;

					// format to 2 digits after dot
					Object.keys(result[0]).forEach(k => result[0][k] = result[0][k].toFixed(2));

					resolve(result[0]);
				}
			});
	});
}