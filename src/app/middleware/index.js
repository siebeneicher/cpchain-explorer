const mongo = require('../mongo');
const config = require('../config');
const redis = require('../redis');
const {promisify} = require('util');

const now = require('performance-now');
const moment = require('moment');

const {convert_ts, clone} = require('../helper');

const CACHE_KEY_DASHBOARD = 'CPC-DATA-DASHBOARD';
const CACHE_EXPIRE_FOREVER = 99999999999;			// redis cache lives forever, values are updated via sync.js



async function rnode (addr) {
	const data = {rnode: addr, impeached: []};

	return new Promise(function (resolve, reject) {
		// impeached blocks by addr
		const impeachedOptions = {'generation.Proposers': addr, 'generation.Proposer': '0x0000000000000000000000000000000000000000'};
		mongo.db(config.mongo.db.chain).collection('generation').find(impeachedOptions).toArray((err, gens) => {

			for (let key in gens) {
				let gen = gens[key];

				if (gen.generation.Proposers[gen.generation.View] == addr) {
					data.impeached.push(gen);
				}
			}

			resolve(data);
		});
	});
}

async function updateDashboard () {
	//from = new Date().getTime();		// GMT-0

	return new Promise(async function (resolve, reject) {
		const t_start = now();

		const data = {
			last_blocks: {
				minute: await block_last('minute'),
				hour: await block_last('hour'),
				day: await block_last('day'),
				month: await block_last('month'),
				year: await block_last('year')
			},
			last_transactions: {
				minute: await transaction_last('minute'),
				hour: await transaction_last('hour'),
				day: await transaction_last('day'),
				month: await transaction_last('month'),
				year: await transaction_last('year')
			},
			rnodes_count: {
				minute: await rnodes_count('minute'),
				hour: await rnodes_count('hour'),
				day: await rnodes_count('day'),
				month: await rnodes_count('month'),
				year: await rnodes_count('year')
			}
		};

		redis.set(CACHE_KEY_DASHBOARD, data);
		redis.expire(CACHE_KEY_DASHBOARD, CACHE_EXPIRE_FOREVER);

		console.log("dashboard-data generated, took: ", now() - t_start);
		resolve(data);
	});

	async function block_last (unit) {
		return new Promise(async function (resolve, reject) {
			const t_start = now();
			mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
				.find({})
				.project({_id:0, ts:1, blocks_mined:1, blocks_impeached:1})
				.limit(1)
				.sort({ts: -1})
				.toArray((err, result) => {
					console.log("dashboard-data block_last ("+unit+") mongo find(), took: ", now() - t_start);

					if (err || result.length == 0) {
						console.error("overview data, mongo_db_aggregation_by."+unit+".find:", err, result);
						resolve(null);
					} else {
						resolve(result[0]);
					}
				});
		});
	}

	async function transaction_last (unit) {
		return new Promise(async function (resolve, reject) {
			const t_start = now();
			mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
				.find({})
				.project({_id:0, ts:1, transactions_count:1, transactions_volume:1})
				.limit(1)
				.sort({ts: -1})
				.toArray((err, result) => {
					console.log("dashboard-data transactions_last ("+unit+") mongo find(), took: ", now() - t_start);

					if (err || result.length == 0) {
						console.error("overview data, mongo_db_aggregation_by."+unit+".find:", err, result);
						resolve(null);
					} else {
						resolve(result[0]);
					}
				});
		});
	}

	async function rnodes_count (unit) {
		return new Promise(async function (resolve, reject) {
			const t_start = now();
			mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
				.find({})
				.project({_id:0, rnodes:1})
				.limit(1)
				.sort({ts: -1})
				.toArray((err, result) => {
					console.log("dashboard-data rnodes ("+unit+") mongo find(), took: ", now() - t_start);

					if (err || result.length == 0) {
						console.error("overview data, mongo_db_aggregation_by."+unit+".find:", err, result);
						resolve(null);
					} else {
						resolve(result[0].rnodes.length);
					}
				});
		});
	}
}

async function dashboard () {
	let data = await redis.get(CACHE_KEY_DASHBOARD);

// TODO: updateDashboard() is not multi-node instance safe
	if (data) console.log("Serving dashboard from redis");
	if (!data)
		data = await updateDashboard();

	return data;
}


module.exports = {rnode, dashboard, aggregate: require('./aggregate')};
