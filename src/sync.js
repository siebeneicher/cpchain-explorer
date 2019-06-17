const util = require('util');
const fs = require('fs');
const Web3 = require('web3');
const ethtx = require('ethereumjs-tx');

const Mongodb = require('mongodb');
const mongo_url = 'mongodb://localhost:27017';
const mongo_cpc_dbname = "cpc_watcher";
let mongo, mongo_db, mongo_db_blocks, mongo_db_transactions, mongo_db_rnodes, mongo_db_generation;


// TODO: remove memory leak / consumptions


// lookup index
const blocks_num = [];
const trx_hashes = [];
const addresses = [];
let rnodes = [];			// most recent rnodes
let generation = {};		// most recent block generation info

// connect to cpchain node
const web3 = new Web3('http://127.0.0.1:8501', null, {});
const start_sync_previous = false;
const start_sync_block_number = 500000;
const sync_interval = 2000;

const { spawn } = require('child_process');


const python_executable = 'C:\\Users\\siebeneicher\\AppData\\Local\\Programs\\Python\\Python37\\python.exe';
// const python_executable = "python3.6";		// unix


// linux> mongodump --db cpc_watcher
// windows> "C:\Program Files\MongoDB\Server\4.0\bin\mongorestore.exe" --db cpc_watcher --dir "D:\Bitbucket\cpc_watcher\dumpos\cpc_watcher"



async function collect () {
	setInterval(syncLatestBlock, sync_interval);
	setInterval(syncRNodes, sync_interval);

	//setInterval(sendTestTrx, 10000);
}
async function syncLatestBlock () {
	const number = await web3.eth.getBlockNumber();
	await syncBlock(number);
}

async function syncBlock (number) {
	const b = await web3.eth.getBlock(number, false);
	if (hasBlock(number))
		return Promise.resolve();									// allready synced, we expect transactions to be synced as well

	blocks_num.push(number);
	await mongo_db_blocks.update({number: number}, b, { upsert: true });			// insert block into mongo, if not yet done so
	console.log("adding block:", number/*, b*/);

	// sync transactions
	for (let i in b.transactions) {
		await syncTransaction(b.transactions[i]);
	}

	return Promise.resolve();
}

async function syncTransaction (transaction_hash, force = false) {
	if (!force && hasTransaction(transaction_hash))
		return Promise.resolve();

	trx_hashes.push(transaction_hash);
	const trx = await web3.eth.getTransaction(transaction_hash);
	await mongo_db_transactions.update({hash: transaction_hash}, trx, { upsert: true });			// insert transaction into mongo, if not yet done so
	console.log("adding transaction:", transaction_hash/*, b*/);

	return Promise.resolve();
}

function hasBlock(num) {
	return blocks_num.includes(num);
}
function hasTransaction(hash) {
	return trx_hashes.includes(hash);
}
function hasAddress(addr) {
	return addresses.includes(addr);
}

async function syncRNodes () {
	const ps = await spawn( python_executable, [ 'rnodes.py', '.' ] );
	const ts = Math.floor(new Date() / 1000);

	ps.stdout.on('data', async function (data) {
		const json = JSON.parse(data);
		const _rnodes = json.rnodes;
		const _generation = json.generation;

		// rnodes list, store only on change
		if (JSON.stringify(rnodes) != JSON.stringify(_rnodes)) {
			rnodes = _rnodes;
			await mongo_db_rnodes.insert({ts, rnodes});
			console.log("adding rnodes");
		}

		// rnodes block generation info, store only on change
		if (JSON.stringify(generation) != JSON.stringify(_generation)) {
			generation = _generation;
			await mongo_db_generation.insert({ts, generation});
			console.log("adding generation ("+generation.BlockNumber+")");
		}
	});
	ps.stderr.on('data', data => { console.error( `stderr: ${data}` ); });

	return new Promise ((resolve, reject) => {
		ps.on('close', code => {
			resolve();
		});
	});
}

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
}

async function init (clearAll = false) {
	return new Promise((resolve, reject) => {
		Mongodb.connect(mongo_url, async function(err, client) {
			if (err) reject(err);
			console.log("Connected to mongodb");
			mongo = client;
			mongo_db = client.db(mongo_cpc_dbname);
			mongo_db_blocks = mongo_db.collection('blocks');
			mongo_db_transactions = mongo_db.collection('transactions');
			mongo_db_rnodes = mongo_db.collection('rnodes');
			mongo_db_generation = mongo_db.collection('generation');

			// clear all data
			if (clearAll) {
				clearAll();
			}

			// sync cached blocks
			mongo_db_blocks.find().toArray(async function (err, items) {
				console.log("found blocks in mongo:", items.length);
				items.forEach(b => blocks_num.push(b.number));

				if (!start_sync_previous) {
					return resolve();
				}

				// sync missed blocks, since last stop/start
				const latest = await web3.eth.getBlockNumber();
				for (let num = latest; num > start_sync_block_number; num--) {
					if (hasBlock(num)) continue;
					await syncBlock(num);
				}

				// test transaction
				//sendTestTrx();

				resolve();
			});
		});
	});
}

init(false).then(collect);
