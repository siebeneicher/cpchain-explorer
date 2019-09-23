const express = require('express');
const app = express();
const bodyParser = require('body-parser');
//const socket_io = require('socket.io');
const now = require('performance-now');
const http = require('http');
const config = require('./app/config');
const {aggregate, updateAll} = require('./app/middleware');
const compression = require('compression')
const responseTime = require('response-time')
const redis = require('./app/redis');
const fs = require('fs');
const session = require('express-session');
const redisStore = require('connect-redis')(session);

// https://github.com/expressjs/express/pull/3730
/*const http2 = require('http2');
const options = {
 key: fs.readFileSync('./cert/localhost.key'),
 cert: fs.readFileSync('./cert/localhost.cer')
};*/

const expressRedisStore = new redisStore({
	port: 6379,
	host: "localhost",
	client: redis.client,
	ttl: 260
});

app.use(session({
  secret: 'huhu rnodes.io secret',
  //cookie: { maxAge: 16*60*60*1000, secure: true },
  resave: false,
  saveUninitialized: true,
  store: expressRedisStore
}))

app.use(compression({}));
app.use(responseTime());

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

// session views and last request timestamp
app.use(function (req, res, next) {
	if (!req.session.views)	req.session.views = {}
	req.session.views[req.url] = (req.session.views[req.url] || 0) + 1
	req.session.last_req_ts = new Date().getTime();
	next()
})

app.get('/active-sessions/count', (req, res, next) => {
	const active_ts_backwards = 1000 * 30;		// last req within timestamp is counted

	console.log(req.session);

	expressRedisStore.all((err,_) => {
		//console.log(err,_);
		if (!_ || err) return res.json({err, cnt: 0});
		const cnt = _.filter(s => s.id && s.last_req_ts + active_ts_backwards > new Date().getTime()).length;
		res.json({cnt});
	});
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
//app.use(cors());									// enable cors
app.set('trust proxy', 'loopback');					// trust proxy in production from local nginx front server
app.use(require('./app/routes'));					// app routes


async function init () {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			http.createServer(app).listen(config.server.port, () => {
				console.log('Web listening on port:', config.server.port)
				resolve();
			});
		}, 2500);

		// DEBUG REDIS
/*		setInterval(async () => {
			console.log(await redis.keys(config.redis.prefix_express));
		}, 2000);*/
	});
}

async function tests () {
	return new Promise((resolve, reject) => {
		resolve(1);
	});
}

init();