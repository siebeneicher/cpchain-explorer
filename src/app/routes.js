const app = module.exports = require('express')();
const {rnode, overview} = require('./middleware');
const {promisify} = require('util');
const fs = require('fs');

app.get('/rnode', async function (req, res) {
	let data = await rnode(req.query.rnode);
	res.json(data);
}).get('/dashboard', async function (req, res) {
	let data = await overview();
	res.json(data);
});


// last one, as its wildcard
app.get('/*', async function (req, res) {
	res.set({'Content-Type': 'text/html'});
	let f = await promisify(fs.readFile)("index.html");
	res.send(f);
})