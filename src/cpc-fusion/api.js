const now = require('performance-now');
const config = require('../app/config');
const {python_exe, clone} = require('../app/helper');
const Web3 = require('web3');
const web3 = new Web3(config.node.rpc_url, null, {});
//const web3 = new Web3('ws://127.0.0.1:8546', null, {});
const request = require('request-promise-native');
const { exec } = require('child_process');
let python;


/*async function call_web3 (action, ...params) {
	return web3.eth.getBlockNumber();
}*/


const apis = {
	python: async (action, params) => {
		if (!python)
			python = await python_exe();

		const t = now();

		const cmd = python + " ./cpc-fusion/api.py " + action + " " + params.join(' ');

		return new Promise ((resolve, reject) => {
			exec(cmd, async function (err, data) {
				//console.log("TIME API EXEC:", (now()-t).toFixed(2), "ms", cmd);

				if (err) console.error(cmd, err);

				if (err)
					return reject(err);

				try {
					const json = JSON.parse(data);
					if (json.error)
						reject(json.error);
					else
						resolve(json);
				} catch (err) {
					//console.log(err, data)
					reject(err);
				}
			});
		});
	},
	rpc: async (action, params = []) => {
		const t = now();
		let method;
		let params_ori = clone(params);

		// Docs: https://docs.cpchain.io/api/rpc.html#json-rpc-api
		// ETH: https://web3js.readthedocs.io/en/v1.2.0/web3-utils.html?highlight=isValidAddress#utils-tobn


		if (action == "balance") {
			method = "eth_getBalance";
			if (params[1] !== undefined && !params[1]) params[1] = "latest";
			//else if () params[1] = web3.utils.numberToHex(params[1]);			// TODO
		}
		if (action == "blockNumber") {
			method = "eth_blockNumber";
		}
		if (action == "transaction") {
			method = "eth_getTransactionReceipt";
		}
		if (action == "block") {
			method = "eth_getBlockByNumber";
			// specific block
			if (!["latest","pending","earliest"].includes(params[0])) params[0] = web3.utils.numberToHex(params[0]);
		}
		if (action == "block-proposer") {
			method = "eth_getProposerByBlock";
			params[0] = web3.utils.numberToHex(params[0]);
		}
		if (action == "generation") {
			method = "eth_getBlockGenerationInfo";
		}
		if (action == "rnodes") {
			method = "eth_getRNodes";
		}


		const opts = {
			method: "POST",
			url: config.node.rpc_url,
			body: { "jsonrpc":"2.0", "method":method, "params": params, "id":1 },
			json: true
		};

		return request(opts).then((res, err) => {
			//console.log("TIME API EXEC:", (now()-t).toFixed(2), "ms", action, params);
			//console.log(opts, res.result, err);

			if (err) {
				throw err;
			}

			if (res && res.error) {
				debugger; params_ori;
				throw res.error;
			}

			try {
				if (action == "balance") {
					return {balance: web3.utils.toBN(res.result) / config.cpc.unit_convert};
				}
				if (action == "blockNumber") {
					return web3.utils.hexToNumber(res.result);
				}
				if (action == "block") {

						res.result.number = web3.utils.hexToNumber(res.result.number);
						res.result.gasLimit = web3.utils.hexToNumber(res.result.gasLimit);
						res.result.gasUsed = web3.utils.hexToNumber(res.result.gasUsed);
						res.result.size = web3.utils.hexToNumber(res.result.size);
						res.result.timestamp = web3.utils.hexToNumber(res.result.timestamp);

						res.result.transactions.forEach(t => {
							t.blockNumber = web3.utils.hexToNumber(t.blockNumber);
							t.gas = web3.utils.hexToNumber(t.gas);
							t.gasPrice = web3.utils.hexToNumber(t.gasPrice);
							t.type = web3.utils.hexToNumber(t.type);
							t.nonce = web3.utils.hexToNumber(t.nonce);
							t.transactionIndex = web3.utils.hexToNumber(t.transactionIndex);
							t.value = web3.utils.toBN(t.value) / config.cpc.unit_convert;
							t.v = web3.utils.hexToNumber(t.v);
						});
				}
				if (action == "block-proposer") {
					return {proposer: res.result};
				}
			} catch (e) {
				console.log(e);
				debugger;
				throw (e);
			}

			return res.result;
		});
	}
}

async function call (action, ...params) {
	return apis[config.node.use_api](action, params);
}

async function rnodes () {
	return call('rnodes');
}
async function versions () {
	return call('versions');
}
async function generation (mustBlockNum = null) {
	return call('generation').then(gen => {
		if (mustBlockNum === null) return gen;
		if (gen.BlockNumber == mustBlockNum) return gen;		// validate block number
		return null;
	});
}
async function block (num = "latest", fullTrxs = true) {
	return call('block', num, fullTrxs);
}
async function blockProposer (num) {
	try {
		let {proposer} = await call('block-proposer', num);
		return web3.utils.toChecksumAddress(proposer);
	} catch (err) {
		console.error("Error getting block proposer ("+num+"): ", err);
		return Promise.reject(err);
	}
}
async function transaction (txn) {
	try {
		return await call('transaction', txn);
	} catch (err) {
		console.error("Error getting transaction ("+txn+"): ", err);
		return Promise.reject(err);
	}
}
async function balance (addr, blockNum = null) {
	try {
		let {balance} = await call('balance', addr, blockNum);
		return Promise.resolve(balance);
	} catch (err) {
		console.error("Error getting balance ("+addr+"): ", err);
		return Promise.reject(err);
	}
}

async function blockNumber () {
	return call('blockNumber');
}

async function perfTest () {

	//await _t1();
	//await _t2();
	//await _t3();
	await _t4();

	return Promise.resolve();


	async function _t1 () {
		let t = now();

		// 1. test 10 sequential mixed API requests
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446");
		await block();
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f");
		await generation();
		await versions();
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5");
		await rnodes();

		console.log("api perfTest.t1:", now()-t);

		return Promise.resolve();
	}

	async function _t2 () {
		let t = now();

		// 1. test 10 parallel mixed API requests
		return Promise.all([
			balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
			,block()
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
			,generation()
			,versions()
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
			,rnodes()
		]).then(() => {
			console.log("api perfTest.t2:", now()-t);
		});
	}

	async function _t3 () {
		let t = now();

		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		console.log("api perfTest.t3:", now()-t);

		return Promise.resolve();
	}

	async function _t4 () {
		let t = now();

		return Promise.all([
			balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
		]).then(() => {
			console.log("api perfTest.t4:", now()-t);
		});
	}

}

module.exports = {blockNumber, rnodes, versions, generation, block, transaction, balance, web3, perfTest, blockProposer};


/*
const rpc = require("ethrpc");
const connectionConfiguration = {
  httpAddresses: ["http://127.0.0.1:8051"], // optional, default empty array
  wsAddresses: [], // optional, default empty array
  ipcAddresses: [], // optional, default empty array
  //networkID: 3, // optional, used to verify connection to the intended network (blockchain)
  connectionTimeout: 3000, // optional, default 3000
  errorHandler: function (err) { }, // optional, used for errors that can't be correlated back to a request
};
rpc.connect(connectionConfiguration, function (err) {
  if (err) {
    console.error("Failed to connect to Ethereum node.", err);
  } else {
    console.log("Connected to Ethereum node!");
  }
});
*/