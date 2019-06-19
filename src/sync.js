const {blockNumber, versions, rnodes, block, generation, transaction} = require('./cpc-fusion/api');
const mongo = require('./app/mongo');
const config = require('./app/config');
const {aggregate} = require('./app/middleware');
const now = require('performance-now');

// shortcut to collections
let mongo_db, mongo_db_blocks, mongo_db_transactions, mongo_db_rnodes, mongo_db_generation;


// TODO: remove memory leak / consumptions

// lookup index
/*const blocks_num = [];
const trx_hashes = [];
const addresses = [];*/

let cur_rnodes = [];			// most recent rnodes synced
let cur_generation = {};		// most recent block generation info synced
let last_blockNumber = 0;		// most recent block synced


const start_sync_previous = false;
const start_sync_block_number = 500000;
const sync_delay = 1000;
const backwards_delay = 10000;


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
	//_syncBackwards();

	function _snapshot () {
		setTimeout(async () => {
			if (await snapshot())
				;//await aggregate();		// aggregate whenever we have a new snapshot
			_snapshot();
		}, sync_delay);
	}

	function _syncBackwards () {
		setTimeout(async () => {
			await syncBackwards();
			_syncBackwards();
		}, backwards_delay);
	}
}
async function syncBackwards () {
	let last_blockNumber = await blockNumber();

	// TODO: make this function big data proof

	// sync all blocks
	return new Promise ((resolve, reject) => {
		mongo_db_blocks.find({__complete_transactions: true}).project({_id:-1, number: 1}).toArray(async function (err, items) {
			let numbers = items.map(b => b.number);

			console.log("Sync backwards: ",items.length,"(total synced) vs",last_blockNumber,"(last block number)");

			let i = 1;
			while (i < last_blockNumber) {
				i++;
				if (numbers.includes(i)) continue;

				// sync missing block
				try {
					await syncBlock(i);
				} catch (err) {
					console.error(err);
				}
			}

			resolve();
		});
	});
}
async function snapshot () {
	let has_new = await syncBlock();

	if (!has_new)
		return Promise.resolve(false);

	return syncRNodes();  //Promise.all([syncRNodes(), syncGeneration()]);
}
async function syncBlock (number = null) {
	const t_start = now();
	const cur_blockNum = await blockNumber();

	// default: last block
	if (number === null)
		number = cur_blockNum;

	//console.log(number, "last_blockNumber:",last_blockNumber);

	if (last_blockNumber == number)
		return Promise.resolve(false);		// no new block

	last_blockNumber = number;

	const b = await block(number);
	b.__complete_transactions = b.transactions.length ? false : true;		// from false to true, when transactionsVolume got calculated
	b.__generation = (number == cur_blockNum) ? await generation(number) : null;
	b.__aggregated = {
		by_minute: false,
		by_hour: false,
		by_day: false,
		by_month: false,
		by_year: false
	};
	await mongo_db_blocks.updateOne({ number: number }, { $set: b }, { upsert: true });			// insert block into mongo, if not yet done so
	console.log("added block:", number, "took:", now()-t_start);

	// sync transactions, async background
	return Promise.all(b.transactions.map(txn => syncTransaction(txn)))
		.then(async () => {
			// flag block complete
			b.__complete_transactions = true;
			return mongo_db_blocks.updateOne({ number: number }, { $set: b });
		}).catch();
}

async function syncTransaction (txn) {
	try {
		const t_start = now();
		const trx = await transaction(txn);
		await mongo_db_transactions.update({hash: txn}, trx, { upsert: true });			// insert transaction into mongo, if not yet done so
		console.log("added transaction:", txn, "took:", now()-t_start);
	} catch (err) {
		console.error(err);
		return Promise.reject();
	}

	return Promise.resolve();
}

async function syncRNodes () {
	const t_start = now();
	const ts = Math.floor(new Date() / 1000);

	return rnodes().then(async (_rnodes) => {
		//console.log(_rnodes);

		// store only new versions
		if (JSON.stringify(_rnodes) != JSON.stringify(cur_rnodes)) {
			cur_rnodes = _rnodes;
			await mongo_db_rnodes.insertOne({ts, _rnodes});
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

/*function hasBlock(num) {
	return blocks_num.includes(num);
}*/
/*function hasTransaction(hash) {
	return trx_hashes.includes(hash);
}*/
/*function hasAddress(addr) {
	return addresses.includes(addr);
}*/

async function sendTestTrx () {
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
			if (!indexes.timestamp_1)
				await mongo_db_blocks.createIndex({ timestamp: 1 }, { unique: true });
			if (!indexes.number_1)
				await mongo_db_blocks.createIndex({ number: 1 }, { unique: true });
			if (!indexes.__complete_transactions)
				await mongo_db_blocks.createIndex({ __complete_transactions: 1 }, { unique: false });
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
				await mongo_db_generation.createIndex({ ts: 1 }, { unique: true });
			if (!indexes['generation.BlockNumber_1'])
				await mongo_db_generation.createIndex({ 'generation.BlockNumber': 1 }, { unique: false });
		})
	}

	if (mongo_db_rnodes) {
		mongo_db_rnodes.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.ts_1)
				await mongo_db_rnodes.createIndex({ ts: 1 }, { unique: true });
		})
	}

	if (mongo_db_transactions) {
		mongo_db_transactions.indexInformation(async (err, indexes) => {
			if (err) return;
			if (!indexes.blockHash_1)
				await mongo_db_transactions.createIndex({ blockHash: 1 }, { unique: false });
			if (!indexes.blockNumber_1)
				await mongo_db_transactions.createIndex({ blockNumber: 1 }, { unique: false });
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
