
// production, only define what to replace from default.js
module.exports = {
	server: {
		host: 'af87f51.online-server.cloud',
		port: 80
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
};