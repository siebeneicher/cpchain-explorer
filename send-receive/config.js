module.exports = {
	sender: {
		//from: '0x17d52a444cf2462e68a2be459ca640fc3b326906',		// local dev civilian
		from: '0x8d16adafb4633a3956691aa4636b603e8f328446',			// rnode

		to: '0x17d52a444cf2462e68a2be459ca640fc3b326906',			// local dev civilian
		//to: '0x8d16adafb4633a3956691aa4636b603e8f328446',			// rnode

		amount: 2,
		sendIntervalMS: 1000 * 60,
		multiplier: 1000000000000000000,

		web3_url: 'http://127.0.0.1:8501'
	},

	receiver: {
		from: '0x17d52a444cf2462e68a2be459ca640fc3b326906',			// local dev civilian
		//from: '0x8d16adafb4633a3956691aa4636b603e8f328446',		// rnode

		//to: '0x17d52a444cf2462e68a2be459ca640fc3b326906',			// local dev civilian
		to: '0x8d16adafb4633a3956691aa4636b603e8f328446',			// rnode

		amount: 2,
		tickIntervalMS: 1000 * 30,
		multiplier: 1000000000000000000,

		web3_url: 'http://127.0.0.1:8765'
	}
}