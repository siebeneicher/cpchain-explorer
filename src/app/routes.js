const app = module.exports = require('express')();
const {rnode, dashboard, aggregate} = require('./middleware');
const {promisify} = require('util');
const fs = require('fs');
const redis = require('./redis');
const config = require('./config');
const cache = require('express-redis-cache')({ client: redis.client, prefix: config.redis.prefix });


/*	cache.get(function (error, entries) {
		if ( error ) throw error;
		entries.forEach(console.log.bind(console));
	});*/
/*	let d = await redis.get(config.redis.prefix+':dashboard');
	console.log(d);*/

app.get('/rnode', async function (req, res) {
	let data = await rnode(req.query.rnode);
	res.json(data);
}).get('/dashboard', /*cache.route('dashboard'), */async function (req, res) {
	res.json(await dashboard());
});


// DEBUG ONLY
app.get('/aggregate', async function (req, res) {
	res.json(await aggregate());
});



// last one, as its wildcard
app.get('/*', async function (req, res) {
	res.set({'Content-Type': 'text/html'});
	let f = await promisify(fs.readFile)("index.html");
	res.send(f);
})