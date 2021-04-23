const Web3 = require('web3');
//const request = require('request')
const config = require('./config').sender;
const web3 = new Web3(config.web3_url, null, {});

/*async function send () {
	let to = "0x6026ab99f0345e57c7855a790376b47eb308cb40";
	let from = "0xcdc888799762436da4d4c9b171ae2a1008cde986";
	let amount = "1000000000000000";

	console.log("sendTestTrx() sending from:", from, "to:", to);

	const params = [{from, to, "value": (parseInt(amount)).toString(16)}];
	const data = JSON.stringify({"jsonrpc":"2.0","method":"eth_sendTransaction","params":params,"id":1});

	const options = {
	  uri: 'http://127.0.0.1:8051',
	  method: 'POST',
	  headers: {
	    'Content-Type': 'application/json'
	  }
	}

	request.post(options, (error, res, body) => {
		if (error) {
			console.error(error)
			return
		}
		console.log(`statusCode: ${res.statusCode}`)
		console.log(body)
	})
}*/

async function send2 () {
	let to = config.to;
	let from = config.from;
	let cpc = config.amount;

	console.log("send2() sending", cpc, "CPC from:", from, "to:", to);

	try {
		let t = await web3.eth.sendTransaction({from, to, value: "0x"+(cpc * config.multiplier).toString(16) });
		console.log("send2() done", t.blockNumber);
	} catch (e) {
		console.error(e);
	}

	return Promise.resolve();
}


send2();

setInterval(send2, config.sendIntervalMS);
