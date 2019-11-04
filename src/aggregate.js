const {messaging, config, middleware} = require('./app');

// this process is doing the aggregation work via redis messaging

async function run () {
	// initial
	middleware.updateAll();

	messaging.on('SYNC-NEW-BLOCK', async function(data) {
		console.log('SYNC-NEW-BLOCK: middleware.update_lastBlock() + middleware.update_blocksSquared()');

		middleware.update_lastBlock();
		middleware.update_blocksSquared();
	});
	messaging.on('SYNC-BACKWARDS-PERFORMED', function(data) {
		console.log('SYNC-BACKWARDS-PERFORMED: middleware.updateAll()');
		middleware.updateAll();
	});
	messaging.on('SYNC-RNODES-N-BALANCES-PERFORMED', function(data) {
		console.log('SYNC-BACKWARDS-PERFORMED: middleware.updateAll()');
		middleware.updateAll();
	});
	messaging.on('SYNC-MISSING-BALANCES-PERFORMED', function(data) {
		//console.log('SYNC-MISSING-BALANCES-PERFORMED');
	});
	messaging.on('SYNC-CPC-PRICE', function(data) {
		console.log('SYNC-CPC-PRICE: middleware.update_price()');
		middleware.update_price();
	});
}

setTimeout(run, 3500);
