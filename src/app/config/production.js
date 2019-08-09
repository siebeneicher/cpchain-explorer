
// production, only define what to replace from default.js
module.exports = {
	server: {
		host: 'rnodes.io',
		port: 8080
	},
	mongo: {
		profiling: {
			level: 'off'
		}
	},
	node: {
		use_api: 'rpc'
	}
};