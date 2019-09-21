const express = require('express');
const app = module.exports = express();
const {rnodes, dashboard, aggregate, updateAll, blocks, transactions, addresses, search, price} = require('./middleware');
const {promisify} = require('util');
const fs = require('fs');
const path = require('path');
const redis = require('./redis');
const config = require('./config');
const cache = require('express-redis-cache')({ client: redis.client, prefix: config.redis.prefix_express });
const now = require('performance-now');
const helmet = require('helmet')




app.use(helmet());


app.use((req, res, next)=> {
	res.setHeader('X-Used-Frontend-Cache', 'yes');
	console.log("REQ: ", req.url);

	// manually avoid frontend cache
	if (req.query.forceUpdate == "1")
		res.use_express_redis_cache = false;

	next();
})



app.get('/api/v1/rnode/user/:addr', cache.route(), async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await rnodes.user.get(req.params.addr, !!parseInt(req.query.forceUpdate)));
})

.get('/api/v1/dashboard', cache.route(), async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await dashboard.get());
})

.get('/api/v1/blocks-squared/:unit/:ts', cache.route(), async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await blocks.squared.get(req.params.unit, parseInt(req.params.ts)));
})

.get('/api/v1/rnodes-streamgraph', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await rnodes.streamgraph.get(req.query.unit, parseInt(req.query.times)));
})

.get('/api/v1/transactions-graph', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await transactions.graph.get(req.query.unit, parseInt(req.query.times), 'latest', { exclude_last: !!parseInt(req.query.exclude_last) }, !!parseInt(req.query.forceUpdate)));
})

.get('/api/v1/price-graph', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await price.graph.get(req.query.unit, parseInt(req.query.times), 'latest', { exclude_last: !!parseInt(req.query.exclude_last) }, !!parseInt(req.query.forceUpdate)));
})

.get('/api/v1/block/transactions/:number', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await transactions.ofBlock(req.params.number));
})

.get('/api/v1/block/last', cache.route(), async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await blocks.last());
})

.get('/api/v1/block/:number', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await blocks.get(req.params.number));
})

.get('/api/v1/trx/:hash', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await transactions.get(req.params.hash));
})

.get('/api/v1/address/transactions/:addr', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await transactions.ofAddress(req.params.addr, req.query.offset, req.query.limit, req.query.sort, req.query.sortOrder));
})

.get('/api/v1/rnodes/blocks/:addr', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await rnodes.blocks(req.params.addr, req.query.offset, req.query.limit, req.query.sort, req.query.sortOrder));
})

.get('/api/v1/rnodes/blocks-count/:addr', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await rnodes.blocks_count(req.params.addr));
})

.get('/api/v1/rnodes/timeline/:unit/:times/:ts_start/:addr', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await rnodes.timeline.get(req.params.unit, parseInt(req.params.times), req.params.ts_start, req.params.addr, {fieldOnly: req.query.fieldOnly}, !!parseInt(req.query.forceUpdate)));
})

.get('/api/v1/address/:addr', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await addresses.get(req.params.addr));
})

.get('/api/v1/addresses', cache.route(), async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await addresses.all(!!parseInt(req.query.ignoreSmallBalances), !!parseInt(req.query.calculateUSD)));
})

.get('/api/v1/rnodes/:unit/:times', /*cache.route(),*/ async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
/*	const ts = await rnodes.all.cache_timestamp(req.params.unit, parseInt(req.params.times), 'latest', {});
	res.setHeader('X-Middleware-Cache-Timestamp', ts);*/
	res.json(await rnodes.all.get(req.params.unit, parseInt(req.params.times), 'latest', {}, true /*!!parseInt(req.query.forceUpdate)*/));
})

.get('/api/v1/rnodes/roi/:unit/:times', cache.route(), async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await rnodes.roi.get(req.params.unit, parseInt(req.params.times), 'latest', {}, !!parseInt(req.query.forceUpdate)));
})

.get('/api/v1/search/:term', async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');
	res.json(await search.typeOf(req.params.term));
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




// TODO: duplicate in nginx for production

app.get(/^\/((en|cn)\/)*(blocks|block|transaction|transactions|trx|txs|tx|address|rnode|rich-list|system-status|stats|roi|rnodes|$)/, async function (req, res) {
	res.setHeader('X-Used-Frontend-Cache', 'no');

	let langs = ['en','cn'];
	let lang = "en";
	let lang_m = req.url.match(/\/(en|cn)(\/|$)/);

	if (lang_m && langs.includes(lang_m[1]))
		lang = lang_m[1];

	console.log(req.url, lang);

	if (await maintenance() && !parseInt(req.query.debug))
		res.sendFile(path.join(__dirname + '/maintenance.html'));
	else
		res.sendFile(path.join(__dirname + '/../ui-build/'+lang+'/index.html'));
})

// UI (ORDER AFTER API ROUTES)
app.use('/', express.static(__dirname + '/../ui-build'));


// last one, as its wildcard
app.get('/*', async function (req, res) {
	console.error("404:", req.url);
	res.status(404).json({error: 404});
})



async function maintenance () {
	try {
		
		await promisify(fs.access)(__dirname + '/../MAINTENANCE');
		return Promise.resolve(true);
	} catch (e) {
		return Promise.resolve(false);
	}
}

// cache middleware to decide using cache or not
function decideNoCache (req, res, next) {
	// Use only cache if user not signed in
	res.use_express_redis_cache = !req.headers['cpc-explorer-force-no-cache'];
	next();
}