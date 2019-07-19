const mongo = require('../mongo');
const config = require('../config');
const {convert_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const {unitTs} = require('../middleware/aggregate');
const {web3} = require('../../cpc-fusion/api');

module.exports = {last, last_merged};

async function last_merged (unit, times, rnode_addr = null) {

	// sanitize given addr
	if (rnode_addr) rnode_addr = web3.utils.toChecksumAddress(rnode_addr);

	const merged = {
		rnodes: await last (unit, times, rnode_addr),
		total_rnodes: 0,
		total_mined: 0,
		total_rewards: 0,
		total_balances: 0,
		total_roi: 0,
		avg_rewards: 0,
		avg_balance: 0,
		avg_roi: 0,
		total_roi_year: 0,
		avg_roi_year: 0
	}

	let units_per_year = 0;
	if (unit == "minute") units_per_year = 365 * 24 * 60;
	if (unit == "hour") units_per_year = 365 * 24;
	if (unit == "day") units_per_year = 365;
	if (unit == "month") units_per_year = 12;
	let time_multiply = units_per_year / times;

	try {
		merged.total_rnodes = merged.rnodes.length;
		merged.total_balances = merged.rnodes.reduce((accumulator, currentValue) => accumulator + currentValue.balance, 0);
		merged.total_mined = merged.rnodes.reduce((accumulator, currentValue) => accumulator + currentValue.mined, 0);
		merged.total_rewards = merged.rnodes.reduce((accumulator, currentValue) => accumulator + currentValue.rewards, 0);
		merged.total_roi = (merged.total_rewards / merged.total_balances * 100).toFixed(2);
		merged.total_roi_year = (time_multiply * merged.total_roi).toFixed(2);

		merged.avg_rewards = merged.total_rewards / merged.total_rnodes;
		merged.avg_balance = merged.total_balances / merged.total_rnodes;
		merged.avg_roi = merged.avg_rewards / merged.avg_balance * 100;
		merged.avg_roi_year = (time_multiply * merged.avg_roi).toFixed(2);
	} catch (err) {
		
	}

	return merged;
}

async function last (unit, times, rnode_addr = null) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();
		const last_ts = last_unit_ts(unit, times);

		// sanitize given addr
		if (rnode_addr) rnode_addr = web3.utils.toChecksumAddress(rnode_addr);

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
						}
					}
				},
				{ $unwind: '$rnodes_' },
				{ $match: { 'rnodes_.k': rnode_addr || { $exists: true } } },	// filter for rnode, if parameter given
				{ $group: {
					_id: '$rnodes_.k',
					mined: { $sum: '$rnodes_.v.mined' },
					impeached: { $sum: '$rnodes_.v.impeached' },
					//fees: { $sum: '$rnodes_.v.transactions_fee' },
					balance: { $last: '$rnodes_.v.balance' },
					//proposer: { $sum: '$rnodes_.v.proposer' },
				} },
				{
					$project: {
						_id: 0,
						rnode: '$_id',
						mined: 1,
						impeached: 1,
						balance: 1,
						//fees: 1,
						//proposer: 1,
						rewards: { $multiply: [ "$mined", config.cpc.rewardsPerBlock ] }
				} }
			])
			.toArray((err, result) => {
				//console.log("rewards.last(",unit, times,rnode_addr,")", now() - t_start);
				//console.log(result);

				if (err || result.length == 0) {
					console.error("rewards.last(",unit, times,rnode_addr,") error:", err);
					resolve(null);
				} else {
					// calculate ROI
					//result[0].avg_rewards = result[0].rewards / result[0].rnode;

					// format to 2 digits after dot
					//Object.keys(result[0]).forEach(k => result[0][k] = result[0][k].toFixed(2));

					resolve(result);
				}
			});
	});
}
