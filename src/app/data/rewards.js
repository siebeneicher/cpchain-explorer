const mongo = require('../mongo');
const config = require('../config');
const {convert_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const {unitTs} = require('../middleware/aggregate');
const {web3} = require('../../cpc-fusion/api');
const moment = require('moment');
const price = require('./price');

module.exports = {last, last_merged};

async function last_merged (unit, times, rnode_addr = null) {

	// sanitize given addr
	if (rnode_addr) rnode_addr = web3.utils.toChecksumAddress(rnode_addr);

	const merged = {
		rnodes: await last (unit, times, rnode_addr),
		total_rnodes: 0,
		total_mined: 0,
		total_rewards_from_fixed: 0,
		total_rewards_from_fee: 0,
		total_rewards: 0,
		total_balances: 0,
		avg_rewards_from_fixed: 0,
		avg_rewards_from_fee: 0,
		avg_rewards: 0,
		avg_balance: 0,
		avg_roi_year: 0,
		total_reward_fixed_fee_ratio: 0,
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
		merged.total_rewards_from_fixed = merged.rnodes.reduce((accumulator, currentValue) => accumulator + currentValue.rewards_from_fixed, 0);
		merged.total_rewards_from_fee = merged.rnodes.reduce((accumulator, currentValue) => accumulator + currentValue.rewards_from_fee, 0);
		merged.total_rewards = merged.rnodes.reduce((accumulator, currentValue) => accumulator + currentValue.rewards, 0);
		merged.total_reward_fixed_fee_ratio = merged.total_rewards_from_fee / merged.total_rewards_from_fixed;

		merged.avg_roi_year = parseFloat((merged.rnodes.reduce((accumulator, currentValue) => accumulator + currentValue.roi_year, 0) / merged.total_rnodes).toFixed(2));
		merged.avg_rewards_from_fixed = merged.total_rewards_from_fixed / merged.total_rnodes;
		merged.avg_rewards_from_fee = merged.total_rewards_from_fee / merged.total_rnodes;
		merged.avg_rewards = merged.total_rewards / merged.total_rnodes;
		merged.avg_balance = merged.total_balances / merged.total_rnodes;

	} catch (err) {
		
	}

	return merged;
}

/**
 * Returns last cumulated rewards and related info.
 * Example: unit=hour times=1 will return a full hour from now backwards including minutes from previous hour.
 */
async function last (unit, times, rnode_addr = null) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();
		const last_ts = last_unit_ts(unit, times);

		// sanitize given addr
		if (rnode_addr) rnode_addr = web3.utils.toChecksumAddress(rnode_addr);


let units_per_year = 0;
if (unit == "minute") units_per_year = 365 * 24 * 60;
if (unit == "hour") units_per_year = 365 * 24;
if (unit == "day") units_per_year = 365;
if (unit == "month") units_per_year = 12;
let time_multiply = units_per_year / times;


		// HERE GOES THE MAGIC: we combine different units together
		// example: unit=month times=1 would include current month + diff-days in previous month + diff-hours in previous month of day + ...
		let unions = [
			{$limit: 1},						// only 1 document
			{$project: {_id: '$$REMOVE'}}		// clear
		];

		let included_units = [];


		// MINUTE
		if (unit == "minute") {
			let from = last_unit_ts('minute', times);
			console.log("from:", moment.utc(from*1000).toISOString(), "("+from+")");

			// the current minute + previous including "times" span.
			// include minutes before the latest hour (from previous union)
			unions.push({ $lookup: { from: 'by_minute', pipeline: [{$match: {ts: {$gte: from}}}], as: 'by_minute' }});
			included_units.push('$by_minute');
		}


		// HOUR
		if (unit == "hour") {
			let from = last_unit_ts('hour', times);
			let till_h = moment.utc(convert_ts(from, 13)).add(1, 'hour').startOf('hour').unix();
			console.log("from:", moment.utc(from*1000).toISOString(), "("+from+")");
			console.log("minutes till_h:", moment.utc(till_h*1000).toISOString(), "("+till_h+")");

			// the current hour + previous including "times" span.
			// does not include most hour ago (which we will include in next $lookup)
			unions.push({ $lookup: { from: 'by_hour', pipeline: [{$match: {ts: {$gte: from}}}], as: 'by_hour' }});
			included_units.push('$by_hour');

			// include minutes before the latest hour (from previous union)
			unions.push({ $lookup: { from: 'by_minute', pipeline: [{$match: {ts: {$gte: from, $lt: till_h}}}], as: 'by_minute' }});
			included_units.push('$by_minute');
		}


		// DAY
		if (unit == "day") {
			let from = last_unit_ts('day', times);
			let till_d = moment.utc(convert_ts(from, 13)).add(1, 'day').startOf('day').unix();
			let till_h = moment.utc(convert_ts(from, 13)).add(1, 'hour').startOf('hour').unix();
			console.log("from:", moment.utc(from*1000).toISOString(), "("+from+")");
			console.log("hours till_d:", moment.utc(till_d*1000).toISOString(), "("+till_d+")");
			console.log("minutes till_h:", moment.utc(till_h*1000).toISOString(), "("+till_h+")");

			// the current day + previous including "times" span.
			// does not include most day ago (which we will include in next $lookup)
			unions.push({ $lookup: { from: 'by_day', pipeline: [{$match: {ts: {$gte: from}}}], as: 'by_day' }});
			included_units.push('$by_day');

			// include hours before the latest day (from previous union)
			unions.push({ $lookup: { from: 'by_hour', pipeline: [{$match: {ts: {$gte: from, $lt: till_d}}}], as: 'by_hour' }});
			included_units.push('$by_hour');

			// include minutes before the latest hour (from previous union)
			unions.push({ $lookup: { from: 'by_minute', pipeline: [{$match: {ts: {$gte: from, $lt: till_h}}}], as: 'by_minute' }});
			included_units.push('$by_minute');
		}


		// MONTH
		if (unit == "month") {
			let from = last_unit_ts('month', times);
			let till_m = moment.utc(convert_ts(from, 13)).add(1, 'month').startOf('month').unix();
			let till_d = moment.utc(convert_ts(from, 13)).add(1, 'day').startOf('day').unix();
			let till_h = moment.utc(convert_ts(from, 13)).add(1, 'hour').startOf('hour').unix();
			console.log("from:", moment.utc(from*1000).toISOString(), "("+from+")");
			console.log("days till_m:", moment.utc(till_m*1000).toISOString(), "("+till_m+")");
			console.log("hours till_d:", moment.utc(till_d*1000).toISOString(), "("+till_d+")");
			console.log("minutes till_h:", moment.utc(till_h*1000).toISOString(), "("+till_h+")");

			// the current month + previous including "times" span.
			// does not include most month ago (which we will include in next $lookup)
			unions.push({ $lookup: { from: 'by_month', pipeline: [{$match: {ts: {$gte: from}}}], as: 'by_month' }});
			included_units.push('$by_month');

			// the current day + previous including "times" span.
			// does not include most day ago (which we will include in next $lookup)
			unions.push({ $lookup: { from: 'by_day', pipeline: [{$match: {ts: {$gte: from, $lt: till_m}}}], as: 'by_day' }});
			included_units.push('$by_day');

			// include hours before the latest day (from previous union)
			unions.push({ $lookup: { from: 'by_hour', pipeline: [{$match: {ts: {$gte: from, $lt: till_d}}}], as: 'by_hour' }});
			included_units.push('$by_hour');

			// include minutes before the latest hour (from previous union)
			unions.push({ $lookup: { from: 'by_minute', pipeline: [{$match: {ts: {$gte: from, $lt: till_h}}}], as: 'by_minute' }});
			included_units.push('$by_minute');
		}



		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate(
				unions.concat([
					{ $project: { union: { $concatArrays: included_units } }},		// concat collections into single array
					{ $unwind: '$union' },
					{
						$project: {
							ts: 1,
							rnodes_: {
								$objectToArray: '$union.rnodes'
							}
						}
					},
					{ $unwind: '$rnodes_' },
					{ $match: { 'rnodes_.k': rnode_addr || { $exists: true } } },	// filter for rnode, if parameter given
					{ $group: {
						_id: '$rnodes_.k',
						mined: { $sum: '$rnodes_.v.mined' },
						rewards_from_fixed: { $sum: '$rnodes_.v.rewards_from_fixed' },
						rewards_from_fee: { $sum: '$rnodes_.v.rewards_from_fee' },
						rewards: { $sum: '$rnodes_.v.rewards' },
						impeached: { $sum: '$rnodes_.v.impeached' },
						//fees: { $sum: '$rnodes_.v.transactions_fee' },
						balance: { $last: '$rnodes_.v.balance' },
					} },
					{
						$project: {
							_id: 0,
							rnode: '$_id',
							mined: 1,
							impeached: 1,
							balance: { $add: [ '$balance', config.cpc.rnode_lock_amount_min ] },
							//fees: 1,
							//proposer: 1,
							rewards_from_fixed: 1,
							rewards_from_fee: 1,
							rewards: 1,
							rewards_usd: { $multiply: [ '$rewards', (await price.last()).USD.price ] },
							// calculte roi: cond to avoid 0 balance division
							roi_year: { $multiply: [ { $divide: [ '$rewards', { $add: [ '$balance', config.cpc.rnode_lock_amount_min ]} ] }, 100, time_multiply ] }
						}
					}
				])
			)
			.toArray((err, result) => {
				console.log("rewards.last(",unit, times,rnode_addr,")", now() - t_start);
				//console.log(result);

				if (err || result.length == 0) {
					console.error("rewards.last(",unit, times,rnode_addr,") error:", err);
					resolve(null);
				} else {
					// format to 2 digits after dot
					//Object.keys(result[0]).forEach(k => result[0][k] = result[0][k].toFixed(2));

					resolve(result);
				}
			});
	});
}
