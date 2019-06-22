module.exports = {
	server: {
		host: 'localhost',
		port: 8080
	},
	redis: {
		host: 'localhost',
		port: '6379',
		prefix: 'cpc.explorer'
	},
	mongo: {
		url: 'mongodb://localhost:27017',
		options: {
			useNewUrlParser: true
		},
		db: {
			sync: 'cpc_sync',
			aggregation: 'cpc_aggregations'
		}
	},
	cpc: {
		rewardsPerBlock: 12.65
	}
};