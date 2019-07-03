const block_each_second = 10;

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
		url: 'mongodb://localhost:27018',
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
		block_each_second: block_each_second,
		// theoretical amount of blocks within a given units timeframe
		should_blocks_per_unit: {
			minute: 60 / block_each_second,
			hour: 60*60 / block_each_second,
			day: 60*60*24 / block_each_second,
			week: 60*60*24*7 / block_each_second,
			//month: 60*60*24*30 / block_each_second,		// 28,30,31
			year: 60*60*24*365 / block_each_second,
		},
		rewardsPerBlock: 12.68
	}
};