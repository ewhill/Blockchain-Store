const chalk = require('chalk');
const crypto = require('crypto');
const util = require('util');

const { CHAIN_STORAGE_MODES, GENESIS_HASH } = require('./lib/base/Constants');
const sha2img = require('./lib/misc/sha2img');
const Database = require('./lib/mongo/Database');

const FLAG_CHAIN_STORAGE_MODE = 
	process.argv[2]
		.toString()
		.trim()
		.replace(/^\-{1,2}chain_storage_mode=(.*)/ig, "$1")
		.toLowerCase();

let chainStorageMode;
let Block;
let Chain;

console.log(`Using '${FLAG_CHAIN_STORAGE_MODE}' mode for chain.`);

switch(FLAG_CHAIN_STORAGE_MODE) {
	case 'file':
		chainStorageMode = CHAIN_STORAGE_MODES.FILE;
		break;
	case 'mongo':
		chainStorageMode = CHAIN_STORAGE_MODES.MONGO;
		break;
	default:
		chainStorageMode = CHAIN_STORAGE_MODES.NONE;
		break;
}

switch(chainStorageMode) {
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
	let nTransactionsToAdd = parseInt(Math.floor((Math.random()*10))) + 1;

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
	let previousHash = GENESIS_HASH;
	if(chain.height > 0) {
		const previousBlock = await chain.get({ index: chain.height-1 });
		previousHash = previousBlock.hash;
	}

	let nBlocksToAdd = parseInt(Math.floor((Math.random()*3))) + 1; // [1-3]
	for(let i=0; i<nBlocksToAdd; i++) {
		const block = new Block({
			previous: previousHash,
			data: createTransactions()
		});

		try {
			await chain.add(block);
		} catch(e) {
			console.warn(e.stack);
		}

		previousHash = block.hash;
	}
};

const printChain = async (chain) => {
	let isValid = await chain.verify(false);

	console.log(
		`\n${isValid ? chalk.green('✓') : chalk.red('✗')} ` +
		chalk.underline.bold(`${chain.name} (${chain.height} blocks)`)
	);

	const printOp = async (b) => {
			if(!(b instanceof Block)) {
				b = new Block({ ...b });
			}
			const isValidBlock = b.verify(false);
			const hash = b.hash;
			console.log(`↳ ${hash} ` + 
				`${isValidBlock ? chalk.green('✓') : chalk.red('✗')}`);
			return b;
		};

	switch(chainStorageMode) {
		case CHAIN_STORAGE_MODES.MONGO:
		case CHAIN_STORAGE_MODES.FILE:
			await chain.walk({ operation: printOp });
			break;
		default:
			for(let b of chain.blocks) {
				await printOp(b);
			}
			break;
	}

	console.log("");
};

const performAndPrintDiff = async (orig, test) => {
	let diff;
	if (orig.height > test.height) {
		diff = await orig.diff(test);
	} else {
		diff = await test.diff(orig);
	}

	let i = 0;
	while(diff[i] === null && i<diff.length) i++;

	console.log(
		`\n\n${i} preceeding blocks are the same.\n\n`
			.replace(/^(.*)$/gm, (l) => `${chalk.bgGreen('\t')} ${l}`));

	while(diff[i] !== null && i<diff.length) {
		console.log(
			util.inspect(diff[i], {colors: true, depth: null})
				.replace(/^(.*)$/gm, (l) => `${chalk.bgRed('\t')} ${l}`));
		i++;
	}

	if(i < diff.length) {
		console.log(
			`\n\n${diff.length - i} succeeding blocks are the same.\n\n`
				.replace(/^(.*)$/gm, (l) => `${chalk.bgGreen('\t')} ${l}`));
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

	switch(chainStorageMode) {
		case CHAIN_STORAGE_MODES.MONGO:
			// For mongo-based blockchain:
			const db = new Database({
					host: 'localhost',
					name: 'testChain',
				});
			testChain = new Chain({
					database: db,
					autocommitTimeoutMs: 1000
				});
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
		let originalChain = await testChain.clone();

		// Check if the clone succeeded
		let cloneIsEqual = await testChain.equals(originalChain);
		console.log(`Clone of chain ${cloneIsEqual ? 'is' : 'IS NOT'} equal ` + 
			`to the original test chain.\n`);

		// Make some changes
		await addBlocks(testChain);

		// Print the cloned chain with additions
		await printChain(testChain);

		// Commit our changes to storage
		try {
			await testChain.commit();
		} catch(e) {
			console.log(chalk.rgb(255, 136, 0).bold(
				`There was an error committing the changes to the chain!`));
			console.error(e.message);
		}

		// Show the graphic generated from the chain's first block's hash
		const lastBlock = await testChain.get({ index: testChain.height-1 });
		printHashGraphic(lastBlock.hash);

		// Show the additions (diff from original)
		await performAndPrintDiff(originalChain, testChain);

		// Close the blockchain
		if(testChain.isClosable) {
			await testChain.close();
		}

		// Close the blockchain
		if(originalChain.isClosable) {
			await originalChain.close();
		}
	} catch(e) {
		console.log(e.stack);
	}
};

main().then(() => {
	console.log("[Process completed]");
	process.exit(0);
});
