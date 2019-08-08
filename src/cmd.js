const {dashboard, aggregate, updateAll, blocks, rnodes, kpi, transactions} = require('./app/middleware');
const {rewards, balances, price} = require('./app/data');
const {python_exe} = require('./app/helper');
const {versions, perfTest, blockProposer} = require('./cpc-fusion/api');

setTimeout(async () => {

	//await balances.ranking_update();

	//await perfTest();

	//await balances.update("0x76130DA5aA1851313a7555D3735BED76029560DA");

	//console.log(await rewards.last_merged("month", 2, '0x3160B1B5ed4eB77560Af85C5c0835e6188F69147'));
	//console.log(await rewards.last_merged("day", 7));

	console.log(await blockProposer(36439));

	//await aggregate.reset();
	//await aggregate.reset("month");
	//await aggregate.run();
	//await aggregate.test();

/*	try {
		await balances.latest("0xcB6Fb6a201D6C126f80053FE17ca45188e24Fe2F");
		await balances.latest("0xcB6Fb6a201D6C126f80053FE17ca45188e24Fe2f");
		await balances.latest("0xcB6Fb6a201D6C126f80053FE17ca45188e24Fe2d");
		await balances.latest("0xcB6Fb6a201D6C126f80053FE17ca45188e24Fe2");
	} catch (err) { console.error(err); }*/

/*	console.log(await kpi.options('last_rewards'));
	console.log(await kpi.get('last_rewards', 'hour'));
	console.log(await kpi.get('last_rewards', 'day'));
	console.log(await kpi.get('last_rewards', 'week'));
	console.log(await kpi.get('last_rewards', 'month'));
	console.log(await kpi.get('last_rewards', 'quarter'));
	console.log(await kpi.get('last_rewards', 'year'));*/

	//console.log(await dashboard.update());
	//await blocks.last();

	//let r = await rewards.last_merged('day', 1);
	//console.log(r);

/*	await blocks.last();
	await blocks.last(true);
	await blocks.last();*/

	//await transactions.graph.update('day', 20, 'latest');
	//console.log(await blocks.squared.update('day', new Date().getTime()));

	//let addr = '0x501f6cf7b2437671d770998e3b785474878fef1d';
	//await balances.latest(addr);
	//await blocks.latest('minute', addr);
	//console.log(await rnodes.user.update("0xcB6Fb6a201D6C126f80053FE17ca45188e24Fe2f"));
	//await rnodes.user.cache_flush_all();

	//await dashboard.update();
	//console.log(await python_exe());
	//console.log(await versions());

	process.exit()
}, 2500);
