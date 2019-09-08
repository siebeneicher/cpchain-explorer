const mongo = require('../mongo');
const config = require('../config');
const dashboard = require('./dashboard');
const aggregate = require('./aggregate');
const addresses = require('./addresses');
const price = require('./price');
const blocks = require('./blocks');
const transactions = require('./transactions');
const rnodes = require('./rnodes');
const search = require('./search');
const data = require('./../data');
const kpi = require('./kpi');
const moment = require('moment');
const request = require('request');
const now = require('performance-now');
const cache_fe = require('../cache-fe');



let updateAll_promise = Promise.resolve();

async function updateAll () {
	// avoid parallel calls, instead chain them
	return updateAll_promise = updateAll_promise.then(_updateAll);

// TODO: aggregate.js cluster ready

	async function _updateAll () {
		const t_start = now();

		return aggregate.run().then(async () => {

			// last block has priority over all other stats
			await update_lastBlock();

			return Promise.all([
				update_blocksSquared(),
				update_dashboard(),
				update_rnodes_watched(),
				update_balance_ranks(),
				update_rnodes_overview(),

				rnodes.streamgraph.cache_flush_all(),
				rnodes.timeline.cache_flush_all(),
				transactions.graph.cache_flush_all(),
			]);
		}).then(() => {
			console.log("updateAll() took", now()-t_start);
		});
	}
}

async function update_lastBlock () {
	// 1. update middleware cache
	await blocks.last(true);

	// 2. invalidate frontend-cache, which will, on next request use the middleware-cache 
	return cache_fe.invalidate("/api/v1/block/last");
}

async function update_blocksSquared () {
	// blocks-squared/:unit/:ts
	const unit = "day";
	const t = moment.utc();

	t.second(0).minute(0);
	const hourNow = t.unix()*1000;

	t.hour(0);
	const today = t.unix()*1000;

	// 1. regenerate fresh data, cache in middleware-cache
	await blocks.squared.update('day', today);
	await blocks.squared.update('hour', hourNow);

	// 2. invalidate frontend-cache, which will, on next request use the middleware-cache 
	return cache_fe.invalidate("/api/v1/blocks-squared/*");
}


async function update_dashboard () {
	await dashboard.update(true);

	// 2. invalidate frontend-cache, which will, on next request use the middleware-cache 
	return cache_fe.invalidate("/api/v1/dashboard");
}


async function update_rnodes_watched () {
	rnodes.user.cache_flush_all();		// instead of updating, we flush the existing entries

	// 2. invalidate frontend-cache, which will, on next request use the middleware-cache 
	return cache_fe.invalidate("/api/v1/rnode/user/*");
}


async function update_balance_ranks () {
	await data.balances.ranking_update();

	// 2. invalidate frontend-cache, which will, on next request use the middleware-cache 
	return cache_fe.invalidate("/api/v1/addresses");
}


async function update_rnodes_overview () {
	rnodes.all.cache_flush_all();		// instead of updating, we flush the existing entries

	// 2. invalidate frontend-cache, which will, on next request use the middleware-cache 
	return cache_fe.invalidate("/api/v1/rnodes/*");
}




module.exports = {
	updateAll,
	update_lastBlock,
	update_blocksSquared,
	update_dashboard,
	update_rnodes_watched,
	update_balance_ranks,
	update_rnodes_overview,

	dashboard,
	blocks,
	aggregate,
	addresses,
	rnodes,
	kpi,
	transactions,
	price,
	search
};
