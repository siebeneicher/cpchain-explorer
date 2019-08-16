const mongo = require('../mongo');
const config = require('../config');
const {convert_ts, last_unit_ts} = require('../helper');
const now = require('performance-now');
const {unitTs} = require('../middleware/aggregate');
const {web3} = require('../../cpc-fusion/api');
const moment = require('moment');
const price = require('./price');

module.exports = {last, last_merged, roi};

async function last_merged (unit, times, rnode_addr = null) {

	// sanitize given addr
	if (rnode_addr) rnode_addr = web3.utils.toChecksumAddress(rnode_addr);

	const merged = {
		rnodes: await last (unit, times, 'latest', rnode_addr),
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

	// avoid <200k balances, which means, the rnode has not enough balance anymore, and can dramatically change the average ROI
	for (let i in merged.rnodes) {
		if (merged.rnodes[i].balance < 200000)
			merged.rnodes.splice(i,1);
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
async function last (unit, times, ts_start = "latest", rnode_addr = null) {
	return new Promise(async function (resolve, reject) {
		const t_start = now();

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

		// final end if timespan
		let till_end = moment.utc().unix();			// aka latest
		let subtract_global = 0;
		if (ts_start == "prelatest") { 				// one complete timeframe before latest
			till_end = moment.utc().subtract(times, unit).unix();
			subtract_global = moment.utc().unix() - till_end;
		}
		//console.log("till_end", moment.utc(till_end*1000).toISOString(), "("+till_end+")");
		//console.log("subtract_global",subtract_global)

		try {
			if (unit == "minute") set_timespan_unions_by_minute(unit, times, ts_start, till_end, subtract_global, unions, included_units);
			if (unit == "hour") set_timespan_unions_by_hour(unit, times, ts_start, till_end, subtract_global, unions, included_units);
			if (unit == "day") set_timespan_unions_by_day(unit, times, ts_start, till_end, subtract_global, unions, included_units);
			if (unit == "month") set_timespan_unions_by_month(unit, times, ts_start, till_end, subtract_global, unions, included_units);
			if (unit == "year") set_timespan_unions_by_year(unit, times, ts_start, till_end, subtract_global, unions, included_units);
		} catch (e) {
			reject(e);
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
					{ $match: { '_id': { $ne: config.cpc.impeached_miner } } },
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
							roi_year: { $multiply: [ { $divide: [ '$rewards', { $add: [ '$balance', config.cpc.rnode_lock_amount_min ]} ] }, 100, time_multiply ] },
						}
					},
/*					{ $lookup: {
						from: 'balances',
						localField: 'rnode',
						foreignField: 'address',
						as: 'xxx'
					} }*/
				])
			)
			.toArray((err, result) => {
				console.log("rewards.last(",unit, times,rnode_addr,")", now() - t_start);
				//console.log(result);

				if (err) {
					console.error("rewards.last(",unit, times,rnode_addr,") error:", err);
					reject(err);
				} else {
					// format to 2 digits after dot
					//Object.keys(result[0]).forEach(k => result[0][k] = result[0][k].toFixed(2));

					resolve(result);
				}
			});
	});
}





async function roi (unit, times, ts_start = "latest") {
	return new Promise(async function (resolve, reject) {
		const t_start = now();

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

		// final end if timespan
		let till_end = moment.utc().unix();			// aka latest
		let subtract_global = 0;
		if (ts_start == "prelatest") { 				// one complete timeframe before latest
			till_end = moment.utc().subtract(times, unit).unix();
			subtract_global = moment.utc().unix() - till_end;
		}
		//console.log("till_end", moment.utc(till_end*1000).toISOString(), "("+till_end+")");
		//console.log("subtract_global",subtract_global)

		try {
			if (unit == "minute") set_timespan_unions_by_minute(unit, times, ts_start, till_end, subtract_global, unions, included_units);
			if (unit == "hour") set_timespan_unions_by_hour(unit, times, ts_start, till_end, subtract_global, unions, included_units);
			if (unit == "day") set_timespan_unions_by_day(unit, times, ts_start, till_end, subtract_global, unions, included_units);
			if (unit == "month") set_timespan_unions_by_month(unit, times, ts_start, till_end, subtract_global, unions, included_units);
			if (unit == "year") set_timespan_unions_by_year(unit, times, ts_start, till_end, subtract_global, unions, included_units);
		} catch (e) {
			reject(e);
		}

console.log(unions);

		mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
			.aggregate(
				unions.concat([
					{ $project: { union: { $concatArrays: included_units } }},		// concat collections into single array
					{ $unwind: '$union' },
					{
						$project: {
							ts: '$union.ts',
							_blocks_aggregated: '$union._blocks_aggregated',
							rnodes_: {
								$objectToArray: '$union.rnodes'
							}
						}
					},
					{ $unwind: '$rnodes_' },
					{ $project: {
						ts: 1,
						rnode: '$rnodes_.k',
						_blocks_aggregated: 1,
						rewards: '$rnodes_.v.rewards',
						balance: '$rnodes_.v.balance',
						rpt_max: '$rnodes_.v.rpt_max',
						//roi_year: { $multiply: [ { $divide: [ '$rnodes_.v.rewards', { $add: [ '$rnodes_.v.rewards', config.cpc.rnode_lock_amount_min ]} ] }, 100, time_multiply ] },
					} },
					{ $match: { rewards: { $gt: 0 } }},
					{ $group: {
						_id: '$rnode',
						_blocks_aggregated: { $sum: '$_blocks_aggregated' },
						rewards: { $sum: '$rewards' },
						balance_avg: { $avg: '$balance' },
						rpt_max: { $max: '$rpt_max' }
					} },
					/*{ $match: { '_id': { $ne: config.cpc.impeached_miner } } },
					{
						$project: {
							_id: 0,
							rnode: '$_id',
							balance: { $add: [ '$balance', config.cpc.rnode_lock_amount_min ] },
							rewards: 1,
							rpt_max: 1,
							rpt_avg: 1,
							// calculte roi: cond to avoid 0 balance division
							roi_year: { $multiply: [ { $divide: [ '$rewards', { $add: [ '$balance', config.cpc.rnode_lock_amount_min ]} ] }, 100, time_multiply ] },
						}
					},*/
				])
			)
			.toArray((err, result) => {
				console.log("rewards.roi(",unit, times,")", now() - t_start);
				//console.log(result);

				if (err) {
					console.error("rewards.roi(",unit, times,") error:", err);
					reject(err);
				} else {
					// format to 2 digits after dot
					//Object.keys(result[0]).forEach(k => result[0][k] = result[0][k].toFixed(2));

					resolve(result);
				}
			});
	});
}






function set_timespan_unions_by_year (unit, times, ts_start, till_end, subtract_global, unions, included_units) {

	if (ts_start == "prelatest") {
// TODOD: impelment
		throw "month prelatest not implemented";
	}


	let from = last_unit_ts('year', times);
	let till_y = moment.utc(convert_ts(from, 13)).add(1, 'year').startOf('year').unix();
	let till_m = moment.utc(convert_ts(from, 13)).add(1, 'month').startOf('month').unix();
	let till_d = moment.utc(convert_ts(from, 13)).add(1, 'day').startOf('day').unix();
	let till_h = moment.utc(convert_ts(from, 13)).add(1, 'hour').startOf('hour').unix();
	//console.log("from:", moment.utc(from*1000).toISOString(), "("+from+")");
	//console.log("days till_m:", moment.utc(till_m*1000).toISOString(), "("+till_m+")");
	//console.log("hours till_d:", moment.utc(till_d*1000).toISOString(), "("+till_d+")");
	//console.log("minutes till_h:", moment.utc(till_h*1000).toISOString(), "("+till_h+")");

	// the current month + previous including "times" span.
	// does not include most month ago (which we will include in next $lookup)
	unions.push({ $lookup: { from: 'by_year', pipeline: [{$match: {ts: {$gte: from}}}], as: 'by_year' }});
	included_units.push('$by_year');

	// the current month + previous including "times" span.
	// does not include most month ago (which we will include in next $lookup)
	unions.push({ $lookup: { from: 'by_month', pipeline: [{$match: {ts: {$gte: from, $lt: till_y}}}], as: 'by_month' }});
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

function set_timespan_unions_by_minute (unit, times, ts_start, till_end, subtract_global, unions, included_units) {
	let from = last_unit_ts('minute', times) - subtract_global;
	console.log("from:", moment.utc(from*1000).toISOString(), "("+from+") - ", moment.utc(till_end*1000).toISOString(), "("+till_end+")");

	// the current minute + previous including "times" span.
	// include minutes before the latest hour (from previous union)
	unions.push({ $lookup: { from: 'by_minute', pipeline: [{$match: {ts: {$gte: from, $lt: till_end}}}], as: 'by_minute' }});
	included_units.push('$by_minute');
}

function set_timespan_unions_by_month (unit, times, ts_start, till_end, subtract_global, unions, included_units) {
	let from = last_unit_ts('month', times) - subtract_global;

	if (ts_start == "latest") {
		let till_m = moment.utc(convert_ts(from, 13)).add(1, 'month').startOf('month').unix();
		let till_d = moment.utc(convert_ts(from, 13)).add(1, 'day').startOf('day').unix();
		let till_h = moment.utc(convert_ts(from, 13)).add(1, 'hour').startOf('hour').unix();
		//console.log("from:", moment.utc(from*1000).toISOString(), "("+from+")");
		//console.log("days till_m:", moment.utc(till_m*1000).toISOString(), "("+till_m+")");
		//console.log("hours till_d:", moment.utc(till_d*1000).toISOString(), "("+till_d+")");
		//console.log("minutes till_h:", moment.utc(till_h*1000).toISOString(), "("+till_h+")");

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

	if (ts_start == "prelatest") {
// TODOD: impelment
		throw "month prelatest not implemented";
	}
}


function set_timespan_unions_by_day (unit, times, ts_start, till_end, subtract_global, unions, included_units) {
	let from = last_unit_ts('day', times) - subtract_global;

	if (ts_start == "latest") {
		let till_d = moment.utc(convert_ts(from, 13)).add(1, 'day').startOf('day').unix();
		let till_h = moment.utc(convert_ts(from, 13)).add(1, 'hour').startOf('hour').unix();
		//console.log("from:", moment.utc(from*1000).toISOString(), "("+from+")");
		//console.log("hours till_d:", moment.utc(till_d*1000).toISOString(), "("+till_d+")");
		//console.log("minutes till_h:", moment.utc(till_h*1000).toISOString(), "("+till_h+")");

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

	if (ts_start == "prelatest") {
		let last_full_h = moment.utc(convert_ts(till_end, 13)).startOf('hour').unix();
		let first_full_h = moment.utc(convert_ts(from, 13)).add(1, 'hour').startOf('hour').unix();

		console.log("1st.min: ", moment.utc(last_full_h*1000).toISOString(), "  -  ", moment.utc(till_end*1000).toISOString());
		console.log("2nd.h:   ", moment.utc(first_full_h*1000).toISOString(), "  -  ", moment.utc(last_full_h*1000).toISOString());
		console.log("3nd.m:   ", moment.utc(from*1000).toISOString(), "  -  ", moment.utc(first_full_h*1000).toISOString());

		// 1. part gets covered by minutes
		unions.push({ $lookup: { from: 'by_minute', pipeline: [{$match: {ts: {$gte: last_full_h, $lt: till_end}}}], as: 'by_minute' }});
		included_units.push('$by_minute');

		// 2nd part a full hour(s)
		unions.push({ $lookup: { from: 'by_hour', pipeline: [{$match: {ts: {$gte: first_full_h, $lt: last_full_h}}}], as: 'by_hour' }});
		included_units.push('$by_hour');

		// 3rd again minutes to close to the last full hour
		unions.push({ $lookup: { from: 'by_minute', pipeline: [{$match: {ts: {$gte: from, $lt: first_full_h}}}], as: 'by_minute_2' }});
		included_units.push('$by_minute_2');
	}
}



function set_timespan_unions_by_hour (unit, times, ts_start, till_end, subtract_global, unions, included_units) {
	let from = last_unit_ts('hour', times) - subtract_global;

	if (ts_start == "latest") {
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

	if (ts_start == "prelatest") {
		// 1 hour prelatest can only be covered properly by 60 minutes, not by any hour unit, which would catch minutes outside the desired timespan
		let last_full_h = moment.utc(convert_ts(till_end, 13)).startOf('hour').unix();
		let first_full_h = moment.utc(convert_ts(from, 13)).add(1, 'hour').startOf('hour').unix();

		console.log("1st.min: ", moment.utc(last_full_h*1000).toISOString(), "  -  ", moment.utc(till_end*1000).toISOString());
		times != 1 && console.log("2nd.h:   ", moment.utc(first_full_h*1000).toISOString(), "  -  ", moment.utc(last_full_h*1000).toISOString());
		console.log("3nd.m:   ", moment.utc(from*1000).toISOString(), "  -  ", moment.utc(first_full_h*1000).toISOString());

		// 1. part gets covered by minutes
		unions.push({ $lookup: { from: 'by_minute', pipeline: [{$match: {ts: {$gte: last_full_h, $lt: till_end}}}], as: 'by_minute' }});
		included_units.push('$by_minute');

		// 2nd part a full hour(s)
		times != 1 && unions.push({ $lookup: { from: 'by_hour', pipeline: [{$match: {ts: {$gte: first_full_h, $lt: last_full_h}}}], as: 'by_hour' }});
		times != 1 && included_units.push('$by_hour');

		// 3rd again minutes to close to the last full hour
		unions.push({ $lookup: { from: 'by_minute', pipeline: [{$match: {ts: {$gte: from, $lt: first_full_h}}}], as: 'by_minute_2' }});
		included_units.push('$by_minute_2');
	}
}
