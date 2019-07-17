const redis = require('./redis');
const config = require('./config');
const cache = require('express-redis-cache')({ client: redis.client, prefix: config.redis.prefix_express });
const now = require('performance-now');

module.exports = {invalidate};

async function invalidate (what) {
	//console.log(await redis.keys());
	console.log("invalidating cache-fe:", what);
	await cache.del(what, () => {});
	//console.log(await redis.keys());
}
