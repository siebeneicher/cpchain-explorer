const {dashboard, aggregate, updateAll, blocks, rnodes, price, kpi, transactions} = require('./app/middleware');
const data = require('./app/data');
const {python_exe} = require('./app/helper');
const {versions, blockNumber, transaction, generation, /*rnodes, */perfTest, blockProposer, block, balance} = require('./cpc-fusion/api');

setTimeout(async () => {

	//await balances.ranking_update();

	//await perfTest();

	//await data.rnodes.blocks_count('0xfAf2a2CDC4Da310B52aD7d8d86e8C1bd5D4C0bD0');
	//await data.transactions.ofAddress_count('0x2A186bE66Dd20c1699Add34A49A3019a93a7Fcd0');

	//console.log(await balance("0xcB6Fb6a201D6C126f80053FE17ca45188e24Fe2F"));
	//console.log(await transaction("0x6764996826a1cbb1224ade30d180669b4b056f97a8105a92b093199f78926c68"));
	//console.log(await generation());

	console.log(await data.rewards.last("month", 14, 'latest', '0x8d16adafb4633a3956691aa4636b603e8f328446'));
	console.log(await data.rewards.last("month", 1, 'prelatest', '0x8d16adafb4633a3956691aa4636b603e8f328446'));

	//console.log(await data.rewards.last("hour", 99, '0x482c08849B8818A2F288DF8901C4873B891599b8'));
	//console.log(await data.rewards.last("day", 99, '0x482c08849B8818A2F288DF8901C4873B891599b8'));
	//console.log(await data.rewards.last("month", 99, '0x482c08849B8818A2F288DF8901C4873B891599b8'));
	//console.log(await data.rewards.last("year", 99, '0x482c08849B8818A2F288DF8901C4873B891599b8'));
	//console.log(await rewards.last_merged("day", 7));

	//console.log(await price.graph.update('day', 7, 'latest', {exclude_latest: true}));

	//await aggregate.reset();
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
