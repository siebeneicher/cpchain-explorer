const express = require('express');
const app = express();
const bodyParser = require('body-parser');
//const socket_io = require('socket.io');
const now = require('performance-now');
const http = require('http');
const config = require('./app/config');
const {aggregate, updateAll} = require('./app/middleware');

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
	});
}

async function tests () {
	return new Promise((resolve, reject) => {
		resolve(1);
	});
}

init().then(/*aggregate.reset*/);