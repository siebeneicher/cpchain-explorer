const {dashboard, aggregate, updateAll, blocks, rnodes, kpi} = require('./app/middleware');
const {rewards, balances} = require('./app/data');
const {python_exe} = require('./app/helper');
const {versions} = require('./cpc-fusion/api');

setTimeout(async () => {
	//await aggregate.reset();
	//await aggregate.run();
	//await aggregate.test();

/*	console.log(await kpi.options('last_rewards'));
	console.log(await kpi.get('last_rewards', 'hour'));
	console.log(await kpi.get('last_rewards', 'day'));
	console.log(await kpi.get('last_rewards', 'week'));
	console.log(await kpi.get('last_rewards', 'month'));
	console.log(await kpi.get('last_rewards', 'quarter'));
	console.log(await kpi.get('last_rewards', 'year'));*/

	//await dashboard.update();
	//await blocks.last();

	//let r = await rewards.last_merged('day', 1);
	//console.log(r);

	//await rnodes.streamgraph.update('hour', 24);
	//console.log(await blocks.squared.update('day', new Date().getTime()));

	let addr = '0x501f6cf7b2437671d770998e3b785474878fef1d';
	//await balances.latest(addr);
	//await blocks.latest('minute', addr);
	await rnodes.user.update(addr);
	//await rnodes.user.cache_flush_all();

	//await dashboard.update();
	//console.log(await python_exe());
	//console.log(await versions());

	process.exit()
}, 1500);
