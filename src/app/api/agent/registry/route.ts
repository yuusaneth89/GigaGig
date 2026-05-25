import { NextRequest, NextResponse } from 'next/server';
import { readAgents, writeAgents, AgentIdentity } from '@/services/jobsDb';
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export async function GET() {
  try {
    const agents = readAgents();
    return NextResponse.json({ success: true, agents });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, agentAddress, name, category, metadataURI, stakeAmount, rating } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: "Missing parameter: action" }, { status: 400 });
    }

    const agents = readAgents();

    switch (action) {
      case 'register': {
        if (!agentAddress || !name || !category) {
          return NextResponse.json({ success: false, error: "Missing registration parameters" }, { status: 400 });
        }
        if (agents.some(a => a.agentAddress.toLowerCase() === agentAddress.toLowerCase())) {
          return NextResponse.json({ success: false, error: "Agent already registered" }, { status: 400 });
        }

        // Developer-Controlled Wallet creation
        let circleWalletAddress = undefined;
        let circleWalletId = undefined;

        const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;
        const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
        const CIRCLE_WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID;

        if (CIRCLE_API_KEY && CIRCLE_ENTITY_SECRET && CIRCLE_WALLET_SET_ID) {
          try {
            console.log("[Circle SDK] Initializing Developer-Controlled Wallets Client...");
            const client = initiateDeveloperControlledWalletsClient({
              apiKey: CIRCLE_API_KEY,
              entitySecret: CIRCLE_ENTITY_SECRET,
            });

            console.log(`[Circle SDK] Dynamically creating secure wallet set wallet for agent: ${name}...`);
            const walletsResponse = await client.createWallets({
              blockchains: ['ETH-SEPOLIA'], // Defaulting to Ethereum Sepolia / EVM compatible
              count: 1,
              walletSetId: CIRCLE_WALLET_SET_ID,
            });

            const createdWallets = walletsResponse.data?.wallets;
            if (createdWallets && createdWallets.length > 0) {
              circleWalletAddress = createdWallets[0].address;
              circleWalletId = createdWallets[0].id;
              console.log(`[Circle SDK] Successfully created Developer-Controlled Wallet! Address: ${circleWalletAddress}`);
            }
          } catch (err: any) {
            console.error("[Circle SDK] Error in developer-controlled wallet creation:", err.message || err);
          }
        } else {
          console.warn("[Circle SDK] Skipping real wallet creation because CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET is not configured in .env");
        }

        const newAgent: AgentIdentity = {
          id: agents.length > 0 ? Math.max(...agents.map(a => a.id)) + 1 : 1,
          agentAddress,
          name,
          category,
          metadataURI: metadataURI || `ipfs://default_${agentAddress.slice(2, 8)}.json`,
          stakedUSDC: 0,
          avgRating: 5.0,
          ratingCount: 0,
          ratingSum: 0,
          isRegistered: true,
          circleWalletAddress,
          circleWalletId
        };
        agents.push(newAgent);
        writeAgents(agents);
        return NextResponse.json({ success: true, agent: newAgent });
      }

      case 'stake': {
        if (!agentAddress || stakeAmount === undefined) {
          return NextResponse.json({ success: false, error: "Missing staking parameters" }, { status: 400 });
        }
        const index = agents.findIndex(a => a.agentAddress.toLowerCase() === agentAddress.toLowerCase());
        if (index === -1) {
          return NextResponse.json({ success: false, error: "Agent not registered" }, { status: 404 });
        }
        agents[index].stakedUSDC += Number(stakeAmount);
        writeAgents(agents);
        return NextResponse.json({ success: true, agent: agents[index] });
      }

      case 'rate': {
        if (!agentAddress || rating === undefined) {
          return NextResponse.json({ success: false, error: "Missing rating parameters" }, { status: 400 });
        }
        const index = agents.findIndex(a => a.agentAddress.toLowerCase() === agentAddress.toLowerCase());
        if (index === -1) {
          return NextResponse.json({ success: false, error: "Agent not registered" }, { status: 404 });
        }
        const numericRating = Number(rating);
        if (numericRating < 1 || numericRating > 5) {
          return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 });
        }
        agents[index].ratingCount += 1;
        agents[index].ratingSum += numericRating;
        agents[index].avgRating = Number((agents[index].ratingSum / agents[index].ratingCount).toFixed(1));
        writeAgents(agents);
        return NextResponse.json({ success: true, agent: agents[index] });
      }

      default:
        return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
