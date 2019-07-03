const mongo = require('../mongo');
const config = require('../config');
const dashboard = require('./dashboard');
const aggregate = require('./aggregate');
const blocks = require('./blocks');
const rnodes = require('./rnodes');
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
				await rnodes.streamgraph.update('hour', 24, 'latest'),
				await rnodes.streamgraph.update('hour', 48, 'latest'),
				await rnodes.streamgraph.update('day', 7, 'latest'),
				await rnodes.streamgraph.update('day', 14, 'latest'),
				await rnodes.streamgraph.update('day', 30, 'latest'),
			]);
		});
	}
}

module.exports = {
	updateAll,
	dashboard,
	blocks,
	aggregate,
	rnodes,
	kpi
};
