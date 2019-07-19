
// production, only define what to replace from default.js
module.exports = {
	server: {
		host: 'rnodes.io',
		port: 80
	},
	mongo: {
		profiling: {
			level: 'off'
		}
	}
};