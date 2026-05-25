const { createPublicClient, http } = require('viem');
const { arcTestnet } = require('viem/chains');

const DEPLOYER = '0xCA2DE969C3266f530a27bE3B46EC0550cF609c67';

async function main() {
  console.log('Testing RPC connection to Arc Testnet...');
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http('https://rpc.testnet.arc.network')
  });

  try {
    const blockNumber = await client.getBlockNumber();
    console.log('Current block number:', blockNumber.toString());

    const balance = await client.getBalance({ address: DEPLOYER });
    console.log(`Balance of ${DEPLOYER}:`, Number(balance) / 1e18, 'USDC');
  } catch (error) {
    console.error('Error connecting to RPC:', error);
  }
}

main();
