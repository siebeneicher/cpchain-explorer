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


let updateAll_promise = Promise.resolve();

async function updateAll () {
	// avoid parallel calls, instead chain them
	return updateAll_promise = updateAll_promise.then(_updateAll);

// TODO: aggregate.js cluster ready

	async function _updateAll () {
		return aggregate.run().then(async () => {

			await update_blocksSquared();

			return Promise.all([
				await dashboard.update(),
				rnodes.user.cache_flush_all(),		// instead of updating, we flush the existing entries
				rnodes.streamgraph.cache_flush_all(),
				transactions.streamgraph.cache_flush_all(),
			]);
		});
	}
}

async function update_blocksSquared () {

	// blocks-squared/:unit/:ts
	const today = moment.utc();
	today.second(0).minute(0).hour(0);
	const ts = today.unix()*1000;

	return blocks.squared.update('day', ts);


// TODO:
	const options = {
		url: config.server.scheme+'://'+config.server.host+':'+config.server.port+'/api/v1/blocks-squared/day/'+ts,
		headers: { 'cpc-explorer-force-no-cache': '1' }
	};

	return new Promise((resolve, reject) => {
		request(options, (error, response, body) => {
			if (error) {
				console.error(error, response, body);
			}

			if (!error && response.statusCode == 200) {
				console.log('update_blocksSquared() X-Response-Time:', response.headers['X-Response-Time']);
			}

			resolve();
		});
	});
}

//setTimeout(update_blocksSquared, 5000);


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
