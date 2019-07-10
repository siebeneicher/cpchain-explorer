const {blockNumber, versions, rnodes, block, generation, transaction, web3, balance} = require('./cpc-fusion/api');
const mongo = require('./app/mongo');
const config = require('./app/config');
const now = require('performance-now');
const moment = require('moment');
const {convert_ts, last_unit_ts} = require('./app/helper');
const {messaging} = require('./app');

// shortcut to collections
let mongo_db, mongo_db_blocks, mongo_db_transactions, mongo_db_rnodes, mongo_db_generation, mongo_db_balances;

let cur_rnodes = [];				// most recent rnodes synced
let cur_generation = {};			// most recent block generation info synced
let last_blockNumber = 0;			// most recent block number
let last_blockNumber_synced = 0;	// most recent synced

const sync_delay = 500;
const backwards_delay = 5000;
const balance_delay = 10000;
const maxNewBlocksBackwardsPerCycle = 15;


// linux> mongodump --db cpc_watcher
// windows> "C:\Program Files\MongoDB\Server\4.0\bin\mongorestore.exe" --db cpc_watcher --dir "D:\Bitbucket\cpc_watcher\dumpos\cpc_watcher"



function subscribe () {
// WS NOT YET WORKING ON CPC NODE
	web3.eth.subscribe('logs', {}, (error, result) => {
		console.log('log:', result, error);
	});
}

async function collect () {
	_snapshot();
	_syncBackwards();
	_syncBalances();

	function _snapshot () {
		setTimeout(async () => {
			try {
				if (await snapshot()) {
					messaging.emit('SYNC-SNAPSHOT-PERFORMED', {});
				}
			} catch (err) {
				console.error(err);
			}

			_snapshot();	// loop
		}, sync_delay);
	}

	function _syncBackwards () {
		setTimeout(async () => {
			try {
				if (await syncBackwards()) {
					messaging.emit('SYNC-BACKWARDS-PERFORMED', {});
				}
			} catch (err) {
				console.error(err);
			}

			_syncBackwards();	// loop
		}, backwards_delay);
	}

	function _syncBalances () {
		setTimeout(async () => {
			try {
				if (await syncBalances()) {
					messaging.emit('SYNC-BALANCES-PERFORMED', {});
				}
			} catch (err) {
				console.error(err);
			}

			_syncBalances();	// loop
		}, balance_delay);
	}
}

async function syncBalances () {
	return new Promise ((resolve, reject) => {
		const t_start = now();
		const from_ts = moment().subtract('1', 'week').unix();

		// fetch rnode IDs
		mongo.db(config.mongo.db.sync).collection('rnodes')
			.aggregate([
				{ $match: { ts: { $gte: from_ts } } },
				{ $unwind: '$rnodes' },
				{ $group: {
					_id: '$rnodes.Address'
				} },
				{ $project: { _id: 0, address: '$_id' } }
			])
			.toArray((err, result) => {
				if (err) {
					reject();
					console.error(err);
				} else if (result.length == 0) {
					resolve(null);
				} else {
					console.log("syncBalances() mongo-request found "+result.length+" rnodes, took:", now() - t_start);
					resolve(result);
				}
			});
	}).then(async (rnodes) => {
		const t_start = now();

		// get balances from node
		for (let k in rnodes) {
			let ts = convert_ts(new Date().getTime(), 10);
			let _balance = await balance(rnodes[k].address);

			// insert only new rnode address
			// update last_balance + ts
			// push new balanace history element
			await mongo_db_balances.updateOne({
				address: rnodes[k].address
			}, {
				$set: { address: rnodes[k].address, latest_balance: _balance }
			}, { upsert: true }).then(async (result, err) => {
				if (err) {
					console.error(err);
					return Promise.reject(err);
				}

				if (result.upsertedId || result.modifiedCount) {
					// either initial insert or update occured (= balance has changed since last update)
					// then go and push new history
					return mongo_db_balances.updateOne({
						address: rnodes[k].address
					}, {
						$push: { history: { ts, balance: _balance } }
					}, { upsert: true }).then((result, err) => {
						console.log("pushed balance history to addr", rnodes[k].address, "new balance:", _balance);
					});
				}
			});
		}

		//console.log(rnodes);
		console.log("syncBalances() total time:", now() - t_start);

		return rnodes.length;
	});
}


async function syncBackwards () {
	let latest = await blockNumber();

	// TODO: make this function big data proof

	// sync all blocks
	return new Promise ((resolve, reject) => {
		mongo_db_blocks.find({}).project({_id:-1, number: 1}).toArray(async function (err, items) {
			let numbers = items.map(b => b.number);

			console.log("Sync backwards: ",items.length,"(total synced) vs", latest, "(last block number)");

			let i = latest, new_blocks = 0;
			while (i > 1) {
				i--;
				if (numbers.includes(i)) continue;

				new_blocks++;

				// sync missing block
				try {
					await syncBlock(i);
				} catch (err) {
					console.error(err);
				}

				if (new_blocks >= maxNewBlocksBackwardsPerCycle) break;
			}

			resolve(new_blocks);
		});
	});
}
async function snapshot () {
	let has_new = await syncBlock();

	if (!has_new)
		return Promise.resolve(false);

	return syncRNodes();  //Promise.all([syncRNodes(), syncGeneration()]);
}
async function syncBlock (targetBlockNum = null) {
	const t_start = now();
	const cur_blockNum = await blockNumber();
	let number;

	// default: last block
	if (targetBlockNum === null) {
		number = cur_blockNum;

		// no new block
		if (last_blockNumber_synced == number)
			return Promise.resolve(false);

		// remember block being synced
		last_blockNumber_synced = number;
	} else {
		number = targetBlockNum;
	}

	const b = await block(number);

	b.__generation = (number == cur_blockNum) ? await generation(number) : null;
	b.__aggregated = {
		by_minute: false,
		by_hour: false,
		by_day: false,
		//by_week: false,
		by_month: false,
		by_year: false
	};

	sanitizeBlock(b);

	// split transactions into different db.collection
	b.transactions.forEach(trx => sanitizeTransaction(trx));
	const trxs = b.transactions;
	b.transactions = b.transactions.map(trx => trx.hash);

	await mongo_db_blocks.updateOne({ number: number }, { $set: b }, { upsert: true });			// insert block into mongo, if not yet done so
	console.log("added block (generation: "+!!b.__generation+"):", number, "took:", now()-t_start);

	if (!trxs || !trxs.length) return Promise.resolve(true);

	try {
		for (let i in trxs) {
			await mongo_db_transactions.updateOne({hash: trxs[i].hash}, {$set: trxs[i]}, { upsert: true });			// insert transaction into mongo, if not yet done so
			console.log("added transaction:", trxs[i].hash);
		}
	} catch (err) {
		console.error(err);
	}

	return Promise.resolve(true);	
}

function sanitizeBlock (block) {
	block.miner = web3.utils.toChecksumAddress(block.miner);
	if (block.__generation) {
		block.__generation.Proposer = web3.utils.toChecksumAddress(block.__generation.Proposer);
		block.__generation.Proposers = block.__generation.Proposers.map(_ => web3.utils.toChecksumAddress(_));
	}
	if (block.dpor) {
		block.dpor.proposers = block.dpor.proposers.map(_ => web3.utils.toChecksumAddress(_));
	}
}

function sanitizeRNodes (rnodes) {
	rnodes.forEach(rnode => rnode.Address = web3.utils.toChecksumAddress(rnode.Address));
}

function sanitizeTransaction (trans) {
	trans.from = web3.utils.toChecksumAddress(trans.from);
	trans.to = web3.utils.toChecksumAddress(trans.to);
}

/*async function syncTransaction (txn) {
	try {
		const t_start = now();
		const trx = await transaction(txn);
		sanitizeTransaction(trx);
		await mongo_db_transactions.updateOne({hash: txn}, {$set: trx}, { upsert: true });			// insert transaction into mongo, if not yet done so
		console.log("added transaction:", txn, "took:", now()-t_start);
	} catch (err) {
		console.error(err);
		return Promise.reject();
	}

	return Promise.resolve();
}*/

async function syncRNodes () {
	const t_start = now();
	const ts = Math.floor(new Date() / 1000);

	return rnodes().then(async (_rnodes) => {
		//console.log(_rnodes);

		// store only new versions
		if (JSON.stringify(_rnodes) != JSON.stringify(cur_rnodes)) {
			cur_rnodes = _rnodes;
			sanitizeRNodes(_rnodes);
			await mongo_db_rnodes.insertOne({ts, rnodes: _rnodes});
			console.log("added rnodes, took:", now()-t_start);
			return true;
		}

		return false;
	});
}

async function syncGeneration () {
	const ts = Math.floor(new Date() / 1000);

	return generation().then(async (_generation) => {
		// store only new versions
		if (JSON.stringify(_generation) != JSON.stringify(cur_generation)) {
			cur_generation = _generation;
			await mongo_db_generation.insertOne({ts, _generation});
			console.log("added generation");
			return true;
		}
		return false;
	});
}

/*async function sendTestTrx () {
	let from = "0x6026ab99f0345e57c7855a790376b47eb308cb40";
	let to = "0xcdc888799762436da4d4c9b171ae2a1008cde986";
	let amount = "1000000000000000000";

	console.log("sendTestTrx() sending", amount, "from:", from, "to:", to);

	try {
		let t = await web3.eth.sendTransaction({from, to, value: amount});
		console.log("sendTestTrx() done", t);
	} catch (e) {
		console.error(e);
	}

	return Promise.resolve();
}*/

async function clearAll () {
	console.log("Dropping all data from mongo");
	await mongo_db_blocks.drop();
	await mongo_db_transactions.drop();
	await mongo_db_rnodes.drop();
	await mongo_db_generation.drop();
}

function ensure_indexes () {
	console.log('ensure indexes');

	// CREATE INDEXES FOR SYNC COLLECTION
	if (mongo_db_blocks) {
		mongo_db_blocks.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.timestamp_1)
				await mongo_db_blocks.createIndex({ timestamp: -1 }, { unique: true });
			if (!indexes.number_1)
				await mongo_db_blocks.createIndex({ number: -1 }, { unique: true });
			if (!indexes['__aggregated.by_minute_1'])
				await mongo_db_blocks.createIndex({ '__aggregated.by_minute': 1 }, { unique: false });
			if (!indexes['__aggregated.by_hour_1'])
				await mongo_db_blocks.createIndex({ '__aggregated.by_hour': 1 }, { unique: false });
			if (!indexes['__aggregated.by_day_1'])
				await mongo_db_blocks.createIndex({ '__aggregated.by_day': 1 }, { unique: false });
			if (!indexes['__aggregated.by_month_1'])
				await mongo_db_blocks.createIndex({ '__aggregated.by_month': 1 }, { unique: false });
			if (!indexes['__aggregated.by_year_1'])
				await mongo_db_blocks.createIndex({ '__aggregated.by_year': 1 }, { unique: false });
		})
	}

	if (mongo_db_generation) {
		mongo_db_generation.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.ts_1)
				await mongo_db_generation.createIndex({ ts: -1 }, { unique: true });
			if (!indexes['generation.BlockNumber_1'])
				await mongo_db_generation.createIndex({ 'generation.BlockNumber': -1 }, { unique: false });
		})
	}

	if (mongo_db_rnodes) {
		mongo_db_rnodes.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.ts_1)
				await mongo_db_rnodes.createIndex({ ts: -1 }, { unique: true });
		})
	}

	if (mongo_db_balances) {
		mongo_db_balances.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.ts_1)
				await mongo_db_balances.createIndex({ ts: -1 }, { unique: false });
			if (!indexes.balance_1)
				await mongo_db_balances.createIndex({ balance: 1 }, { unique: false });
			if (!indexes.address_1)
				await mongo_db_balances.createIndex({ address: 1 }, { unique: true });
		})
	}

	if (mongo_db_transactions) {
		mongo_db_transactions.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.blockHash_1)
				await mongo_db_transactions.createIndex({ blockHash: 1 }, { unique: false });
			if (!indexes.blockNumber_1)
				await mongo_db_transactions.createIndex({ blockNumber: -1 }, { unique: false });
			if (!indexes.hash_1)
				await mongo_db_transactions.createIndex({ hash: 1 }, { unique: true });
		})
	}
}

async function init (clearAll = false) {
	return new Promise((resolve, reject) => {
		mongo.on('connect', async function(err, client) {
			if (err) reject(err);

			mongo_db = client.db(config.mongo.db.sync);
			mongo_db_blocks = mongo_db.collection('blocks');
			mongo_db_transactions = mongo_db.collection('transactions');
			mongo_db_rnodes = mongo_db.collection('rnodes');
			mongo_db_balances = mongo_db.collection('balances');
			mongo_db_generation = mongo_db.collection('generation');

			// clear all data
			if (clearAll) {
				clearAll();
			}

			// ensure indexes (background indexing)
			ensure_indexes();

			resolve();
		});
	});
}

init(false).then(collect);
