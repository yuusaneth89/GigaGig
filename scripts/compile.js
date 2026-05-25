const path = require('path');
const fs = require('fs');
const solc = require('solc');

const contractPath = path.resolve(__dirname, '../contracts/GigaGigPlatform.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'GigaGigPlatform.sol': {
      content: source
    }
  },
  settings: {
    viaIR: true,
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode']
      }
    },
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};

console.log('Compiling GigaGigPlatform contract...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors/warnings
let hasErrors = false;
if (output.errors) {
  output.errors.forEach(err => {
    console.log(err.formattedMessage);
    if (err.severity === 'error') {
      hasErrors = true;
    }
  });
}

if (hasErrors) {
  console.error('Compilation failed due to errors.');
  process.exit(1);
}

const buildDir = path.resolve(__dirname, '../src/abi');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Save GigaGigPlatform
const platformContracts = output.contracts['GigaGigPlatform.sol'];
for (let contractName in platformContracts) {
  const contract = platformContracts[contractName];
  fs.writeFileSync(
    path.resolve(buildDir, `${contractName}.json`),
    JSON.stringify({
      abi: contract.abi,
      bytecode: contract.evm.bytecode.object
    }, null, 2)
  );
}

console.log('Compilation successful! ABIs saved to src/abi');
