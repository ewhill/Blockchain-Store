const chalk = require('chalk');
const crypto = require('crypto');
const util = require('util');

const { CHAIN_STORAGE_MODES, GENESIS_HASH } = require('./lib/base/Constants');
const sha2img = require('./lib/misc/sha2img');

const CHAIN_STORAGE_MODE = CHAIN_STORAGE_MODES.FILE;

let Block;
let Chain;

switch(CHAIN_STORAGE_MODE) {
	case CHAIN_STORAGE_MODES.FILE:
		Block = require('./lib/file/Block');
		Chain = require('./lib/file/Chain');
		break;
	case CHAIN_STORAGE_MODES.MONGO:
		Block = require('./lib/mongo/Block');
		Chain = require('./lib/mongo/Chain');
		break;
	default:
		Block = require('./lib/base/Block.js');
		Chain = require('./lib/base/Chain.js');
}

const createTransactions = () => {
	let transactions = [];
	let nTransactionsToAdd = parseInt(Math.floor((Math.random()*20))) + 1;

	for(let i=0; i<nTransactionsToAdd; i++) {
		transactions.push([{
			from: crypto.randomBytes(32).toString('hex'),
			to: crypto.randomBytes(32).toString('hex'),
			amount: parseInt(`0x${crypto.randomBytes(2).toString('hex')}`, 16)
		}]);
	}

	return transactions;
};

const addBlocks = async(chain) => {
	let nBlocksToAdd = parseInt(Math.floor((Math.random()*10))) + 1; // [1-10]
	let previousHash = chain.blocks && chain.blocks.length > 0 ? 
		chain.blocks.slice(-1)[0].hash : GENESIS_HASH;

	for(let i=0; i<nBlocksToAdd; i++) {
		let b;

		switch(CHAIN_STORAGE_MODE) {
			case CHAIN_STORAGE_MODES.MONGO:
				b = new Block({ 
					previous: previousHash,
					name: chain._database.name
				});
				break;
			case CHAIN_STORAGE_MODES.FILE:
			default:
				b = new Block({ previous: previousHash });
		}

		b.data = createTransactions();

		try {
			await chain.add(b);
		} catch(e) {
			console.warn(e.message);
		}

		previousHash = b.hash;
	}
};

const printChain = async (chain) => {
	let isValid = await chain.verify(false);

	let name = 'Chain';

	switch(CHAIN_STORAGE_MODE) {
		case CHAIN_STORAGE_MODES.MONGO:
			name = chain._database.name;
			break;
		case CHAIN_STORAGE_MODES.FILE:
			name = chain._directory;
			break;
	}

	console.log(
		`\n${isValid ? chalk.green('✓') : chalk.red('✗')} ` +
		chalk.underline.bold(`${name} (${chain.blocks.length} blocks)`)
	);

	for(let b of chain.blocks) {
		console.log(`↳ ${b.hash} ` + 
			`${b.verify(false) ? chalk.green('✓') : chalk.red('✗')}`);
	}

	console.log("");
};

const performAndPrintDiff = async (orig, test) => {
	let diff = await orig.diff(test);
	let first = true;
	let i = 0;

	while(diff[i] === null && i<diff.length) i++;

	console.log(
		`\n\n${i} preceeding blocks are the same.\n\n`
			.replace(/^(.*)$/gm, function(line) {
					return chalk.bgGreen('\t') + ' ' + line;
				})
	);

	while(diff[i] !== null && i<diff.length) {
		console.log(
			util.inspect(diff[i], {colors: true, depth: null})
				.replace(/^(.*)$/gm, function(line) {
					return chalk.bgRed('\t') + ' ' + line;
				})
		);
		i++;
	}

	if(i < diff.length) {
		console.log(
			`\n\n${diff.length - i} preceeding blocks are the same.\n\n`
				.replace(/^(.*)$/gm, function(line) {
						return chalk.bgGreen('\t') + ' ' + line;
					})
		);
	}
};

const printHashGraphic = (hash) => {
	let shaImgData = sha2img(hash);

	console.log("\n" + shaImgData.map(r => {
		return r.map(c => {
			return chalk.bgRgb(c[0], c[1], c[2]).bold('  ');
		}).join("");
	}).join("\n"));
};

const main = async () => {
	let testChain;

	switch(CHAIN_STORAGE_MODE) {
		case CHAIN_STORAGE_MODES.MONGO:
			// For mongo-based blockchain:
			testChain = new Chain({ name: `testChain`, 
									autocommitTimeoutMs: 1000 });
			break;
		case CHAIN_STORAGE_MODES.FILE:
			// For file-based blockchain:
			testChain = new Chain({ directory: `./test-chain` });
			break;
		default:
			// For non-persistent, in-memory only blockchain:
			testChain = new Chain();
	}

	try { 
		await testChain.load();
	} catch(e) {
		console.log(e.message);

		console.log(chalk.rgb(255, 136, 0).bold(
			"Error loading chain. A new chain will be created instead under " + 
			"the same name."));
	}

	// Print the chain as loaded
	await printChain(testChain);

	try {
		// Keep a copy of the orignal, unaltered chain
		let originalChain = testChain.clone();

		// Check if the clone succeeded
		let cloneIsEqual = await testChain.equals(originalChain);
		console.log(`Clone of chain ${cloneIsEqual ? 'is' : 'IS NOT'} equal ` + 
			`to the original test chain.\n`);

		// Make some changes
		await addBlocks(testChain);

		// Show the additions (diff versus original, and the full chain hashes)
		await performAndPrintDiff(originalChain, testChain);
		await printChain(testChain);

		// Commit our changes to storage
		try {
			await testChain.commit();
		} catch(e) {
			console.log(chalk.rgb(255, 136, 0).bold(
				`There was an error committing the changes to the chain!`));
			console.error(e.message);
		}

		let indicesCorrect = true;
		for(let i=0; i<testChain.blocks.length; i++) {
			if(testChain.indices[testChain.blocks[i].hash] !== i) {
				indicesCorrect = false;
				console.log(chalk.rgb(255, 136, 0).bold(
					`The chain contains invalid index for ` + 
					`block ${testChain.blocks[i].hash}!`));
			}
		}

		if(indicesCorrect) {
			console.log(chalk.rgb(0, 255, 0).bold(
				`The chain has valid indices.`));
		}

		// Perform a rollback to the first block in the chain
		await testChain.rollback(testChain._blocks[0]._hash);

		// Show the graphic generated from the chain's first block's hash
		printHashGraphic(testChain._blocks[0]._hash);

		// Show the rollback
		await printChain(testChain);

		// Commit our rollback to storage
		try {
			await testChain.commit();
		} catch(e) {
			console.log(chalk.rgb(255, 136, 0).bold(
				`There was an error committing the changes to the chain!`));
			console.error(e.message);
		}

		// Close the blockchain
		if(testChain.isClosable) {
			console.log("Closing Chain...");
			await testChain.close();
		}
	} catch(e) {
		console.log(e.stack);
	}
};

main().then(() => {
	console.log("[Process completed]");
	process.exit(0);
});
