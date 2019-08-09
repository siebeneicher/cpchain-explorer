const block_each_second = 10;

module.exports = {
	server: {
		scheme: 'http',
		host: 'localhost',
		port: 8080
	},
	redis: {
		host: 'localhost',
		port: '6379',
		prefix: 'cpc.explorer.data',
		prefix_express: 'cpc.explorer.express'
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
		},
		profiling: {
			level: 'all'			// https://mongodb.github.io/node-mongodb-native/2.0/api/Admin.html
		}
	},
	cpc: {
		block_impeached_second: 20,			// 10 + 10
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
		rewardsPerBlock: 12.65,
		unit_convert: 1000000000000000000,			// parseInt(1+("0".repeat(18)))
		impeached_miner: "0x0000000000000000000000000000000000000000",
		rnode_lock_amount_min: 200000
	},
	coinmarketcap: {
		api_key: "0a7fbb6f-e1d1-4668-8f3f-0a1cd3001f10",
		api_url: "https://pro-api.coinmarketcap.com",
		cpc_id: 2482
	},
	node: {
		use_api: 'rpc',
		rpc_url: 'http://127.0.0.1:8765'
	}
};