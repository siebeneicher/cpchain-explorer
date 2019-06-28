const {messaging, config, middleware} = require('./app');

// this process is doing the aggregation work

async function run () {
	// initial
	middleware.updateAll();

	messaging.on('SYNC-SNAPSHOT-PERFORMED', function(data) {
		console.log('SYNC-SNAPSHOT-PERFORMED');

		middleware.updateAll();
	});
	messaging.on('SYNC-BACKWARDS-PERFORMED', function(data) {
		console.log('SYNC-BACKWARDS-PERFORMED');

		middleware.updateAll();
	});
	messaging.on('SYNC-BALANCES-PERFORMED', function(data) {
		console.log('SYNC-BALANCES-PERFORMED');
	});
}

setTimeout(run, 2500);
