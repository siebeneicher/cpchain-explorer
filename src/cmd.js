const {dashboard, aggregate, updateAll, blocks, rnodes} = require('./app/middleware');
const {rewards} = require('./app/data');
const {python_exe} = require('./app/helper');
const {versions} = require('./cpc-fusion/api');

setTimeout(async () => {
	//await aggregate.reset();
	//await aggregate.run();
	//await aggregate.test();

	//await dashboard.update();
	//await blocks.last();

	//let r = await rewards.last_merged('day', 1);
	//console.log(r);

	console.log(await blocks.squared.update('day', new Date().getTime()));

	//await rnodes.user.update('0x45F40E0C7135D86D92a88443a160045a2897436E');
	//await rnodes.user.cache_flush_all();

	//await dashboard.update();
	//console.log(await python_exe());
	//console.log(await versions());

	process.exit()
}, 1500);
