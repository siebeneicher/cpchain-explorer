const mongo = require('../mongo');
const config = require('../config');
const dashboard = require('./dashboard');
const aggregate = require('./aggregate');
const addresses = require('./addresses');
const blocks = require('./blocks');
const transactions = require('./transactions');
const rnodes = require('./rnodes');
const search = require('./search');
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

			return Promise.all([
				update_blocksSquared(),
				update_dashboard(),
				update_rnodes_watched(),
				rnodes.streamgraph.cache_flush_all(),
				transactions.graph.cache_flush_all(),
			]);
		}).then(() => {
			console.log("updateAll() took", now()-t_start);
		});
	}
}


async function update_blocksSquared () {
	// blocks-squared/:unit/:ts
	const unit = "day";
	const t = moment.utc();

	t.second(0).minute(0).hour(0);
	const today = t.unix()*1000;

	t.subtract(1, 'd');
	const yesterday = t.unix()*1000;

	t.subtract(1, 'd');
	const yesterday2 = t.unix()*1000;

	// 1. regenerate fresh data, cache in middleware-cache
	await blocks.squared.update('day', today);
	await blocks.squared.update('day', yesterday);
	await blocks.squared.update('day', yesterday2);

	// 2. invalidate frontend-cache, which will, on next request use the middleware-cache 
	return cache_fe.invalidate("/api/v1/blocks-squared/"+unit+"/*");
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






module.exports = {
	updateAll,
	dashboard,
	blocks,
	aggregate,
	addresses,
	rnodes,
	kpi,
	transactions,
	search
};
