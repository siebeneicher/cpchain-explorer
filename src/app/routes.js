const express = require('express');
const app = module.exports = express();
const {rnodes, dashboard, aggregate, updateAll, blocks, transactions} = require('./middleware');
const {promisify} = require('util');
const fs = require('fs');
const path = require('path');
const redis = require('./redis');
const config = require('./config');
const cache = require('express-redis-cache')({ client: redis.client, prefix: config.redis.prefix });


/*	cache.get(function (error, entries) {
		if ( error ) throw error;
		entries.forEach(console.log.bind(console));
	});*/
/*	let d = await redis.get(config.redis.prefix+':dashboard');
	console.log(d);*/

app.get('/api/v1/rnode/user/:addr', async function (req, res) {
	res.json(await rnodes.user.get(req.params.addr));
}).get('/api/v1/dashboard', /*cache.route('dashboard'), */async function (req, res) {
	res.json(await dashboard.get());
}).get('/api/v1/blocks-squared', async function (req, res) {
	res.json(await blocks.squared.get(req.query.unit, parseInt(req.query.ts)));
}).get('/api/v1/rnodes-streamgraph', async function (req, res) {
	res.json(await rnodes.streamgraph.get(req.query.unit, parseInt(req.query.times)));
}).get('/api/v1/block/:number', async function (req, res) {
	res.json(await blocks.get(req.params.number));
}).get('/api/v1/trx/:hash', async function (req, res) {
	res.json(await transactions.get(req.params.hash));
});


// TODO: remove in production
// DEBUG ONLY
app.get('/aggregate', async function (req, res) {
	res.json(await aggregate.run());
}).get('/aggregate.test', async function (req, res) {
	res.json(await aggregate.test());
}).get('/aggregate.reset', async function (req, res) {
	res.json(await aggregate.reset());
}).get('/updateAll', async function (req, res) {
	res.json(await updateAll());
});

// UI (ORDER AFTER API ROUTES)
app.use('/', express.static(__dirname + '/../ui-build'));

app.get(/\/(blocks|block|transaction|transactions|trx|txs|tx|address|rnode)/, async function (req, res) {
	res.sendFile(path.join(__dirname + '/../ui-build/index.html'));
})

// last one, as its wildcard
app.get('/*', async function (req, res) {
	res.status(404).json({error: 404});
})