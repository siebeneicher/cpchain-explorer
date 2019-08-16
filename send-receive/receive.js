const Web3 = require('web3');
const request = require('request')
const config = require('./config');
const web3 = new Web3(config.receiver.web3_url, null, {});


let last_received_trx_hash;

tick();
setInterval(tick, config.receiver.tickIntervalMS);


async function tick () {

	let b;
	let max_lookback = 25;
	let num = null;
	let received = false;
	let sended = false;
	//let number_hex = "0x"+(number).toString(16);
debugger;
	try {
		let i = 0;
		while (max_lookback > i) {
			b = await block(b);

			sended = has_trx_send(b);
			received = has_trx_received(b);

			if (sended) {
				// no need to send more before receive
				console.log("found send trx, break.");
				break
			}

			if (received) {
				console.log("received: ", i, b.number, received);

				if (last_received_trx_hash == received) {
					// no new transaction since last time we checked
					console.log("last_received_trx_hash == received, break.");
				}

				last_received_trx_hash = received;
				await send();
				break;
			}
			
			i++;
		}
	} catch (err) {
		console.error(err);
	}
}

function has_trx_received (b) {
	let ts = b.transactions;
	if (ts.length == 0) return false;

	for (let i in ts) {
		let t = ts[i];

		if (web3.utils.toChecksumAddress(t.from) == web3.utils.toChecksumAddress(config.sender.from) && web3.utils.toChecksumAddress(t.to) == web3.utils.toChecksumAddress(config.sender.to))
			return t.hash;
	}

	return false;
}

function has_trx_send (b) {
	let ts = b.transactions;
	if (ts.length == 0) return false;

	for (let i in ts) {
		let t = ts[i];

		if (web3.utils.toChecksumAddress(t.from) == web3.utils.toChecksumAddress(config.receiver.from) && web3.utils.toChecksumAddress(t.to) == web3.utils.toChecksumAddress(config.receiver.to))
			return t.hash;
	}

	return false;
}

async function block (lastBlock = null) {
	if (lastBlock == null)
		num = "latest";
	else
		num = lastBlock.number-1;

	return await web3.eth.getBlock(num, true);
}

async function send () {
	let to = config.receiver.to;
	let from = config.receiver.from;
	let cpc = config.receiver.amount;

	console.log("send() sending", cpc, "CPC from:", from, "to:", to);

	try {
		let t = await web3.eth.sendTransaction({from, to, value: "0x"+(cpc * config.receiver.multiplier).toString(16) });
		console.log("send() done in block", t.blockNumber);
	} catch (e) {
		console.error(e);
	}

	return Promise.resolve();
}