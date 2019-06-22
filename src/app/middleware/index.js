const mongo = require('../mongo');
const config = require('../config');
const dashboard = require('./dashboard');
const aggregate = require('./aggregate');

let updateAll_promise = Promise.resolve();

/*async function rnode (addr) {
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
}*/

async function updateAll () {
	// avoid parallel calls, instead chain them
	return updateAll_promise = updateAll_promise.then(_updateAll);

	async function _updateAll () {
		return aggregate.run().then(async () => {
			return Promise.all([
				dashboard.update()
			]);
		});
	}
}

module.exports = {
	updateAll,
	dashboard,
	aggregate
};
