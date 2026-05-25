import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from 'viem/chains';
import platformArtifact from '@/abi/GigaGigPlatform.json';
import addresses from '@/abi/addresses.json';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workerAddress, amount, taskType } = body;

    if (!workerAddress || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: workerAddress, amount" },
        { status: 400 }
      );
    }

    if (!PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, error: "Server error: Master private key not configured" },
        { status: 500 }
      );
    }

    const formattedKey = (PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedKey);

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(RPC_URL),
    });

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(RPC_URL),
    });

    // Check balance of master wallet
    const balance = await publicClient.getBalance({ address: account.address });
    if (balance === BigInt(0)) {
      return NextResponse.json(
        { success: false, error: "Master wallet has insufficient balance for gas fees" },
        { status: 500 }
      );
    }

    // Convert amount to 6 decimals (since USDC ERC20 uses 6 decimals)
    const amountBigInt = BigInt(Math.floor(Number(amount) * 1e6));

    console.log(`Sending instant payout of ${amount} USDC to worker ${workerAddress}...`);

    // Call payoutMicroTask on contract
    const txHash = await walletClient.writeContract({
      address: addresses.GigaGigPlatform as `0x${string}`,
      abi: platformArtifact.abi,
      functionName: 'payoutMicroTask',
      args: [workerAddress as `0x${string}`, amountBigInt, taskType || "Micro-task Verification"],
    });

    // Since Arc Testnet is sub-second finality, wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return NextResponse.json({
      success: true,
      message: `Instant payout transaction successful`,
      txHash,
      workerAddress,
      amount,
      gasUsed: receipt.gasUsed.toString(),
    });

  } catch (error: any) {
    console.error('Payout failed:', error);
    return NextResponse.json({ success: false, error: error.message || 'Transaction execution failed' }, { status: 500 });
  }
}
