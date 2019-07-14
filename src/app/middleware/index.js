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

let updateAll_promise = Promise.resolve();

async function updateAll () {
	// avoid parallel calls, instead chain them
	return updateAll_promise = updateAll_promise.then(_updateAll);

	async function _updateAll () {
		return aggregate.run().then(async () => {
			return Promise.all([
				await dashboard.update(),
				await blocks.squared.update('day', moment.utc().unix()),
				rnodes.user.cache_flush_all(),		// instead of updating, we flush the existing entries
				rnodes.streamgraph.cache_flush_all(),
				transactions.streamgraph.cache_flush_all(),
			]);
		});
	}
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
