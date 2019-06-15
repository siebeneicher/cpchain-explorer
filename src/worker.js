const Mongodb = require('mongodb');
const mongo_url = 'mongodb://localhost:27017';
const mongo_cpc_dbname = "cpc_watcher";
let mongo, mongo_db, mongo_db_blocks, mongo_db_transactions, mongo_db_rnodes, mongo_db_generation;
const mongo_db_aggregation_by = {};

const socket_io = require('socket.io');
const now = require('performance-now');
const moment = require('moment');

const {promisify} = require('util');
const fs = require('fs');
const http = require('http');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const port = 8080;


app.use('/app', express.static(__dirname + '/app'));
app.use('/libs', express.static(__dirname + '/libs'));
app.use('/resources', express.static(__dirname + '/resources'));

// avoid cache && cors
app.use(function (req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/rnode', async function (req, res) {
	let data = await rnode(req.query.rnode);
	res.json(data);
});


// last one, as its wildcard
app.get('/*', async function (req, res) {
	res.set({'Content-Type': 'text/html'});
	let f = await promisify(fs.readFile)("index.html");
	res.send(f);
})




async function rnode (addr) {
	const data = {rnode: addr, impeached: []};

	return new Promise(function (resolve, reject) {
		// impeached blocks by addr
		const impeachedOptions = {'generation.Proposers': addr, 'generation.Proposer': '0x0000000000000000000000000000000000000000'};
		mongo_db_generation.find(impeachedOptions).toArray((err, gens) => {

			for (let key in gens) {
				let gen = gens[key];

				if (gen.generation.Proposers[gen.generation.View] == addr) {
					data.impeached.push(gen);
				}
			}

			resolve(data);
		});
	});
}

async function aggregate (from, to) {
	return new Promise(function (resolve, reject) {
		const find = {
			timestamp: {$gte: from, $lte: to}
		};
		mongo_db_blocks.find(find).toArray((err, blocks) => {

			console.log("blocks for aggregation found: ", blocks.length);

			const blocks_len = blocks.length;

			// aggregate by unit
			const aggregate = {};
			const aggregate_tpl = {blocks_mined_by_node: {}};
			const units = ['minute','hour','day','month','year'];
			const units_reduce_moment_fn = ['seconds','minutes','hours','days','month'];
			units.forEach(unit => aggregate[unit] = {});

			let block, t;
			for (let key in blocks) {
				block = blocks[key];
				t = moment(block.timestamp);

				units.forEach((unit,i) => {
					t[units_reduce_moment_fn[i]](0);
					let ts = t.unix();

					// init
					if (aggregate[unit][ts] === undefined) aggregate[unit][ts] = clone(aggregate_tpl);

					if (aggregate[unit][ts].blocks_mined_by_node[block.miner] === undefined) aggregate[unit][ts].blocks_mined_by_node[block.miner] = 0;
					aggregate[unit][ts].blocks_mined_by_node[block.miner]++;

				});

			}

			
			units.forEach(unit => {
				// remove previous aggregation for timespan
				mongo_db_aggregation_by[unit].deleteMany({ts: {$gte: from, $lte: to}});

				// add aggregation to database
				mongo_db_aggregation_by[unit].insertMany(Object.entries(aggregate[unit]).map(_ => Object.assign({ts: _[0]}, _[1])));
			});

debugger;
			resolve();
		});
	});
}

async function init () {
	return new Promise((resolve, reject) => {
		Mongodb.connect(mongo_url, async function(err, client) {
			if (err) reject(err);

			console.log("Connected to mongodb");

			// shortcuts to mongo
			mongo = client;
			mongo_db = client.db(mongo_cpc_dbname);
			mongo_db_blocks = mongo_db.collection('blocks');
			mongo_db_transactions = mongo_db.collection('transactions');
			mongo_db_rnodes = mongo_db.collection('rnodes');
			mongo_db_generation = mongo_db.collection('generation');

			mongo_db_aggregation_by.minute = mongo_db.collection('aggregation_by_minute');
			mongo_db_aggregation_by.hour = mongo_db.collection('aggregation_by_hour');
			mongo_db_aggregation_by.day = mongo_db.collection('aggregation_by_day');
			mongo_db_aggregation_by.month = mongo_db.collection('aggregation_by_month');
			mongo_db_aggregation_by.year = mongo_db.collection('aggregation_by_year');

			// start server
			http.createServer(app).listen(port, () => console.log('App listening on port:', port));

			resolve();
		});
	});
}

function clone (obj) {
	return JSON.parse(JSON.stringify(obj));
}

init().then(() => {
	// debug
	aggregate(1551398400 * 1000, 1561939200 * 1000);
});