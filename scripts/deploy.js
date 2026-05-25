require('dotenv').config();
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { arcTestnet } = require('viem/chains');
const fs = require('fs');
const path = require('path');

const platformArtifact = require('../src/abi/GigaGigPlatform.json');

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';

  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY environment variable is not set.');
    console.log('Please set it in a .env file at the project root.');
    console.log('Example: PRIVATE_KEY=0x...');
    process.exit(1);
  }

  // Ensure key format has 0x prefix
  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey);

  console.log(`Deploying GigaGigPlatform from account: ${account.address}`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  // Verify wallet has balance for gas (which is USDC on Arc)
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Wallet Balance: ${Number(balance) / 1e18} USDC (Arc uses USDC as native gas token with 18 decimals)`);

  if (balance === 0n) {
    console.warn('WARNING: Wallet balance is 0. Please fund this address at https://faucet.circle.com before deploying.');
  }

  console.log('\nDeploying GigaGigPlatform contract...');
  const platformHash = await walletClient.deployContract({
    abi: platformArtifact.abi,
    bytecode: platformArtifact.bytecode.startsWith('0x') ? platformArtifact.bytecode : `0x${platformArtifact.bytecode}`,
    args: [USDC_ADDRESS],
  });
  console.log(`Transaction sent: ${platformHash}`);
  console.log('Waiting for transaction finality...');
  
  const platformReceipt = await publicClient.waitForTransactionReceipt({ hash: platformHash });
  const platformAddress = platformReceipt.contractAddress;
  console.log(`GigaGigPlatform deployed at: ${platformAddress}`);

  // Save deployed addresses
  const addressesPath = path.resolve(__dirname, '../src/abi/addresses.json');
  fs.writeFileSync(
    addressesPath,
    JSON.stringify({
      GigaGigPlatform: platformAddress,
      USDC: USDC_ADDRESS,
      chainName: 'Arc Testnet',
      chainId: arcTestnet.id,
      explorer: 'https://testnet.arcscan.app',
    }, null, 2)
  );

  console.log(`\nDeployment configuration saved to: ${addressesPath}`);
  console.log('Deployment completed successfully!');
}

main().catch((error) => {
  console.error('Deployment script failed:', error);
  process.exit(1);
});
