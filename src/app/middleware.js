const mongo = require('./mongo');
const config = require('./config');
const {promisify} = require('util');
const redis = require('./redis');
const now = require('performance-now');

const CACHE_KEY_OVERVIEW = 'CPC-DATA-OVERVIEW';
const CACHE_EXPIRE_DEFAULT = 10000;

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

async function overview () {

	// TODO: cache, un-cache
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
			}
		};

		//redis.set(CACHE_KEY_OVERVIEW, data);
		//redis.expire(CACHE_EXPIRE_DEFAULT, 10);

		console.log("overview() took: ", now() - t_start);
		resolve(data);
	});


	async function block_last (unit) {
		return new Promise(async function (resolve, reject) {
			mongo.db(config.mongo.db.aggregation).collection('by_'+unit)
				.find({})
				.project({_id:0, ts:1, blocks_mined:1, blocks_impeached:1})
				.limit(1)
				.sort({ts: -1})
				.toArray((err, result) => {
					if (err || result.length == 0) {
						console.error("overview data, mongo_db_aggregation_by."+unit+".find:", err, result);
						resolve(null);
					} else {
						resolve(result[0]);
					}
				});
		});
	}
}

async function updateOverviewData () {

}

async function aggregate (from, to) {

	// from, to (13 digit timestamp)

	return new Promise(async function (resolve, reject) {
		const t_start = now();

		// aggregate by unit
		const aggregate = {};
		const units = ['minute','hour','day','month','year'];
		const units_reduce_moment_fn = ['seconds','minutes','hours','days','month'];

		await new Promise(function (resolve2, reject2) {
			mongo_db_blocks.find({
				timestamp: {$gte: from, $lte: to}
			}).toArray((err, blocks) => {
				console.log("blocks for aggregation found: ", blocks.length);

				let aggregate_tpl = {
					blocks_mined: 0,
					blocks_impeached: 0,
					blocks_mined_by_node: {},
				};
				units.forEach(unit => aggregate[unit] = {});

				let b, t, m, is_impeached;
				for (let key in blocks) {
					b = blocks[key];
					m = b.miner;
					t = moment(b.timestamp);
					is_impeached = m == '0x0000000000000000000000000000000000000000';

					units.forEach((unit,i) => {
						t[units_reduce_moment_fn[i]](0);
						let ts = parseInt(t.unix());		// 10 digit timestamp enough to cluster by unit

						// init
						if (aggregate[unit][ts] === undefined) aggregate[unit][ts] = clone(aggregate_tpl);

						// Blocks mined by node
						if (aggregate[unit][ts].blocks_mined_by_node[m] === undefined) aggregate[unit][ts].blocks_mined_by_node[m] = 0;
						aggregate[unit][ts].blocks_mined_by_node[m]++;

						// blocks total / impeached
						if (!is_impeached) aggregate[unit][ts].blocks_mined++;
						else aggregate[unit][ts].blocks_impeached++;
					});
				}

				resolve2();
			});
		});

		// SYNC MONGO
		await Promise.all(units.map(unit => {
			// remove previous aggregation for timespan
			const filter = {ts: {$gte: from/1000, $lte: to/1000}};
			return mongo.db(config.mongo.db.aggregation).collection('by_'+unit).deleteMany(filter).then((res) => {
				console.log("Deleted aggregations ("+unit+",",filter,"):",res.result.n);

				// add aggregation to database
				return mongo.db(config.mongo.db.aggregation).collection('by_'+unit).insertMany(Object.entries(aggregate[unit]).map(_ => Object.assign({ts: parseInt(_[0])}, _[1]))).then((res) => {
					console.log("Inserted aggregations ("+unit+"):", res.result.n);
				});
			});
		}));

		console.log('Aggregation done in ', now() - t_start);
		resolve();
	});
}


function clone (obj) {
	return JSON.parse(JSON.stringify(obj));
}

function convert_ts (ts, digits = 10) {
	let l = (ts+"").length;

	if (l == d) return ts;
	if (l == 10 && digits == 13) return ts*1000;
	if (l == 13 && digits == 10) return Math.floor(ts/1000);
}


module.exports = {rnode, overview};
