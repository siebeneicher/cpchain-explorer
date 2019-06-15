const Redis = require("redis");
const conf = require('./config');

// REDIS
redis = Redis.createClient(conf.redis.port, conf.redis.host);
redis.on("error", (error) => console.error('Redis error:',error))
redis.on("connect", () => console.log('Redis client connected', conf.redis.port, conf.redis.host))

const self = {
	get: async (what) => {
		return new Promise((resolve, reject) => {
			redis.get(what, (err, result) => {
				if (err) return reject(err);

				try {
					resolve(JSON.parse(result));
				} catch(e) {
					resolve(result);
				}
			});
		});
	},
	hget: async (what, field) => {
		return new Promise((resolve, reject) => {
			redis.hget(what, field, (err, result) => {
				if (err) return reject(err);

				try {
					resolve(JSON.parse(result));
				} catch(e) {
					resolve(result);
				}
			});
		});
	},
	set: (what, val, print = false) => {
		let _val = typeof val == "object" ? JSON.stringify(val) : val;
		redis.set(what, _val, print ? redis.print : undefined);
	},
	hset: async (what, field, val) => {
		return new Promise((resolve, reject) => {
			let _val = typeof val == "object" ? JSON.stringify(val) : val;
			redis.hset(what, field, _val, (err) => {
				if (err) return reject(err);
				resolve();
			});
		});
	},
	expire: (what, expire) => {
		redis.expire(what, expire);
	},
	client: redis
};

module.exports = self;