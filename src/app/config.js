module.exports = {
	server: {
		host: 'localhost',
		port: 8080
	},
	redis: {
		host: 'localhost',
		port: '6379',
		scope: 'cpc.explorer.'
	},
	mongo: {
		url: 'mongodb://localhost:27017',
		options: {
			useNewUrlParser: true
		},
		db: {
			chain: 'cpc_watcher',
			aggregation: 'cpc_explorer_aggregations'
		}
	}
};