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
			useNewUrlParser: true,
			//https://stackoverflow.com/questions/30909492/mongoerror-topology-was-destroyed
			keepAlive: 1,
			connectTimeoutMS: 30000,
			reconnectTries: Number.MAX_VALUE,
			reconnectInterval: 1000
		},
		db: {
			sync: 'cpc_sync',
			aggregation: 'cpc_aggregations'
		}
	},
	cpc: {
		block_each_second: 10,
		rewardsPerBlock: 12.65
	}
};