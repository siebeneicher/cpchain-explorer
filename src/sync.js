const {blockNumber, versions, rnodes, block, generation, transaction, web3, balance} = require('./cpc-fusion/api');
const mongo = require('./app/mongo');
const { balances, addresses } = require('./app/data');
const config = require('./app/config');
const now = require('performance-now');
const moment = require('moment');
const request = require('request-promise-native');
const {convert_ts, last_unit_ts} = require('./app/helper');
const {messaging} = require('./app');

// shortcut to collections
let mongo_db, mongo_db_blocks, mongo_db_transactions, mongo_db_rnodes, mongo_db_balances, mongo_db_price_cmc;

let cur_rnodes = [];				// most recent rnodes synced
let cur_generation = {};			// most recent block generation info synced
let last_blockNumber = 0;			// most recent block number
let last_blockNumber_synced = 0;	// most recent synced

const sync_delay = 500;
const cpc_price_delay = 1000 * 60 * 10;		// basic plan: 333 reqs / day
const backwards_delay = 25200;
const balance_delay = 5000;
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
	_syncMissingBalances();
	_syncCPCPrice();

	syncCPCPrice();

	function _snapshot () {
		setTimeout(async () => {
			try {
				let newBlock = await syncBlock();
				if (newBlock) {
					// inform aggregation to process
					messaging.emit('SYNC-SNAPSHOT-PERFORMED', {});

					// rnodes and balance update can be performed after aggregation, in parallel
					await Promise.all([
						syncRNodes(),
						updateBalancesByBlock(newBlock.b, newBlock.trxs)
					]);
					messaging.emit('SYNC-RNODES-BALANCES-PERFORMED', {});
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

	function _syncMissingBalances () {
		setTimeout(async () => {
			try {
				if (await syncMissingBalances()) {
					messaging.emit('SYNC-BALANCES-PERFORMED', {});
				}
			} catch (err) {
				console.error(err);
			}

			_syncMissingBalances();	// loop
		}, balance_delay);
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
		res.data[config.coinmarketcap.cpc_id].ts = moment.utc().unix();
		return mongo_db_price_cmc.insertOne(res.data[config.coinmarketcap.cpc_id]);
	}).catch((err) => {
		console.log('Coinmarketcap API call error:', err.message);
	});
}


async function syncMissingBalances () {
	return new Promise ((resolve, reject) => {
		const t_start = now();

		// fetch known addresses
		mongo_db_balances.find({}, { address:1 }).toArray(async (err, addresses) => {

			let ignore_addresses = addresses.map(_ => _.address);

			// fetch new addresses
			mongo.db(config.mongo.db.sync).collection('transactions')
				.aggregate([
					{ $project: { "addresses": {
						$split: [{$concat: ["$from","---","$to"]}, '---']
					} } },
					{ $unwind: '$addresses' },
					{ $match: { addresses: { $nin: ignore_addresses } } },
					{ $group: { _id: '$addresses' } }
				])
				.toArray(async (err, addresses) => {
					console.log("syncMissingBalances() get new addresses, took:", now() - t_start);
					//console.log(addresses);
					if (!err && addresses && addresses.length) {
						for (let i in addresses) {
							let address = addresses[i]._id;
							let latest_balance = await balance(address);
							await mongo_db_balances.insertOne({ address, latest_balance });
							console.log("new address added:",address,"balance:",latest_balance);
						}
					}

					resolve();
				});

		});
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

	attachBlockFeeReward(b);

	sanitizeBlock(b);

	// split transactions into different db.collection
	b.transactions.forEach(trx => sanitizeTransaction(trx));
	const trxs = b.transactions;
	b.transactions = b.transactions.map(trx => trx.hash);

	await mongo_db_blocks.updateOne({ number: number }, { $set: b }, { upsert: true });			// insert block into mongo, if not yet done so
	console.log("added block (generation: "+!!b.__generation+"):", number, "took:", now()-t_start);

	if (!trxs || !trxs.length) return Promise.resolve({b, trxs: []});

	try {
		for (let i in trxs) {
			// add transaction
			trxs[i].__ts = b.timestamp;	// block timestamp
			await mongo_db_transactions.updateOne({hash: trxs[i].hash}, {$set: trxs[i]}, { upsert: true });			// insert transaction into mongo, if not yet done so
			console.log("added transaction:", trxs[i].hash);
		}
	} catch (err) {
		console.error(err);
	}

	return Promise.resolve({b, trxs});	
}

async function updateBalancesByBlock (block, trxs) {
	// calculate balance changes in bulk, without actually requesting balance from the node (to save request time)
	const changeByAddr = {};

	// always update proposer balance; proposer getting balance increased via smart contract, not via transaction
	try { await balances.update(block.miner); } catch (err) {}

// TODO: update emitter balance as well

	if (trxs.length == 0) return Promise.resolve(null);

	// update addresses balance via found transactions
	for (let i in trxs) {
		let trx = trxs[i];

		// 0 value is not relevant
		if (trx.value == 0) continue;

		if (changeByAddr[trx.from] === undefined) changeByAddr[trx.from] = 0;
		if (changeByAddr[trx.to] === undefined) changeByAddr[trx.to] = 0;

		changeByAddr[trx.from] = -trx.value;
		changeByAddr[trx.to] = trx.value;
	}


	// execute in bulk

	// get first all adresses balances
	const addresses = Object.keys(changeByAddr);

	return new Promise((resolve, reject) => {
		mongo_db_balances.find({ address: { $in: addresses } }, { address:1, latest_balance:1 }).toArray(async (err, items) => {
			for (let i in addresses) {
				let addr = addresses[i];
				let latest_balance = null;
				let found = items.filter(_ => _.address == addr);

				if (found.length) {		// update balance
					latest_balance = found[0].latest_balance + changeByAddr[addr];
				} else {				// new address: get latest balance from node
					latest_balance = await balance(addr);		// expensive node call
				}

				const _balance = {
					latest_balance,
					address: addr
				};

// TODO: faster bulk update
				// update/insert
				await mongo_db_balances.updateOne({ address: addr }, { $set: _balance }, { upsert: true });
				console.log("balance updated,",addr,"to",latest_balance);
			}

			resolve();
		});
	});
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

/*async function syncGeneration () {
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
}*/

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
	//await mongo_db_generation.drop();
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

/*	if (mongo_db_generation) {
		mongo_db_generation.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.ts_1)
				await mongo_db_generation.createIndex({ ts: -1 }, { unique: true });
			if (!indexes['generation.BlockNumber_1'])
				await mongo_db_generation.createIndex({ 'generation.BlockNumber': -1 }, { unique: false });
		})
	}*/

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
		})
	}
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
async function backwardsCalculateTrxAndattachBlockFeeReward () {
	return new Promise((resolve, reject) => {
		mongo_db_blocks.find({}).project({_id:1, number:1, gasUsed:1, transactions: 1}).toArray(async function (err, blocks) {
			for (let i in blocks) {
				await new Promise((resolve2, reject) => {
					mongo_db_transactions.findOne({hash: blocks[i].transactions[0]}).then(async function (trx, err) {
						blocks[i].transactions = [trx];
						attachBlockFeeReward(blocks[i]);
						delete blocks[i].transactions;
						delete blocks[i].gasUsed;

						mongo_db_blocks
							.updateOne({ _id: blocks[i]._id }, { $set: blocks[i] }, { upsert: false })
							.then(async (result, err) => {
								resolve2();
							});
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
				debugger;
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
			//mongo_db_generation = mongo_db.collection('generation');

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

init(false)./*then(backwardsFindNewAddresses).*/then(collect);
