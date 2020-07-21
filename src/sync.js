const {blockNumber, versions, rnodes, block, generation, transaction, web3, balance, blockProposer} = require('./cpc-fusion/api');
const mongo = require('./app/mongo');
const { balances, addresses, blocks: data_blocks } = require('./app/data');
const _data = require('./app/data');
const config = require('./app/config');
const now = require('performance-now');
const moment = require('moment');
const request = require('request-promise-native');
const {convert_ts, last_unit_ts, isNumeric} = require('./app/helper');
const {messaging} = require('./app');

// shortcut to collections
let mongo_db, mongo_db_blocks, mongo_db_transactions, mongo_db_rnodes, mongo_db_balances, mongo_db_price_cmc;

let cur_rnodes = [];				// most recent rnodes synced
let cur_generation = {};			// most recent block generation info synced
let last_blockNumber = 0;			// most recent block number

const max_backwards = 3 * 60*6;		// 3h; max limit of time to look for missing blocks backwards
const sync_delay = 250;
const cpc_price_delay = 1000 * 60 * 10;		// basic plan: 333 reqs / day
const backwards_delay = 30000;				// each 30 secs.
const sync_missing_addresses_delay = 5000;
const maxNewBlocksBackwardsPerCycle = 25000;
const sync_balances_delay = 1000 * 60 * 60 * 1;			// every hour
const sync_rnodesFirstNLastBlockDate_delay = 1000 * 60 * 60 * 24;	// every 24 hour

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
	_syncNewAddressBalanceFromTransactions();
	_syncCPCPrice();
	_syncBalances();
	//_syncRNodesFirstNLastBlockDate();

	function _snapshot () {
		setTimeout(async () => {
			try {
				let newBlock = await syncBlock();
				if (newBlock) {
					// inform aggregation to process
					messaging.emit('SYNC-NEW-BLOCK', {});

					// rnodes and balance update can be performed after aggregation, in parallel
					await Promise.all([
						syncGeneration(),
						syncRNodes(),
						updateBalancesOfBlockAddresses(newBlock.b, newBlock.trxs)
					]);

					messaging.emit('SYNC-RNODES-N-BALANCES-PERFORMED', {});
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

	function _syncNewAddressBalanceFromTransactions () {
		setTimeout(async () => {
			try {
				if (await syncNewAddressBalanceFromTransactions()) {
					messaging.emit('SYNC-MISSING-BALANCES-PERFORMED', {});
				}
			} catch (err) {
				console.error(err);
			}

			_syncNewAddressBalanceFromTransactions();	// loop
		}, sync_missing_addresses_delay);
	}

	function _syncCPCPrice () {
		setTimeout(async () => {
			try {
				if (await syncCPCPrice()) {
					messaging.emit('SYNC-CPC-PRICE', {});
				}
			} catch (err) {
				console.error(err);
			}

			_syncCPCPrice();	// loop
		}, cpc_price_delay);
	}

	function _syncBalances () {
		setTimeout(async () => {
			try {
				if (await syncBalances()) {
					messaging.emit('SYNC-BALANCES', {});
				}
			} catch (err) {
				console.error(err);
			}

			_syncBalances();	// loop
		}, sync_balances_delay);
	}

	function _syncRNodesFirstNLastBlockDate () {
		setTimeout(async () => {
			try {
				if (await syncRNodesFirstNLastBlockDates()) {
					messaging.emit('SYNC-RNODES-DATES', {});
				}
			} catch (err) {
				console.error(err);
			}

			_syncRNodesFirstNLastBlockDate();	// loop
		}, sync_rnodesFirstNLastBlockDate_delay);
	}
}

async function syncCPCPrice () {
	const opts = {
		method: 'GET',
		uri: config.coinmarketcap.api_url+'/v1/cryptocurrency/quotes/latest',
		qs: {
			'id': config.coinmarketcap.cpc_id
		},
		headers: {
			'X-CMC_PRO_API_KEY': config.coinmarketcap.api_key
		},
		json: true,
		gzip: true
	};

	return request(opts).then(async (res) => {
		console.log("counmarketca api response:",res);
		res.data[config.coinmarketcap.cpc_id].ts = moment.utc().unix();
		return mongo_db_price_cmc.insertOne(res.data[config.coinmarketcap.cpc_id]);
	}).catch((err) => {
		console.log('Coinmarketcap API call error:', err.message);
	});
}


async function syncNewAddressBalanceFromTransactions () {
	return new Promise ((resolve, reject) => {
		let t_start = now();

		// fetch known addresses
		mongo_db_balances.find({}, {address:1}).toArray(async (err, addresses) => {
			//console.log("syncNewAddressBalanceFromTransactions() get existing balances (",addresses?addresses.length:0,"), took:", now() - t_start);

			let ignore_addresses = addresses.map(_ => _.address);

			let before = moment.utc();
			before.subtract(1, 'h');

			let t_start2 = now();

			let aggr = [
				{ $match: { __ts: { $gte: before.unix()*1000 }}},
				{ $project: { "addresses": {
					$split: [{$concat: ["$from","---","$to"]}, '---']
				} } },
				{ $unwind: '$addresses' },
				{ $match: { addresses: { $nin: ignore_addresses } } },
				{ $group: { _id: '$addresses' } }
			];

			// DEBUG: EXPLAIN
/*			let expl = await mongo.db(config.mongo.db.sync).collection('transactions').aggregate(aggr).explain();
			expl;*/

			// fetch new addresses
			mongo.db(config.mongo.db.sync).collection('transactions')
				.aggregate(aggr)
				.toArray(async (err, addresses) => {
					//console.log("syncNewAddressBalanceFromTransactions() get new addresses from trx's (",addresses?addresses.length:0,"), took:", now() - t_start2);

					//console.log(addresses);
					if (!err && addresses && addresses.length) {
						for (let i in addresses) {
							let address = addresses[i]._id;
							try {
								let latest_balance = await balance(address);
								await mongo_db_balances.insertOne({ address, latest_balance });
								console.log("new address added:",address,"balance:",latest_balance);
							} catch (err) {
								console.error("[ERROR] adding new address with balance", addresses[i]);
							}
						}
					}

					resolve();
				});

		});
	});
}


async function syncBackwards () {
	const t_start = now();
	console.log("syncBackwards()...")

	let latest = await blockNumber();

	// TODO: make this function big data proof


	// sync all blocks
	return new Promise ((resolve, reject) => {
		mongo_db_blocks.find({}).project({number: 1}).sort({number:-1}).limit(max_backwards).toArray(async function (err, items) {
			let numbers = items.map(b => b.number);

			console.log("Sync backwards: ",items.length,"(total synced) vs", latest, "(last block number)");

			let i = latest, new_blocks = 0, limit = latest - max_backwards + 1;
			while (i > limit) {
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

			console.log("Sync backwards (synced: "+new_blocks+") took:",now()-t_start);

			resolve(new_blocks);
		});
	});
}

// call this function to reset all blocks and sync all blocks at once
async function resetAndSyncAllBlocks () {
	const t_start = now();

	let latest = await blockNumber();

	// sync all blocks
	return new Promise (async function (resolve, reject) {
		let i = latest, new_blocks = 0, limit = 0;
		while (i > limit) {
			i--;
			new_blocks++;

if (i < 2800000) break;

			// sync missing block
			try {
				await syncBlock(i);
			} catch (err) {
				console.error(err);
			}
		}

		console.log("reset/synced",new_blocks,"blocks");
	});
}

async function syncBlock (targetBlockNum = null) {
	const t_start = now();

	let b, g, number;

	if (targetBlockNum) console.log("syncBlock("+targetBlockNum+")");

	// LAST BLOCK
	if (targetBlockNum === null) {
		let last_b = await data_blocks.last();

		//console.log("DIFFFF:", last_b.timestamp, last_b.timestamp - (moment.utc().unix()*1000 - config.cpc.block_each_second*1000));

// TODO: check if timespan is enough to have a new block created, if not, just stop here
		if (last_b && last_b.timestamp > moment.utc().unix()*1000 - config.cpc.block_each_second*1000)
			return Promise.resolve(false);

		b = await block();
		number = b.number;

		await generation().then(_ => g = _);

		// no new block
		if (last_b && last_b.number == number) return Promise.resolve(false);
	} else {
		// SPECIFIC BLOCK BACK IN TIME
		b = await block(targetBlockNum);
		number = b.number;
	}

	b.__generation = null;		// legacy only
	b.__aggregated = {
		by_minute: false,
		by_hour: false,
		by_day: false,
		//by_week: false,
		by_month: false,
		by_year: false
	};

	sanitizeBlock(b);
	attachBlockFeeReward(b);
	await attachBlockProperNImpeached(b);

	// split transactions into different db.collection
	b.transactions.forEach(trx => sanitizeTransaction(trx));
	const trxs = b.transactions;
	b.transactions = b.transactions.map(trx => trx.hash);

	// insert block
	await mongo_db_blocks.updateOne({ number: number }, { $set: b }, { upsert: true });			// insert block into mongo, if not yet done so
	console.log("added block ",number," in", now()-t_start);

	if (!trxs || !trxs.length) return Promise.resolve({b, trxs: []});

	// INSERT TRANSACTIONS
	try {
		for (let i in trxs) {
			// add transaction
			trxs[i].__ts = b.timestamp;	// block timestamp
			trxs[i].__from_to = [trxs[i].from, trxs[i].to];
			await mongo_db_transactions.updateOne({hash: trxs[i].hash}, {$set: trxs[i]}, { upsert: true });			// insert transaction into mongo, if not yet done so
			console.log("added transaction:", trxs[i].hash);
		}
	} catch (err) {
		console.error(err);
	}

	console.log("block ("+number+") + trx ("+trxs.length+") added in", now()-t_start);

	return Promise.resolve({b, trxs});	
}

async function updateBalancesOfBlockAddresses (block, trxs) {
	const t_start = now();

	// UPDATE:
	// miner
	// transaction sender
	// transaction receiver
	// TODO: emitter


	// MINER
	// always update proposer balance; proposer getting balance increased via smart contract, not via transaction
	try { await balances.update(block.miner); } catch (err) {}

	// TRANSACTION SENDER & RECEIVER
	if (trxs.length == 0) return Promise.resolve(null);

	let p = [];

	// update addresses of each transaction
	for (let i in trxs) {
		let trx = trxs[i];
		p.push(balances.update(trx.from));
		p.push(balances.update(trx.to));
	}

	return Promise.all(p);
}

function sanitizeBlock (block) {
	try {
		block.miner = web3.utils.toChecksumAddress(block.miner);
		if (block.__generation) {
			block.__generation.Proposer = web3.utils.toChecksumAddress(block.__generation.Proposer);
			block.__generation.Proposers = block.__generation.Proposers.map(_ => web3.utils.toChecksumAddress(_));
		}
		if (block.dpor) {
			block.dpor.proposers = block.dpor.proposers.map(_ => web3.utils.toChecksumAddress(_));
		}
	} catch (e) {

	}
}

function sanitizeRNodes (rnodes) {
	rnodes.forEach(rnode => rnode.Address = web3.utils.toChecksumAddress(rnode.Address));
}

function sanitizeGeneration (gen) {
	gen.Proposer = web3.utils.toChecksumAddress(gen.Proposer);
	for (let i in gen.Proposers) {
		gen.Proposers[i] = web3.utils.toChecksumAddress(gen.Proposers[i]);
	}
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
		try {
			sanitizeGeneration(_generation);
			return mongo_db_generation.updateOne({BlockNumber: _generation.BlockNumber}, {$set: _generation}, { upsert: true }).then(res => {
				if (res.upsertedCount) {
					return true;
					console.log("added generation");
				}

				return false;
			});
		} catch (e) {}
	});
}

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

			await mongo_db_blocks.createIndex({ timestamp: -1 }, { unique: true });
			await mongo_db_blocks.createIndex({ __proposer: 1 }, { unique: false });
			await mongo_db_blocks.createIndex({ number: -1 }, { unique: true });
			await mongo_db_blocks.createIndex({ '__aggregated.by_minute': 1 }, { unique: false });
			await mongo_db_blocks.createIndex({ '__aggregated.by_hour': 1 }, { unique: false });
			await mongo_db_blocks.createIndex({ '__aggregated.by_day': 1 }, { unique: false });
			await mongo_db_blocks.createIndex({ '__aggregated.by_month': 1 }, { unique: false });
			await mongo_db_blocks.createIndex({ '__aggregated.by_year': 1 }, { unique: false });

			await mongo_db_blocks.createIndex({ '__aggregated.by_minute': 1, number: 1 }, { unique: false });
			await mongo_db_blocks.createIndex({ '__aggregated.by_hour': 1, number: 1 }, { unique: false });
			await mongo_db_blocks.createIndex({ '__aggregated.by_day': 1, number: 1 }, { unique: false });
			await mongo_db_blocks.createIndex({ '__aggregated.by_month': 1, number: 1 }, { unique: false });
			await mongo_db_blocks.createIndex({ '__aggregated.by_year': 1, number: 1 }, { unique: false });
		})
	}

	if (mongo_db_generation) {
		mongo_db_generation.indexInformation(async (err, indexes) => {
			if (err) return;
			//if (!indexes.ts_1)
			//	await mongo_db_generation.createIndex({ ts: -1 }, { unique: true });
			if (!indexes['BlockNumber_1'])
				await mongo_db_generation.createIndex({ 'BlockNumber': -1 }, { unique: true });
		})
	}

	if (mongo_db_rnodes) {
		mongo_db_rnodes.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.ts_1)
				await mongo_db_rnodes.createIndex({ ts: -1 }, { unique: true });
		})
	}

	if (mongo_db_price_cmc) {
		mongo_db_price_cmc.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.ts_1)
				await mongo_db_price_cmc.createIndex({ ts: -1 }, { unique: true });
		})
	}

	if (mongo_db_balances) {
		mongo_db_balances.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.ts_1)
				await mongo_db_balances.createIndex({ ts: -1 }, { unique: false });
			if (!indexes.balance_1)
				await mongo_db_balances.createIndex({ balance: -1 }, { unique: false });
			if (!indexes.address_1)
				await mongo_db_balances.createIndex({ address: 1 }, { unique: true });
		})
	}

	if (mongo_db_transactions) {
		mongo_db_transactions.indexInformation(async (err, indexes) => {
			if (err) return;
/*			if (!indexes.blockHash_1)
				await mongo_db_transactions.createIndex({ blockHash: 1 }, { unique: false });*/
			if (!indexes.blockNumber_1)
				await mongo_db_transactions.createIndex({ blockNumber: -1 }, { unique: false });
			if (!indexes.hash_1)
				await mongo_db_transactions.createIndex({ hash: 1 }, { unique: true });
			if (!indexes.to_1_from_1)
				await mongo_db_transactions.createIndex({ to: 1, from: 1 }, { unique: false });
			if (!indexes.__from_to_1)
				await mongo_db_transactions.createIndex({ __from_to: 1 }, { unique: false });
			if (!indexes.__ts_1)
				await mongo_db_transactions.createIndex({ __ts: 1 }, { unique: false });
		})
	}
}

async function attachBlockProperNImpeached (b) {
	// is impeached block
	b.__impeached = b.miner == config.cpc.impeached_miner;

	if (!b.__impeached) {
		b.__proposer = b.miner;
	} else {
		b.__proposer = await blockProposer(b.number);			// ask civilian node
	}

	return Promise.resolve();
}

function attachBlockFeeReward (b) {
	let price = 0;

	if (b.transactions && b.transactions.length && b.transactions[0]) {
		// b.transactions.forEach(trx => fee += trxFee(trx));
		price = b.transactions[0].gasPrice / config.cpc.unit_convert;
	}

	b.__gasPrice = price;
	b.__fee = price * b.gasUsed;						// does not include fixed reward / block
	b.__fixed_reward = config.cpc.rewardsPerBlock;		
	b.__reward = b.__fixed_reward + b.__fee;			// gas_fees + fixed reward
}

function trxFee (trx) {
	return trx.gasPrice * trx.gas / config.cpc.unit_convert;
}

/**
 * This function can be called to recalculate fees
 */
async function backwardsBlock () {
	return new Promise((resolve, reject) => {
		mongo_db_blocks.find({}).project({_id:1, number:1, gasUsed:1, transactions: 1, miner: 1})/*.limit(150000)*/.toArray(async function (err, blocks) {
			for (let i in blocks) {
				await new Promise((resolve2, reject) => {
					mongo_db_transactions.findOne({hash: blocks[i].transactions[0]}).then(async function (trx, err) {
						// ATTACH FEE INFO
						blocks[i].transactions = [trx];
						attachBlockFeeReward(blocks[i]);
						delete blocks[i].transactions;
						delete blocks[i].gasUsed;

						// ATTACH PROPOSER N IMPEAHED INFO
						await attachBlockProperNImpeached(blocks[i]);

						mongo_db_blocks
							.updateOne({ _id: blocks[i]._id }, { $set: blocks[i] }, { upsert: false })
							.then(async (result, err) => {
								resolve2();
							});

						console.log("backwards block", blocks[i].number);
					});
				});

			};
			console.log("Recalculated block fee+reward for blocks:", blocks.length);


			resolve();
		});
	});
}


/**
 * this function can be called to set ts of trx from its block
 * only used once, after new feature of trx.ts in sync got implemented
 */
async function backwardsCalculateTrxTimeOfBlock () {
	return new Promise((resolve, reject) => {
		mongo_db_transactions.aggregate([
				{ $lookup: {
					from: 'blocks',
					localField: 'blockNumber',
					foreignField: 'number',
					as: 'block'
				} },
				{ $project: { _id:1, hash:1, 'ts':'$block.timestamp' } }
			]).toArray(async function (err, trxs) {

				for (let i in trxs) {
					await mongo_db_transactions.updateOne({_id: trxs[i]._id}, {$set: { __ts: trxs[i].ts[0] }}, { upsert: true });
				};

				console.log("Set timestamp for each trx from its block:", trxs.length);
				resolve();
			});
	});
}

async function syncBalances () {
	// legacy: remove history
	//mongo_db_balances.updateMany({}, {$unset: { history: "" }});

	// update all balances
	return new Promise((resolve, reject) => {
		mongo_db_balances.find().toArray(async function (err, bs) {
			for (let i in bs) {
				await balances.update(bs[i].address);
			};
			resolve();
		});
	});
}


async function syncRNodesFirstNLastBlockDates () {
	return _data.rnodes.updateAll_firstNLastBlockDate();
}






/**
 * Backwards find unknown addresses in trx's and blocks
 */
async function backwardsFindNewAddresses () {

	let known = await addresses.all();

	return new Promise((resolve, reject) => {
		mongo_db_transactions.aggregate([
			{ $match: { from: { $nin: known } } },
			{ $project: { from: 1} },
			{ $group: { _id: '$from' }}
		]).toArray(async (err, result) => {
			if (result) {
				for (let i in result) {
					try {
						if (!result[i]._id)
							continue;
						await balances.update(result[i]._id)
						known.push(result[i]._id);
					} catch (err) { console.error(err); }
				}
				console.log('backwardsFindNewAddresses() found new address:',result.map(_ => _._id));
			}
			resolve();
		});
	}).then(() => {
		return new Promise((resolve, reject) => {
			mongo_db_transactions.aggregate([
				{ $match: { to: { $nin: known } } },
				{ $project: { to: 1} },
				{ $group: { _id: '$to' }}
			]).toArray(async (err, result) => {
				if (result) {
					for (let i in result) {
						try {
							await balances.update(result[i]._id)
							known.push(result[i]._id);
						} catch (err) { console.error(err); }
					}
					console.log('backwardsFindNewAddresses() found new address:',result.map(_ => _._id));
				}
				resolve();
			});
		});
	}).then(() => {
		return new Promise((resolve, reject) => {
			mongo_db_blocks.aggregate([
				{ $match: { miner: { $nin: known } } },
				{ $project: { miner: 1} },
				{ $group: { _id: '$miner' }}
			]).toArray(async (err, result) => {
				if (result) {
					for (let i in result) {
						try {
							await balances.update(result[i]._id)
							known.push(result[i]._id);
						} catch (err) { console.error(err); }
					}
					console.log('backwardsFindNewAddresses() found new address:',result.map(_ => _._id));
				}
				resolve();
			});
		});
	}).then(() => {
		return new Promise((resolve, reject) => {
			mongo_db_rnodes.aggregate([
				{ $project: { addresses: "$rnodes.Address" } },
				{ $unwind: '$addresses' },
				{ $group: { _id: '$addresses' } },
				{ $match: { _id: { $nin: known } }}
			]).toArray(async (err, result) => {
				if (result) {
					for (let i in result) {
						try {
							await balances.update(result[i]._id)
							known.push(result[i]._id);
						} catch (err) { console.error(err); }
					}
					console.log('backwardsFindNewAddresses() found new address:',result.map(_ => _._id));
				}
				resolve();
			});
		});
	});

	// invalid address: 0x45621603C070b051C0FC337294cAa7b4a21a8b79
}


/*async function sendTrx () {
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




async function init (clearAll = false) {
	return new Promise((resolve, reject) => {
		mongo.on('connect', async function(err, client) {
			if (err) reject(err);

			mongo_db = client.db(config.mongo.db.sync);
			mongo_db_blocks = mongo_db.collection('blocks');
			mongo_db_transactions = mongo_db.collection('transactions');
			mongo_db_rnodes = mongo_db.collection('rnodes');
			mongo_db_balances = mongo_db.collection('balances');
			mongo_db_price_cmc = mongo_db.collection('price_cmc');
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


init(false)
	.then(resetAndSyncAllBlocks)	
	.then(backwardsFindNewAddresses)
	.then(syncCPCPrice)
	.then(backwardsBlock)
	.then(syncRNodesFirstNLastBlockDates)
	.then(syncBalances)
	.then(collect);
