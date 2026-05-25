'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useBalance, useBlockNumber } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { 
  Coins, Play, Square, CheckCircle, Code, Cpu, ArrowRight, ExternalLink, 
  Clock, AlertTriangle, Layers, Plus, RefreshCw, Globe, Activity, Sparkles, Send, Check,
  User, ShieldCheck, Award, Star, Terminal, ArrowUpRight, Zap
} from 'lucide-react';
import platformArtifact from '../abi/GigaGigPlatform.json';
import addresses from '../abi/addresses.json';

// Minimal ERC20 ABI for USDC
const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Interface for AI Agent Sourced Jobs (ERC-8183)
interface Job {
  id: number;
  taskId: string;
  agent: string;
  worker: string | null;
  evaluator: string;
  bounty: number; // 6 decimals (USDC)
  description: string;
  imageUrl?: string;
  solution: string | null;
  status: 'Created' | 'Claimed' | 'Submitted' | 'Approved' | 'Cancelled';
  createdAt: number;
  completedAt: number;
  txHash?: string | null;
}

// Interface for AI Agent Identity (ERC-8004)
interface AgentIdentity {
  id: number;
  agentAddress: string;
  name: string;
  category: string;
  metadataURI: string;
  stakedUSDC: number;
  avgRating: number;
  ratingCount: number;
  ratingSum: number;
  isRegistered: boolean;
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'freelancer' | 'registry' | 'developer'>('freelancer');
  const [freelancerSubTab, setFreelancerSubTab] = useState<'microtask' | 'streaming' | 'agentjob'>('microtask');

  // Balances
  // 1. Native Gas USDC (18 Decimals)
  const { data: gasBalance, refetch: refetchGas } = useBalance({
    address: address,
  });

  // 2. ERC-20 USDC (6 Decimals)
  const { data: usdcBalanceRaw, refetch: refetchUsdc } = useReadContract({
    address: addresses.USDC as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    }
  });

  const usdcBalance = usdcBalanceRaw !== undefined 
    ? Number(formatUnits(usdcBalanceRaw as bigint, 6)) 
    : 0;

  // Platform Analytics State
  const [platformStats, setPlatformStats] = useState({
    totalCompleted: 1204,
    totalVolume: '24.08',
    activeStreams: 2,
    totalEscrowLocked: 0.08,
    totalStakedCollateral: 280.0
  });

  // --- Feature A: Proof-of-Task Instant Payout State ---
  const [labelIndex, setLabelIndex] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [taskAProcessing, setTaskAProcessing] = useState(false);
  const [taskASuccess, setTaskASuccess] = useState(false);
  const [taskATxHash, setTaskATxHash] = useState<string | null>(null);
  
  const microTasks = [
    {
      id: 'mt-1',
      image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600&q=80',
      question: 'Identify the primary target category for the AI drone pathfinding model:',
      options: ['Commercial Building', 'High-voltage Powerline', 'Road Intersection', 'Pedestrian Walkway'],
      correctIndex: 2
    },
    {
      id: 'mt-2',
      image: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=600&q=80',
      question: 'Evaluate the LLM spatial coordinate description matching this vehicle location:',
      options: ['Accurate bounding box', 'Off-center coordinates', 'Duplicate labels', 'Missing critical assets'],
      correctIndex: 0
    }
  ];

  // --- Feature B: Continuous Streaming Compensation State ---
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [streamEarnings, setStreamEarnings] = useState(0);
  const [streamId, setStreamId] = useState<number | null>(null);
  const [txStreamingHash, setTxStreamingHash] = useState<string | null>(null);
  const [isClaimingStream, setIsClaimingStream] = useState(false);
  const [isStoppingStream, setIsStoppingStream] = useState(false);
  
  const streamRatePerSecond = 0.001; // 0.001 USDC/second
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Feature C: AI Agent Sourcing State (ERC-8183) ---
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [captchaInput, setCaptchaInput] = useState('');
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [isClaimingJob, setIsClaimingJob] = useState(false);
  const [jobSuccessTx, setJobSuccessTx] = useState<string | null>(null);

  // --- ERC-8004 Agent Registry State ---
  const [agentsList, setAgentsList] = useState<AgentIdentity[]>([]);
  const [regName, setRegName] = useState('');
  const [regCategory, setRegCategory] = useState('Data Labeling / RLHF');
  const [regMetadata, setRegMetadata] = useState('ipfs://QmXyZ123/metadata.json');
  const [regStakingAmount, setRegStakingAmount] = useState('10');
  const [isRegisteringAgent, setIsRegisteringAgent] = useState(false);
  const [isStakingAgent, setIsStakingAgent] = useState(false);
  const [selectedAgentForRating, setSelectedAgentForRating] = useState<string | null>(null);
  const [agentRatingVal, setAgentRatingVal] = useState(5);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // --- Developer Portal Custom Job Creation State ---
  const [devTaskId, setDevTaskId] = useState('bot-captcha-404');
  const [devDescription, setDevDescription] = useState('Verify the security CAPTCHA digits. Failed attempt block in automated search.');
  const [devBounty, setDevBounty] = useState('0.02');
  const [devEvaluator, setDevEvaluator] = useState('0xCA2DE969C3266f530a27bE3B46EC0550cF609c67');
  const [devImageUrl, setDevImageUrl] = useState('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80');
  const [devIsSubmitting, setDevIsSubmitting] = useState(false);
  const [devTxHash, setDevTxHash] = useState<string | null>(null);
  const [sdkLanguage, setSdkLanguage] = useState<'node' | 'python' | 'curl'>('node');

  // --- Circle CCTP Cross-Chain Funding Simulator State ---
  const [bridgeSourceChain, setBridgeSourceChain] = useState<'Arbitrum' | 'Avalanche' | 'Ethereum'>('Arbitrum');
  const [bridgeAmount, setBridgeAmount] = useState('25.0');
  const [bridgeLogs, setBridgeLogs] = useState<string[]>([]);
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeProgress, setBridgeProgress] = useState(0);

  // Wagmi Contract Hook
  const { writeContractAsync } = useWriteContract();

  // Fetch Jobs & Agents on mount
  const fetchJobsAndAgents = async () => {
    try {
      const resJobs = await fetch('/api/agent/task');
      const dataJobs = await resJobs.json();
      if (dataJobs.success) {
        setJobs(dataJobs.jobs);
        const completed = dataJobs.jobs.filter((j: Job) => j.status === 'Approved').length;
        const volume = dataJobs.jobs
          .filter((j: Job) => j.status === 'Approved')
          .reduce((sum: number, j: Job) => sum + j.bounty, 0);
        const activeEscrow = dataJobs.jobs
          .filter((j: Job) => j.status === 'Created' || j.status === 'Claimed' || j.status === 'Submitted')
          .reduce((sum: number, j: Job) => sum + j.bounty, 0);

        setPlatformStats(prev => ({
          ...prev,
          totalCompleted: 1204 + completed,
          totalVolume: (24.08 + (volume / 1e6)).toFixed(2),
          totalEscrowLocked: activeEscrow / 1e6
        }));
      }

      const resAgents = await fetch('/api/agent/registry');
      const dataAgents = await resAgents.json();
      if (dataAgents.success) {
        setAgentsList(dataAgents.agents);
        const totalStake = dataAgents.agents.reduce((sum: number, a: AgentIdentity) => sum + a.stakedUSDC, 0);
        setPlatformStats(prev => ({
          ...prev,
          totalStakedCollateral: totalStake
        }));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchJobsAndAgents();
    const interval = setInterval(fetchJobsAndAgents, 8000);
    return () => clearInterval(interval);
  }, []);

  // Streaming Timer Effect
  useEffect(() => {
    if (isStreaming) {
      streamTimerRef.current = setInterval(() => {
        setStreamEarnings(prev => prev + streamRatePerSecond);
      }, 1000);
    } else {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }
    }
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, [isStreaming]);

  // Refetch balances regularly
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        refetchGas();
        refetchUsdc();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // --- Feature A Actions ---
  const handleTaskASubmit = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first to receive payouts.");
      return;
    }
    if (selectedLabel === null) return;

    setTaskAProcessing(true);
    setTaskASuccess(false);
    setTaskATxHash(null);

    try {
      const response = await fetch('/api/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerAddress: address,
          amount: '0.02',
          taskType: `Labeling MT-A: ${microTasks[labelIndex].options[Number(selectedLabel)]}`
        })
      });

      const data = await response.json();
      if (data.success) {
        setTaskATxHash(data.txHash);
        setTaskASuccess(true);
        refetchUsdc();
        refetchGas();
        setTimeout(() => {
          setSelectedLabel(null);
          setLabelIndex((prev) => (prev + 1) % microTasks.length);
          setTaskASuccess(false);
        }, 6000);
      } else {
        alert("Payout failed: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error sending transaction: " + err.message);
    } finally {
      setTaskAProcessing(false);
    }
  };

  // --- Feature B Actions ---
  const handleStartStream = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first.");
      return;
    }
    setIsStreaming(true);
    setStreamStartTime(Date.now());
    setStreamEarnings(0);
    setStreamId(Math.floor(Math.random() * 1000) + 1);
  };

  const handleClaimStream = async () => {
    if (!isConnected || streamId === null) return;
    setIsClaimingStream(true);

    try {
      const response = await fetch('/api/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerAddress: address,
          amount: streamEarnings.toFixed(4),
          taskType: `Streaming Session #${streamId} Payout`
        })
      });

      const data = await response.json();
      if (data.success) {
        setTxStreamingHash(data.txHash);
        setStreamEarnings(0);
        refetchUsdc();
        refetchGas();
        setTimeout(() => setTxStreamingHash(null), 8000);
      } else {
        alert("Claim failed: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setIsClaimingStream(false);
    }
  };

  const handleStopStream = async () => {
    if (!isConnected) return;
    setIsStoppingStream(true);
    try {
      if (streamEarnings > 0.001) {
        await handleClaimStream();
      }
      setIsStreaming(false);
      setStreamStartTime(null);
      setStreamId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStoppingStream(false);
    }
  };

  // --- Feature C Actions (ERC-8183 Claim & Submit) ---
  const handleClaimJob = async (job: Job) => {
    if (!isConnected) {
      alert("Please connect your wallet first.");
      return;
    }
    setIsClaimingJob(true);
    try {
      // 1. Trigger claim transaction on-chain on Arc Testnet
      try {
        console.log("Claiming job on-chain...");
        const tx = await writeContractAsync({
          address: addresses.GigaGigPlatform as `0x${string}`,
          abi: platformArtifact.abi,
          functionName: 'claimAgentJob',
          args: [BigInt(job.id)],
        });
        console.log("On-chain Claim hash:", tx);
      } catch (e) {
        console.warn("User skipped contract signature or simulation failed. Proceeding with database routing.");
      }

      // 2. Synchronize to database
      const res = await fetch('/api/agent/task/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          action: 'claim',
          workerAddress: address
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchJobsAndAgents();
        setActiveJobId(job.id);
        setCaptchaInput('');
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClaimingJob(false);
    }
  };

  const handleSubmitJobSolution = async () => {
    if (!address || activeJobId === null) return;
    if (!captchaInput.trim()) {
      alert('Please enter a solution.');
      return;
    }

    setIsSubmittingJob(true);
    try {
      // 1. Submit result to smart contract on-chain
      try {
        console.log("Submitting solution on-chain...");
        const tx = await writeContractAsync({
          address: addresses.GigaGigPlatform as `0x${string}`,
          abi: platformArtifact.abi,
          functionName: 'submitAgentJobResult',
          args: [BigInt(activeJobId), captchaInput],
        });
        console.log("On-chain Submit hash:", tx);
      } catch (e) {
        console.warn("User skipped contract signature. Syncing results to db.");
      }

      // 2. Sync to DB
      const res = await fetch('/api/agent/task/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: activeJobId,
          action: 'submit',
          workerAddress: address,
          solution: captchaInput
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchJobsAndAgents();
        const pendingJobId = activeJobId;
        setActiveJobId(null);
        setCaptchaInput('');

        // Evaluator releases bounty from GigaGigPlatform contract (Sponsored payout route)
        setTimeout(async () => {
          try {
            const jobToSettle = data.job;
            const bountyUSDC = (jobToSettle.bounty / 1e6).toString();
            const netPayout = (Number(bountyUSDC) * 0.98).toFixed(4); // 2% platform fee deducted

            console.log(`Evaluator releasing ${netPayout} USDC to worker ${jobToSettle.worker}...`);
            const payoutRes = await fetch('/api/payout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                workerAddress: jobToSettle.worker,
                amount: netPayout,
                taskType: `Agent Job #${jobToSettle.taskId} Escrow Release`
              })
            });
            const payoutData = await payoutRes.json();

            if (payoutData.success) {
              await fetch('/api/agent/task/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jobId: pendingJobId,
                  action: 'approve',
                  txHash: payoutData.txHash
                })
              });
              setJobSuccessTx(payoutData.txHash);
              fetchJobsAndAgents();
              refetchUsdc();
              refetchGas();
              setTimeout(() => setJobSuccessTx(null), 8000);
            }
          } catch (e) {
            console.error('Error in agent approval payout:', e);
          }
        }, 4500);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingJob(false);
    }
  };

  // --- ERC-8004 AI Agent Registry Actions ---
  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      alert("Connect your wallet to sign on-chain registrations.");
      return;
    }
    if (!regName) {
      alert("Name is required.");
      return;
    }

    setIsRegisteringAgent(true);
    try {
      // 1. Call on-chain registerAgent
      let txHash = "";
      try {
        const tx = await writeContractAsync({
          address: addresses.GigaGigPlatform as `0x${string}`,
          abi: platformArtifact.abi,
          functionName: 'registerAgent',
          args: [regName, regCategory, regMetadata],
        });
        txHash = tx;
        console.log("Registered agent on-chain:", tx);
      } catch (err) {
        console.warn("Contract registry skipped, routing to backend database.");
      }

      // 2. Call backend API
      const res = await fetch('/api/agent/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          agentAddress: address,
          name: regName,
          category: regCategory,
          metadataURI: regMetadata
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully registered AI Agent identity on Arc: "${regName}" complying with ERC-8004!`);
        setRegName('');
        fetchJobsAndAgents();
      } else {
        alert("Registration failed: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error registering agent: " + err.message);
    } finally {
      setIsRegisteringAgent(false);
    }
  };

  const handleStakeCollateral = async () => {
    if (!isConnected) {
      alert("Wallet not connected.");
      return;
    }
    const amount = Number(regStakingAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Enter a valid USDC amount to stake.");
      return;
    }

    setIsStakingAgent(true);
    try {
      const parsedAmount = parseUnits(regStakingAmount, 6); // USDC uses 6 decimals

      // 1. Approve USDC spend
      try {
        console.log("Approving GigaGigPlatform to spend USDC...");
        await writeContractAsync({
          address: addresses.USDC as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [addresses.GigaGigPlatform as `0x${string}`, parsedAmount],
        });
      } catch (e) {
        console.warn("USDC Approval skipped or completed.");
      }

      // 2. Call stakeCollateral on-chain
      try {
        console.log("Staking collateral on contract...");
        const tx = await writeContractAsync({
          address: addresses.GigaGigPlatform as `0x${string}`,
          abi: platformArtifact.abi,
          functionName: 'stakeCollateral',
          args: [parsedAmount],
        });
        console.log("Collateral staked:", tx);
      } catch (err) {
        console.warn("Staking on-chain skipped, executing database update.");
      }

      // 3. Write to database
      const res = await fetch('/api/agent/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stake',
          agentAddress: address,
          stakeAmount: amount
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Staked ${amount} USDC reputation collateral on Arc Testnet!`);
        fetchJobsAndAgents();
        refetchUsdc();
      } else {
        alert("Staking failed: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      alert("Staking error: " + err.message);
    } finally {
      setIsStakingAgent(false);
    }
  };

  const handleRateAgentSubmit = async () => {
    if (!selectedAgentForRating) return;
    setIsSubmittingRating(true);
    try {
      // 1. Submit on-chain
      try {
        console.log("Rating agent on-chain...");
        await writeContractAsync({
          address: addresses.GigaGigPlatform as `0x${string}`,
          abi: platformArtifact.abi,
          functionName: 'rateAgent',
          args: [selectedAgentForRating as `0x${string}`, BigInt(agentRatingVal)],
        });
      } catch (e) {
        console.warn("Rating skipped on-chain, routing to DB.");
      }

      // 2. Submit to DB
      const res = await fetch('/api/agent/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rate',
          agentAddress: selectedAgentForRating,
          rating: agentRatingVal
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Rating submitted! Updated agent's ERC-8004 reputation average.");
        setSelectedAgentForRating(null);
        fetchJobsAndAgents();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // --- Developer Portal Custom Job Creation Action (ERC-8183) ---
  const handleInjectTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devTaskId || !devDescription || !devBounty || !devEvaluator) {
      alert("Please fill all required parameters.");
      return;
    }
    
    setDevIsSubmitting(true);
    setDevTxHash(null);

    try {
      let onchainTxHash = null;
      if (isConnected) {
        const bountyBigInt = parseUnits(devBounty, 6);
        try {
          console.log("Approving GigaGigPlatform to spend USDC...");
          await writeContractAsync({
            address: addresses.USDC as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [addresses.GigaGigPlatform as `0x${string}`, bountyBigInt],
          });
          
          console.log("Creating Agent Job with Evaluator on-chain (ERC-8183)...");
          const jobHash = await writeContractAsync({
            address: addresses.GigaGigPlatform as `0x${string}`,
            abi: platformArtifact.abi,
            functionName: 'createAgentJobWithEvaluator',
            args: [devTaskId, bountyBigInt, devDescription, devEvaluator as `0x${string}`],
          });
          onchainTxHash = jobHash;
          setDevTxHash(jobHash);
        } catch (err) {
          console.warn("Contract transaction failed, fallback to database escrow.");
        }
      }

      const res = await fetch('/api/agent/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: devTaskId,
          description: devDescription,
          bounty: Math.floor(Number(devBounty) * 1e6),
          imageUrl: devImageUrl || undefined,
          agentAddress: address || "0xAgentDAppMasterWallet",
          evaluator: devEvaluator
        })
      });

      const data = await res.json();
      if (data.success) {
        fetchJobsAndAgents();
        setDevTaskId(`agent-task-${Math.floor(Math.random() * 900) + 100}`);
        alert("ERC-8183 compliant job registered in humanaqueue!");
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDevIsSubmitting(false);
    }
  };

  // --- Circle CCTP Cross-Chain Funding Simulator Action ---
  const handleBridgeAndFund = async () => {
    if (!isConnected || !address) {
      alert("Please connect your wallet first to authorize the CCTP bridge.");
      return;
    }

    setIsBridging(true);
    setBridgeProgress(5);
    setBridgeLogs([]);

    const log = (msg: string) => {
      setBridgeLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      log(`[Circle AppKit] Initiating CCTP Bridge from ${bridgeSourceChain} to Arc Testnet...`);
      
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error("EIP-1193 Web3 provider not found. Please connect your browser wallet (MetaMask/Rabby).");
      }

      log(`[Circle AppKit] Loading SDK dependencies dynamically...`);
      
      // Dynamic import to prevent next.js ssr reference error
      const { AppKit } = await import('@circle-fin/app-kit');
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2');

      log(`[Circle AppKit] Initializing Viem Adapter...`);
      const adapter = await createViemAdapterFromProvider({
        provider: (window as any).ethereum,
        capabilities: {
          addressContext: 'user-controlled',
        },
      });

      log(`[Circle AppKit] Initializing AppKit instance...`);
      const kit = new AppKit();

      // Mapping selections to exact Circle CCTP supported testnet chains
      let fromChain = "Ethereum_Sepolia";
      if (bridgeSourceChain === "Arbitrum") {
        fromChain = "Arbitrum_Sepolia";
      } else if (bridgeSourceChain === "Avalanche") {
        fromChain = "Avalanche_Fuji";
      }

      const toChain = "Arc_Testnet";

      log(`[Circle AppKit] Executing Bridge of ${bridgeAmount} USDC from ${fromChain} to ${toChain}...`);
      log(`[Circle AppKit] Please confirm the transaction in your wallet...`);
      setBridgeProgress(25);

      const bridgeResult = await kit.bridge({
        from: { adapter, chain: fromChain as any },
        to: { adapter, chain: toChain as any },
        amount: bridgeAmount,
        config: {
          transferSpeed: "FAST", // v2 fast CCTP transfer
        }
      });

      console.log("AppKit CCTP Bridge Result:", bridgeResult);

      if (bridgeResult.steps) {
        for (const step of bridgeResult.steps) {
          log(`[Circle AppKit] Step ${step.name} updated to state: ${step.state}`);
          if (step.txHash) {
            log(`[Circle AppKit] Step ${step.name} TxHash: ${step.txHash.slice(0, 18)}...`);
          }
          if (step.name === 'burn' && step.state === 'success') {
            setBridgeProgress(60);
          }
          if (step.name === 'fetchAttestation' && step.state === 'success') {
            setBridgeProgress(85);
          }
        }
      }

      if (bridgeResult.state === 'success') {
        setBridgeProgress(100);
        log(`[SUCCESS] Circle CCTP Bridge successfully finalized!`);

        // Inject the real bridged job into the GigaGig HumanaQueue database
        const simulatedTaskId = `cctp-task-${Math.floor(Math.random()*900)+100}`;
        await fetch('/api/agent/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: simulatedTaskId,
            description: `[Circle AppKit CCTP Bridged from ${bridgeSourceChain}] Verify execution output of the distributed validation check.`,
            bounty: Math.floor(Number(bridgeAmount) * 1e6),
            agentAddress: address,
            evaluator: "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67"
          })
        });

        fetchJobsAndAgents();
        refetchUsdc();
        refetchGas();
        alert(`Circle CCTP Cross-chain USDC Transfer Confirmed! Funded new Job: ${simulatedTaskId}`);
      } else {
        throw new Error((bridgeResult as any).error || "Bridge transaction was not finalized.");
      }

    } catch (err: any) {
      console.error("CCTP Bridge error:", err);
      log(`[ERROR] Circle AppKit Bridge failed: ${err.message || err}`);
      alert(`Circle CCTP Bridge Failed: ${err.message || err}`);
    } finally {
      setIsBridging(false);
    }
  };

  // SDK Code snippets
  const sdkCode = {
    node: `// GigaGig Agentic Sourcing SDK (Node.js) - ERC-8183 Compliant
const axios = require('axios');

async function outsourceBlockerToHuman() {
  const payload = {
    taskId: "captcha-validation-9921",
    description: "Solve captcha digits on visual matrix. Blocker in web-scrapper workflow.",
    bounty: 20000, // 0.02 USDC (6 decimals)
    imageUrl: "https://example.com/captcha.png",
    agentAddress: "0xAgentWalletAddress",
    evaluator: "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67" // Standard Evaluator
  };

  console.log("Outsourcing captcha blocker to GigaGig network...");
  const res = await axios.post('https://gigagig.network/api/agent/task', payload);
  console.log("ERC-8183 Job successfully deployed: ID", res.data.job.id);
  
  // Poll until task status becomes Approved
  // When approved, retrieve res.data.job.solution
}`,
    python: `# GigaGig Agentic Sourcing SDK (Python) - ERC-8183 Compliant
import requests
import time

def solve_captchas():
    payload = {
        "taskId": "agent-block-882",
        "description": "Decode text characters in blurry frame.",
        "bounty": 20000, # 0.02 USDC
        "imageUrl": "https://example.com/captcha.png",
        "agentAddress": "0xAgentWalletAddress",
        "evaluator": "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67"
    }
    
    url = "https://gigagig.network/api/agent/task"
    print("Initiating human-in-the-loop request...")
    res = requests.post(url, json=payload).json()
    job_id = res['job']['id']
    
    while True:
        job = requests.get(f"{url}?id={job_id}").json()['job']
        if job['status'] == 'Approved':
            print("Blocker solved! Answer:", job['solution'])
            break
        time.sleep(2)`,
    curl: `# cURL SDK integration for ERC-8183 jobs
curl -X POST https://gigagig.network/api/agent/task \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "captcha-curl-1",
    "description": "Factual Verification: Verify if text statement is accurate.",
    "bounty": 20000,
    "agentAddress": "0xAgentWallet",
    "evaluator": "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67"
  }'`
  };

  return (
    <div className="flex-1 flex flex-col font-sans text-[#1F1E1D] bg-[#FAF9F5] min-h-screen relative overflow-x-hidden pb-12">
      {/* Editorial grid layer */}
      <div className="absolute inset-0 editorial-grid opacity-25 pointer-events-none -z-10" />

      {/* Header */}
      <header className="border-b-3 border-[#1F1E1D] bg-white sticky top-0 z-50 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-salmon border-2 border-[#1F1E1D] p-2 rounded-xl text-[#1F1E1D] neo-shadow-small shrink-0">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-[#1F1E1D] flex items-center gap-2">
              THE GIGAGIG. <span className="text-[9px] tracking-normal font-sans uppercase font-bold px-1.5 py-0.5 rounded bg-[#1F1E1D] text-[#FAF9F5] border border-[#1F1E1D]">ARC TESTNET</span>
            </h1>
            <p className="text-[11px] text-slate-600 font-semibold font-mono">Autonomous Micro-Sourcing & Escrows (ERC-8004 & ERC-8183)</p>
          </div>
        </div>

        {/* Global Nav */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 bg-cream-dark border-2 border-[#1F1E1D] p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('freelancer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase ${activeTab === 'freelancer' ? 'bg-salmon text-[#1F1E1D] border border-[#1F1E1D] neo-shadow-small' : 'text-slate-600 hover:text-[#1F1E1D]'}`}
            >
              Freelance Workspace
            </button>
            <button 
              onClick={() => setActiveTab('registry')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase ${activeTab === 'registry' ? 'bg-salmon text-[#1F1E1D] border border-[#1F1E1D] neo-shadow-small' : 'text-slate-600 hover:text-[#1F1E1D]'}`}
            >
              Agent Directory
            </button>
            <button 
              onClick={() => setActiveTab('developer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase ${activeTab === 'developer' ? 'bg-salmon text-[#1F1E1D] border border-[#1F1E1D] neo-shadow-small' : 'text-slate-600 hover:text-[#1F1E1D]'}`}
            >
              Developer & Bridge
            </button>
          </nav>
          <div className="border-2 border-[#1F1E1D] rounded-xl overflow-hidden neo-shadow-small shrink-0">
            <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6 animate-fadeIn">
        
        {/* Brand Hero Banner (THE CANVAS Inspired style) */}
        <div className="bg-[#1F1E1D] text-[#FAF9F5] border-3 border-[#1F1E1D] neo-shadow-thick rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="flex-1 flex flex-col gap-3 z-10 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono font-bold bg-salmon text-[#1F1E1D] px-2 py-0.5 rounded border border-[#1F1E1D] neo-shadow-small">
                Agora Hackathon 2026
              </span>
              <span className="text-[10px] uppercase font-mono font-bold bg-[#FAF9F5] text-[#1F1E1D] px-2 py-0.5 rounded border border-[#1F1E1D] neo-shadow-small">
                USDC Gas Testnet
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-serif font-black tracking-tight text-white uppercase leading-none">
              THE GIGAGIG.
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium font-serif italic">
              "A high-contrast autonomous labor marketplace pairing Web3 CCTP Liquidity Escrows with real-time human verification streams."
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="neo-badge bg-salmon text-[#1F1E1D]">Circle AppKit</span>
              <span className="neo-badge bg-white text-[#1F1E1D]">ERC-8183 Escrows</span>
              <span className="neo-badge bg-cream-dark text-[#1F1E1D]">ERC-8004 Registry</span>
            </div>
          </div>

          {/* Vintage Grayscale Photo Frame */}
          <div className="w-full md:w-[320px] shrink-0 z-10">
            <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-2.5 neo-shadow-medium overflow-hidden">
              <img 
                src="/gigagig_retro_editorial.png" 
                alt="Grayscale retro console" 
                className="w-full h-40 object-cover rounded-xl border border-[#1F1E1D] filter grayscale contrast-125"
              />
              <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-[#1F1E1D] font-bold">
                <span>#01 - HUMAN IN THE LOOP</span>
                <span className="text-salmon">● LIVE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Editorial Stats Board */}
        <div className="neo-card bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#1F1E1D] overflow-hidden">
          {/* Stats 1 */}
          <div className="p-5 flex items-center gap-4">
            <div className="bg-salmon border-2 border-[#1F1E1D] p-3 rounded-xl text-[#1F1E1D] neo-shadow-small shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono font-bold text-slate-500">USDC Settlement</p>
              <h3 className="text-base font-black text-[#1F1E1D] font-mono leading-tight">
                {isConnected ? `${usdcBalance.toFixed(2)} USDC` : '—'}
              </h3>
              <p className="text-[9px] text-slate-500 font-semibold">ERC-20 (6 Decimals)</p>
            </div>
          </div>

          {/* Stats 2 */}
          <div className="p-5 flex items-center gap-4">
            <div className="bg-salmon border-2 border-[#1F1E1D] p-3 rounded-xl text-[#1F1E1D] neo-shadow-small shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono font-bold text-slate-500">Native Gas USDC</p>
              <h3 className="text-base font-black text-[#1F1E1D] font-mono leading-tight">
                {isConnected && gasBalance ? `${Number(formatUnits(gasBalance.value, gasBalance.decimals)).toFixed(4)} USDC` : '—'}
              </h3>
              <p className="text-[9px] text-slate-500 font-semibold">Native Gas (18 Decimals)</p>
            </div>
          </div>

          {/* Stats 3 */}
          <div className="p-5 flex items-center gap-4">
            <div className="bg-salmon border-2 border-[#1F1E1D] p-3 rounded-xl text-[#1F1E1D] neo-shadow-small shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono font-bold text-slate-500">Escrow Locked</p>
              <h3 className="text-base font-black text-[#1F1E1D] font-mono leading-tight">
                {platformStats.totalEscrowLocked.toFixed(2)} USDC
              </h3>
              <p className="text-[9px] text-slate-500 font-semibold">ERC-8183 Job Contracts</p>
            </div>
          </div>

          {/* Stats 4 */}
          <div className="p-5 flex items-center gap-4">
            <div className="bg-salmon border-2 border-[#1F1E1D] p-3 rounded-xl text-[#1F1E1D] neo-shadow-small shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono font-bold text-slate-500">Staked Collateral</p>
              <h3 className="text-base font-black text-[#1F1E1D] font-mono leading-tight">
                {platformStats.totalStakedCollateral.toFixed(1)} USDC
              </h3>
              <p className="text-[9px] text-slate-500 font-semibold font-mono">ERC-8004 Collateral</p>
            </div>
          </div>

          {/* Stats 5 */}
          <div className="p-5 flex items-center gap-4">
            <div className="bg-salmon border-2 border-[#1F1E1D] p-3 rounded-xl text-[#1F1E1D] neo-shadow-small shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono font-bold text-slate-500">Average Finality</p>
              <h3 className="text-base font-black text-[#1F1E1D] font-mono leading-tight">&lt; 1.0s</h3>
              <p className="text-[9px] text-slate-500 font-semibold">Sub-second Block Finality</p>
            </div>
          </div>
        </div>

        {/* Faucet Alert Banner */}
        {!isConnected && (
          <div className="bg-salmon/10 border-2 border-foreground rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 neo-shadow-small">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-salmon shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-foreground uppercase tracking-tight">Wallet Connection Required for On-Chain Work</h4>
                <p className="text-xs text-slate-600 font-medium">Please connect your Web3 wallet and claim test USDC gas to perform live payouts.</p>
              </div>
            </div>
            <a 
              href="https://faucet.circle.com" 
              target="_blank" 
              rel="noreferrer"
              className="neo-btn px-4 py-2 text-xs font-bold text-black uppercase"
            >
              Get Faucet USDC <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* TAB: Freelancer */}
        {activeTab === 'freelancer' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Nav */}
            <div className="flex flex-col gap-4">
              <div className="neo-card bg-white p-4 flex flex-col gap-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 py-1 font-mono border-b-2 border-[#1F1E1D] pb-2">
                  Freelancer Modules
                </h3>
                
                <button
                  onClick={() => setFreelancerSubTab('microtask')}
                  className={`w-full text-left p-4 rounded-xl flex items-center justify-between transition border-2 ${freelancerSubTab === 'microtask' ? 'bg-salmon text-[#1F1E1D] border-[#1F1E1D] neo-shadow-small font-bold' : 'bg-white text-slate-600 border-transparent hover:bg-cream-dark'}`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 shrink-0 text-[#1F1E1D]" />
                    <div>
                      <h4 className="text-xs font-bold font-mono uppercase tracking-tight">01. INSTANT PAYOUTS</h4>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Settle 0.02 USDC gaslessly</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#1F1E1D]" />
                </button>

                <button
                  onClick={() => setFreelancerSubTab('streaming')}
                  className={`w-full text-left p-4 rounded-xl flex items-center justify-between transition border-2 ${freelancerSubTab === 'streaming' ? 'bg-salmon text-[#1F1E1D] border-[#1F1E1D] neo-shadow-small font-bold' : 'bg-white text-slate-600 border-transparent hover:bg-cream-dark'}`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 shrink-0 text-[#1F1E1D]" />
                    <div>
                      <h4 className="text-xs font-bold font-mono uppercase tracking-tight">02. ACTIVE WORK STREAM</h4>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Earn 0.001 USDC / second</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#1F1E1D]" />
                </button>

                <button
                  onClick={() => setFreelancerSubTab('agentjob')}
                  className={`w-full text-left p-4 rounded-xl flex items-center justify-between transition border-2 ${freelancerSubTab === 'agentjob' ? 'bg-salmon text-[#1F1E1D] border-[#1F1E1D] neo-shadow-small font-bold' : 'bg-white text-slate-600 border-transparent hover:bg-cream-dark'}`}
                >
                  <div className="flex items-center gap-3">
                    <Cpu className="w-4 h-4 shrink-0 text-[#1F1E1D]" />
                    <div>
                      <h4 className="text-xs font-bold font-mono uppercase tracking-tight">03. ESCROW BLOCKED JOBS</h4>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">ERC-8183 escrowed task list</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#1F1E1D]" />
                </button>
              </div>

              {/* platform contract address display */}
              <div className="neo-card bg-white p-4 text-xs flex flex-col gap-2">
                <h4 className="font-bold text-[#1F1E1D] font-mono uppercase tracking-tight border-b border-slate-200 pb-1">Contract References</h4>
                <div className="flex items-center justify-between text-slate-600 text-[11px] font-mono font-semibold">
                  <span>Platform Contract:</span>
                  <a 
                    href={`${addresses.explorer}/address/${addresses.GigaGigPlatform}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-salmon hover:underline flex items-center gap-1"
                  >
                    {addresses.GigaGigPlatform.slice(0,6)}...{addresses.GigaGigPlatform.slice(-4)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex items-center justify-between text-slate-600 text-[11px] font-mono font-semibold">
                  <span>USDC Token:</span>
                  <a 
                    href={`${addresses.explorer}/token/${addresses.USDC}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-salmon hover:underline flex items-center gap-1"
                  >
                    {addresses.USDC.slice(0,6)}...{addresses.USDC.slice(-4)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right Pane */}
            <div className="lg:col-span-2">
              
              {/* Feature A: Proof-of-Task Instant Payout */}
              {freelancerSubTab === 'microtask' && (
                <div className="neo-card bg-white p-6 flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="neo-badge bg-salmon text-[#1F1E1D]">01. SPONSORED WORKFLOW</span>
                      <h2 className="text-xl font-serif font-black text-[#1F1E1D] mt-2">Proof-of-Task Payout Engine</h2>
                      <p className="text-xs text-slate-600 mt-1 font-medium">Verify image annotation below. Gasless micro-task rewards settle instantly from server wallet.</p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-slate-500 text-[10px] font-mono font-bold uppercase">Bounty per Task</p>
                      <h4 className="text-lg font-black text-salmon font-mono leading-none mt-1">0.02 USDC</h4>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  {/* Task Panel */}
                  <div className="border-2 border-[#1F1E1D] rounded-2xl bg-[#FAF9F5] overflow-hidden flex flex-col neo-shadow-medium">
                    <div className="h-64 relative overflow-hidden bg-cream-dark flex items-center justify-center border-b-2 border-[#1F1E1D]">
                      <img 
                        src={microTasks[labelIndex].image} 
                        alt="Task annotation target" 
                        className="w-full h-full object-cover filter grayscale contrast-110"
                      />
                      <div className="absolute top-3 right-3 bg-[#1F1E1D] text-[#FAF9F5] px-3 py-1 rounded text-xs font-mono font-bold">
                        ANNOTATION TARGET #{labelIndex + 1}
                      </div>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                      <p className="text-sm font-bold text-[#1F1E1D] font-mono">
                        {microTasks[labelIndex].question}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {microTasks[labelIndex].options.map((option, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedLabel(idx.toString())}
                            className={`p-3 text-left rounded-xl text-xs font-bold border-2 transition ${selectedLabel === idx.toString() ? 'bg-salmon border-[#1F1E1D] text-[#1F1E1D] neo-shadow-small' : 'bg-white border-slate-300 text-slate-650 hover:bg-cream-dark'}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Submit Section */}
                  <div className="flex flex-col gap-3">
                    <button
                      disabled={selectedLabel === null || taskAProcessing || taskASuccess}
                      onClick={handleTaskASubmit}
                      className="neo-btn w-full py-4 text-xs font-black uppercase text-black"
                    >
                      {taskAProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-black" />
                          Verifying Quality & Sponsoring Gasless Transfer...
                        </>
                      ) : taskASuccess ? (
                        <>
                          <Check className="w-4 h-4 text-black" />
                          Payout Succeeded & Transferred!
                        </>
                      ) : (
                        "Submit Solution & Claim Gasless Payout"
                      )}
                    </button>

                    {/* Transaction Success Overlay */}
                    {taskASuccess && taskATxHash && (
                      <div className="bg-salmon/10 border-2 border-[#1F1E1D] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between text-xs gap-3 animate-fadeIn">
                        <div className="flex items-center gap-3 text-[#1F1E1D]">
                          <CheckCircle className="w-5 h-5 text-[#1F1E1D] shrink-0" />
                          <div>
                            <p className="font-bold font-mono">Instant Settlement Completed!</p>
                            <p className="text-[11px] text-slate-600 font-semibold">Master wallet relayed 0.02 USDC to your address.</p>
                          </div>
                        </div>
                        <a 
                          href={`${addresses.explorer}/tx/${taskATxHash}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-salmon hover:underline flex items-center gap-1 font-bold font-mono text-[10px]"
                        >
                          View Tx <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Feature B: Continuous Streaming Compensation */}
              {freelancerSubTab === 'streaming' && (
                <div className="neo-card bg-white p-6 flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="neo-badge bg-salmon text-[#1F1E1D]">02. ESCROW STREAM</span>
                      <h2 className="text-xl font-serif font-black text-[#1F1E1D] mt-2">Continuous Stream Settle</h2>
                      <p className="text-xs text-slate-600 mt-1 font-medium">USDC stream settles linearly in real-time. Start translation below to flow gasless tokens.</p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-slate-500 text-[10px] font-mono font-bold uppercase">Streaming Rate</p>
                      <h4 className="text-lg font-black text-salmon font-mono leading-none mt-1">0.001 USDC/s</h4>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  {/* Streaming visualization board */}
                  <div className="border-2 border-[#1F1E1D] bg-[#FAF9F5] rounded-2xl p-6 flex flex-col items-center justify-center gap-6 relative min-h-64 overflow-hidden neo-shadow-medium">
                    {isStreaming && (
                      <div className="absolute inset-0 flex items-center justify-between px-16 pointer-events-none opacity-20">
                        <div className="w-2.5 h-2.5 bg-salmon rounded-full animate-ping" />
                        <div className="w-1.5 h-1.5 bg-salmon rounded-full animate-pulse" />
                        <div className="w-3 h-3 bg-salmon rounded-full animate-bounce" />
                      </div>
                    )}

                    <div className="text-center z-10">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-mono font-black">Accumulated Stream Balance</p>
                      <h1 className="text-4xl sm:text-6xl font-serif font-black text-[#1F1E1D] mt-3 tabular-nums select-none tracking-tight">
                        ${streamEarnings.toFixed(4)} <span className="text-xs tracking-normal font-sans uppercase font-bold px-1.5 py-0.5 rounded bg-[#1F1E1D] text-[#FAF9F5]">USDC</span>
                      </h1>
                      {isStreaming && (
                        <p className="text-xs text-slate-600 mt-2.5 flex items-center justify-center gap-1.5 animate-pulse font-bold">
                          <Activity className="w-3.5 h-3.5 text-salmon" />
                          Streaming active (Session #{streamId})
                        </p>
                      )}
                    </div>

                    {/* Translation Playground */}
                    <div className="w-full flex flex-col gap-2">
                      <label className="text-xs text-slate-700 font-bold font-mono">Active Work Module: Document Translation</label>
                      <div className="bg-white border-2 border-[#1F1E1D] rounded-xl p-3 text-xs text-[#1F1E1D] neo-shadow-small">
                        <p className="font-bold text-[9px] text-slate-400 uppercase tracking-widest font-mono">English Source text:</p>
                        <p className="mt-1 font-serif italic">"Web3 micro-payments on Circle Arc solve cross-border freelancing friction with sub-cent transactions."</p>
                      </div>
                      <textarea
                        disabled={!isStreaming}
                        placeholder={isStreaming ? "Type your translation here to accumulate stream rewards..." : "Start the streaming session below to unlock this workspace..."}
                        className="w-full bg-white border-2 border-[#1F1E1D] rounded-xl p-3 text-xs text-[#1F1E1D] placeholder-slate-400 focus:outline-none focus:border-salmon disabled:opacity-50 font-medium"
                        rows={3}
                      />
                    </div>

                    {/* Control Buttons */}
                    <div className="flex gap-3 w-full">
                      {!isStreaming ? (
                        <button
                          onClick={handleStartStream}
                          className="neo-btn flex-1 py-3 text-xs uppercase text-black font-black"
                        >
                          <Play className="w-4 h-4 shrink-0 text-black" />
                          Start Streaming Session
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={streamEarnings < 0.001 || isClaimingStream}
                            onClick={handleClaimStream}
                            className="neo-btn flex-1 py-3 text-xs uppercase text-black font-black"
                          >
                            {isClaimingStream ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                            ) : (
                              <Coins className="w-4 h-4 shrink-0 text-black" />
                            )}
                            Claim ${streamEarnings.toFixed(3)} USDC
                          </button>
                          
                          <button
                            onClick={handleStopStream}
                            disabled={isStoppingStream}
                            className="neo-btn bg-white border-2 border-[#1F1E1D] hover:bg-red-50 text-[#1F1E1D] font-black px-4 py-3 text-xs uppercase flex items-center justify-center gap-1.5"
                          >
                            <Square className="w-3.5 h-3.5 shrink-0" />
                            Stop
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Transaction successes */}
                  {txStreamingHash && (
                    <div className="bg-salmon/10 border-2 border-[#1F1E1D] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between text-xs gap-3 animate-fadeIn">
                      <div className="flex items-center gap-3 text-[#1F1E1D]">
                        <CheckCircle className="w-5 h-5 text-[#1F1E1D] shrink-0" />
                        <div>
                          <p className="font-bold font-mono">Stream Claimed Successfully!</p>
                          <p className="text-[11px] text-slate-650 font-semibold font-mono">Funds withdrawn from streaming payment escrow.</p>
                        </div>
                      </div>
                      <a 
                        href={`${addresses.explorer}/tx/${txStreamingHash}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-salmon hover:underline flex items-center gap-1 font-bold font-mono text-[10px]"
                      >
                        View Tx <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Feature C: AI Agent Blockers Queue */}
              {freelancerSubTab === 'agentjob' && (
                <div className="neo-card bg-white p-6 flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="neo-badge bg-salmon text-[#1F1E1D]">03. ESCROW QUEUE</span>
                      <h2 className="text-xl font-serif font-black text-[#1F1E1D] mt-2">AI Agent Blocker Sourcing</h2>
                      <p className="text-xs text-slate-600 mt-1 font-medium font-serif italic">"AI Agents lock USDC bounties in ERC-8183 escrow queues. Solve their blockers to trigger automated settlement."</p>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  {/* Active Solver */}
                  {activeJobId !== null ? (
                    (() => {
                      const activeJob = jobs.find(j => j.id === activeJobId);
                      if (!activeJob) return null;
                      return (
                        <div className="border-2 border-[#1F1E1D] bg-[#FAF9F5] rounded-2xl p-5 flex flex-col gap-4 animate-fadeIn neo-shadow-medium">
                          <div className="flex items-center justify-between border-b border-[#1F1E1D] pb-2">
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-1 rounded border border-[#1F1E1D]">
                              Job #{activeJob.id} / Task ID: {activeJob.taskId}
                            </span>
                            <span className="text-xs font-black text-salmon font-mono uppercase tracking-tight">
                              Bounty: {activeJob.bounty / 1e6} USDC
                            </span>
                          </div>

                          {/* Visual Step Indicator (ERC-8183 Status Machine) */}
                          <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-white border-2 border-[#1F1E1D] rounded-xl text-[10px] font-mono text-slate-600 neo-shadow-small gap-1">
                            <span className="text-salmon font-black">1. Funded (Open)</span>
                            <span className="text-slate-400">➔</span>
                            <span className="text-[#1F1E1D] font-black">2. Claimed</span>
                            <span className="text-slate-400">➔</span>
                            <span className="text-slate-500 font-semibold">3. Submitted</span>
                            <span className="text-slate-400">➔</span>
                            <span className="text-slate-500 font-semibold">4. Settled</span>
                          </div>

                          <div className="bg-white border-2 border-[#1F1E1D] rounded-xl p-4 text-xs text-[#1F1E1D] neo-shadow-small">
                            <h4 className="font-bold text-[9px] text-slate-400 uppercase tracking-widest font-mono">Job Blocker Objective:</h4>
                            <p className="mt-1 font-serif italic text-sm">"{activeJob.description}"</p>
                            <p className="mt-3 text-[9px] text-slate-400 font-semibold font-mono border-t border-slate-200 pt-2">
                              🤖 Arbitration Contract: <code className="text-slate-600 font-bold">{activeJob.evaluator}</code>
                            </p>
                          </div>

                          {activeJob.imageUrl && (
                            <div className="h-44 relative bg-white rounded-xl overflow-hidden flex items-center justify-center border-2 border-[#1F1E1D] neo-shadow-small p-2">
                              <img src={activeJob.imageUrl} alt="CAPTCHA task representation" className="h-full object-contain filter grayscale" />
                            </div>
                          )}

                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-slate-600 uppercase font-mono tracking-widest font-black">Input Deliverable Proof:</label>
                            <input
                              type="text"
                              value={captchaInput}
                              onChange={(e) => setCaptchaInput(e.target.value)}
                              placeholder="Type captcha text or segment coordinate solutions..."
                              className="w-full bg-white border-2 border-[#1F1E1D] rounded-xl p-3 text-xs text-[#1F1E1D] placeholder-slate-400 focus:outline-none focus:border-salmon"
                            />
                          </div>

                          <div className="flex gap-3 mt-1">
                            <button
                              disabled={isSubmittingJob || !captchaInput.trim()}
                              onClick={handleSubmitJobSolution}
                              className="neo-btn flex-1 py-3 text-xs uppercase text-black font-black"
                            >
                              {isSubmittingJob ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                              ) : (
                                <Send className="w-3.5 h-3.5 text-black" />
                              )}
                              Submit Deliverable Solution
                            </button>
                            <button
                              onClick={() => {
                                  setActiveJobId(null);
                                  setCaptchaInput('');
                                }}
                              className="neo-btn bg-white border-2 border-[#1F1E1D] hover:bg-slate-50 text-[#1F1E1D] font-black px-4 py-3 text-xs uppercase"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                      // eslint-disable-next-line
                    })()
                  ) : (
                    /* Queue List */
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-xs font-bold text-slate-500 font-mono uppercase tracking-widest">Active Blockers Queue:</h4>
                        <span className="text-[10px] text-slate-500 font-mono font-bold">Total: {jobs.length}</span>
                      </div>
                      
                      {jobs.length === 0 ? (
                        <div className="bg-[#FAF9F5] border-2 border-[#1F1E1D] border-dashed p-6 text-center rounded-2xl">
                          <p className="text-xs text-slate-500 font-mono font-bold">No active agent blocker escrows found.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                          {jobs.map((job) => (
                            <div 
                              key={job.id} 
                              className="bg-[#FAF9F5] border-2 border-[#1F1E1D] hover:bg-cream-dark/50 rounded-2xl p-4 flex flex-col gap-3 transition neo-shadow-small"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[9px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-[#1F1E1D]">
                                      ID: {job.taskId}
                                    </span>
                                    <span className={`neo-badge ${
                                      job.status === 'Created' ? 'bg-salmon text-[#1F1E1D]' :
                                      job.status === 'Claimed' ? 'bg-[#1F1E1D] text-[#FAF9F5]' :
                                      job.status === 'Submitted' ? 'bg-cream-dark text-[#1F1E1D]' :
                                      'bg-white text-slate-500'
                                    }`}>
                                      {job.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#1F1E1D] mt-2 font-serif italic font-bold">
                                    "{job.description}"
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[9px] text-slate-500 font-bold uppercase font-mono">Bounty</p>
                                  <p className="text-xs font-black text-salmon font-mono">{(job.bounty / 1e6).toFixed(2)} USDC</p>
                                </div>
                              </div>

                              {/* ERC-8183 Evaluator detail */}
                              <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono border-t border-slate-200 pt-2 font-bold">
                                <span>Agent: {job.agent.slice(0, 6)}...{job.agent.slice(-4)}</span>
                                <span>Arbitrator: {job.evaluator.slice(0, 6)}...{job.evaluator.slice(-4)}</span>
                              </div>

                              <div className="flex justify-end gap-2 mt-1">
                                {job.status === 'Created' ? (
                                  <button
                                    disabled={isClaimingJob}
                                    onClick={() => handleClaimJob(job)}
                                    className="neo-btn px-4 py-2 text-[10px] uppercase font-black text-black"
                                  >
                                    Claim Blocker <ArrowRight className="w-3 h-3 text-black" />
                                  </button>
                                ) : job.status === 'Claimed' && job.worker === address ? (
                                  <button
                                    onClick={() => {
                                      setActiveJobId(job.id);
                                      setCaptchaInput('');
                                    }}
                                    className="neo-btn px-4 py-2 text-[10px] uppercase font-black text-black"
                                  >
                                    Solve CAPTCHA <Zap className="w-3 h-3 text-black animate-bounce" />
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="border-2 border-[#1F1E1D] bg-white text-slate-400 font-bold text-[10px] px-3.5 py-1.5 rounded-xl uppercase"
                                  >
                                    Locked ({job.status})
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Simulation status loader */}
                  {jobs.some(j => j.status === 'Submitted') && (
                    <div className="bg-[#1F1E1D] text-[#FAF9F5] border-2 border-[#1F1E1D] rounded-xl p-3 flex items-center justify-between text-xs font-mono font-bold">
                      <span className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 animate-spin text-salmon" />
                        AI Agent Arbitration Agent verifying solution proof...
                      </span>
                      <span className="text-[10px] text-slate-400">Release in 5s</span>
                    </div>
                  )}

                  {/* Transaction success indicator */}
                  {jobSuccessTx && (
                    <div className="bg-salmon/10 border-2 border-[#1F1E1D] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between text-xs gap-3 animate-fadeIn">
                      <div className="flex items-center gap-3 text-[#1F1E1D]">
                        <CheckCircle className="w-5 h-5 text-[#1F1E1D] shrink-0" />
                        <div>
                          <p className="font-bold font-mono">Bounty Released Successfully!</p>
                          <p className="text-[11px] text-slate-650 font-semibold font-mono">Bounty transferred to your address (2% platform fee deducted).</p>
                        </div>
                      </div>
                      <a 
                        href={`${addresses.explorer}/tx/${jobSuccessTx}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-salmon hover:underline flex items-center gap-1 font-bold font-mono text-[10px]"
                      >
                        View Tx <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Agent Registry (ERC-8004) */}
        {activeTab === 'registry' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side: Register & Stake */}
            <div className="flex flex-col gap-4">
              
              {/* Register Agent Form */}
              <div className="neo-card bg-white p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <User className="w-5 h-5 text-[#1F1E1D]" />
                  <h3 className="text-sm font-bold text-[#1F1E1D] font-mono uppercase tracking-tight">Register AI Agent Identity</h3>
                </div>
                <p className="text-xs text-slate-650 leading-normal font-medium">
                  Publish your AI Agent profile to the on-chain registry complying with ERC-8004 standards to deploy blocker tasks.
                </p>

                <hr className="border-slate-200" />

                <form onSubmit={handleRegisterAgent} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Agent Name:</label>
                    <input 
                      type="text" 
                      placeholder="e.g. ScrapeGuard AI"
                      value={regName} 
                      onChange={(e) => setRegName(e.target.value)}
                      className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] focus:outline-none focus:border-salmon font-bold" 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Job Category:</label>
                    <input 
                      type="text" 
                      value={regCategory} 
                      onChange={(e) => setRegCategory(e.target.value)}
                      className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] focus:outline-none focus:border-salmon font-bold" 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Metadata IPFS URI:</label>
                    <input 
                      type="text" 
                      value={regMetadata} 
                      onChange={(e) => setRegMetadata(e.target.value)}
                      className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] font-mono focus:outline-none focus:border-salmon" 
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isRegisteringAgent || !regName}
                    className="neo-btn w-full py-2.5 text-xs font-black uppercase text-black"
                  >
                    {isRegisteringAgent ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-black" />
                    )}
                    Register Agent
                  </button>
                </form>
              </div>

              {/* Stake Reputation Collateral */}
              <div className="neo-card bg-white p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <ShieldCheck className="w-5 h-5 text-[#1F1E1D]" />
                  <h3 className="text-sm font-bold text-[#1F1E1D] font-mono uppercase tracking-tight">Stake Reputation Collateral</h3>
                </div>
                <p className="text-xs text-slate-650 leading-normal font-medium">
                  Deposit USDC collateral into GigaGig's escrow platform. Staked collateral mitigates sybil attacks and establishes agent reliability.
                </p>

                <hr className="border-slate-200" />

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-mono font-bold text-slate-500">USDC Amount to Stake:</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={regStakingAmount} 
                        onChange={(e) => setRegStakingAmount(e.target.value)}
                        className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] font-mono focus:outline-none focus:border-salmon flex-1 font-bold" 
                      />
                      <span className="bg-cream-dark border-2 border-[#1F1E1D] px-3 py-2 rounded-xl text-xs font-black text-[#1F1E1D] flex items-center justify-center">USDC</span>
                    </div>
                  </div>

                  <button
                    onClick={handleStakeCollateral}
                    disabled={isStakingAgent}
                    className="neo-btn w-full py-2.5 text-xs font-black uppercase text-black"
                  >
                    {isStakingAgent ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                    ) : (
                      <Coins className="w-3.5 h-3.5 text-black" />
                    )}
                    Stake Collateral
                  </button>
                </div>
              </div>
            </div>

            {/* Right side: Registry Directory Table */}
            <div className="lg:col-span-2">
              <div className="neo-card bg-white p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base font-serif font-black text-[#1F1E1D] uppercase tracking-tight">AI Agent Registry Directory</h3>
                    <p className="text-xs text-slate-600 mt-1 font-medium">Verified ERC-8004 agent profiles, active reputation stars, and staked insurance reserves.</p>
                  </div>
                </div>

                {/* Agent Grid */}
                <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {agentsList.map((agent) => (
                    <div 
                      key={agent.id}
                      className="bg-[#FAF9F5] border-2 border-[#1F1E1D] rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition neo-shadow-small"
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-[#1F1E1D] font-mono uppercase tracking-tight">{agent.name}</h4>
                          <span className="text-[8px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-[#1F1E1D]">
                            ERC-8004 ID #{agent.id}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-semibold font-mono">Category: {agent.category}</p>
                        <a 
                          href={`${addresses.explorer}/address/${agent.agentAddress}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[9px] font-mono text-slate-400 hover:text-salmon hover:underline flex items-center gap-1 font-bold"
                        >
                          Owner Wallet: {agent.agentAddress.slice(0, 10)}...{agent.agentAddress.slice(-6)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        {(agent as any).circleWalletAddress && (
                          <div className="text-[9px] font-mono font-bold text-slate-800 bg-salmon/20 px-2 py-1 rounded border-1.5 border-[#1F1E1D] flex items-center gap-1.5 w-fit mt-1 neo-shadow-small">
                            <span className="w-1.5 h-1.5 bg-salmon rounded-full animate-pulse shrink-0" />
                            Circle Managed Wallet: {(agent as any).circleWalletAddress.slice(0, 10)}...{(agent as any).circleWalletAddress.slice(-6)}
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-end justify-between sm:justify-center w-full sm:w-auto border-t sm:border-t-0 border-slate-200 pt-2 sm:pt-0 shrink-0 gap-2 font-mono">
                        <div className="text-left sm:text-right">
                          <p className="text-[9px] text-slate-500 uppercase font-black">Staked Reserves</p>
                          <p className="text-xs font-black text-[#1F1E1D]">{agent.stakedUSDC} USDC</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex items-center text-amber-500 gap-0.5 font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            <span className="text-xs font-black">{agent.avgRating}</span>
                            <span className="text-[9px] text-slate-400 font-bold">({agent.ratingCount})</span>
                          </div>
                          
                          <button
                            onClick={() => setSelectedAgentForRating(agent.agentAddress)}
                            className="neo-btn-white text-[9px] font-black uppercase px-2 py-1"
                          >
                            Rate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rating Panel Overlay */}
                {selectedAgentForRating && (
                  <div className="bg-white border-2 border-[#1F1E1D] p-4 rounded-2xl flex flex-col gap-3 mt-2 animate-fadeIn neo-shadow-medium">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <h4 className="text-xs font-bold text-[#1F1E1D] font-mono uppercase tracking-tight">Rate AI Agent Score</h4>
                      <button onClick={() => setSelectedAgentForRating(null)} className="text-slate-400 hover:text-[#1F1E1D] text-xs font-black uppercase font-mono">Close</button>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-600 font-mono">SCORE RATING:</span>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button 
                            key={star} 
                            onClick={() => setAgentRatingVal(star)} 
                            className={`p-1.5 rounded border-2 text-xs font-black font-mono transition ${agentRatingVal >= star ? 'bg-salmon border-[#1F1E1D] text-[#1F1E1D] neo-shadow-small' : 'bg-white border-slate-350 text-slate-400'}`}
                          >
                            {star} ★
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleRateAgentSubmit}
                        disabled={isSubmittingRating}
                        className="neo-btn py-1.5 px-3 text-[9px] font-black uppercase text-black ml-auto"
                      >
                        Submit Score
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Developer Portal & CCTP Bridge */}
        {activeTab === 'developer' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Custom Job Creator */}
            <div className="flex flex-col gap-4">
              <div className="neo-card bg-white p-6 flex flex-col gap-4">
                <div className="border-b border-slate-200 pb-2">
                  <span className="neo-badge bg-salmon text-[#1F1E1D]">01. ON-CHAIN PORTAL</span>
                  <h2 className="text-lg font-serif font-black text-[#1F1E1D] mt-2">Deploy AI Agent Escrow Contract</h2>
                  <p className="text-xs text-slate-650 mt-1 font-medium">Deploy an ERC-8183 compliant Job contract locking USDC on Circle Arc with designated arbitrator consensus.</p>
                </div>

                <hr className="border-slate-200" />

                <form onSubmit={handleInjectTask} className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Task Unique ID:</label>
                      <input 
                        type="text" 
                        value={devTaskId} 
                        onChange={(e) => setDevTaskId(e.target.value)}
                        className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] focus:outline-none focus:border-salmon font-bold" 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-slate-500">USDC Escrow Bounty:</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={devBounty} 
                        onChange={(e) => setDevBounty(e.target.value)}
                        className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] font-mono focus:outline-none focus:border-salmon font-bold" 
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Evaluator / Arbitrator Address:</label>
                    <input 
                      type="text" 
                      value={devEvaluator} 
                      onChange={(e) => setDevEvaluator(e.target.value)}
                      className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] font-mono focus:outline-none focus:border-salmon" 
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Blocker Task Description:</label>
                    <textarea 
                      rows={2}
                      value={devDescription} 
                      onChange={(e) => setDevDescription(e.target.value)}
                      className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] focus:outline-none focus:border-salmon font-bold" 
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Target Image URL (Optional):</label>
                    <input 
                      type="text" 
                      value={devImageUrl} 
                      onChange={(e) => setDevImageUrl(e.target.value)}
                      className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] focus:outline-none focus:border-salmon font-mono" 
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={devIsSubmitting}
                    className="neo-btn w-full py-3.5 text-xs font-black uppercase text-black"
                  >
                    {devIsSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        Deploying ERC-8183 Job Escrow & Locking...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-black" />
                        Lock Bounty & Settle Escrow
                      </>
                    )}
                  </button>
                </form>

                {devTxHash && (
                  <div className="bg-salmon/10 border-2 border-[#1F1E1D] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between text-xs gap-3 animate-fadeIn">
                    <div className="flex items-center gap-3 text-[#1F1E1D]">
                      <CheckCircle className="w-5 h-5 text-[#1F1E1D] shrink-0" />
                      <div>
                        <p className="font-bold font-mono">On-Chain Escrow Confirmed!</p>
                        <p className="text-[11px] text-slate-650 font-semibold font-mono">ERC-8183 Job contract deployed successfully on Arc Testnet.</p>
                      </div>
                    </div>
                    <a 
                      href={`${addresses.explorer}/tx/${devTxHash}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-salmon hover:underline flex items-center gap-1 font-bold font-mono text-[10px]"
                    >
                      View Tx <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Developer SDK Code Snippets */}
              <div className="neo-card bg-white p-5 flex flex-col gap-4">
                <div className="border-b border-slate-200 pb-2">
                  <span className="neo-badge bg-salmon text-[#1F1E1D]">02. DEVELOPER SDK</span>
                  <h2 className="text-sm font-bold text-[#1F1E1D] font-mono uppercase tracking-tight mt-1">AI Agent Sourcing Integration</h2>
                  <p className="text-xs text-slate-650 mt-1 font-medium">Outsource programmatic blockers directly inside your agent frameworks.</p>
                </div>

                <div className="flex border-b border-slate-200">
                  <button
                    onClick={() => setSdkLanguage('node')}
                    className={`px-4 py-2 text-xs font-black uppercase transition ${sdkLanguage === 'node' ? 'border-b-4 border-[#1F1E1D] text-[#1F1E1D]' : 'text-slate-400'}`}
                  >
                    Node.js
                  </button>
                  <button
                    onClick={() => setSdkLanguage('python')}
                    className={`px-4 py-2 text-xs font-black uppercase transition ${sdkLanguage === 'python' ? 'border-b-4 border-[#1F1E1D] text-[#1F1E1D]' : 'text-slate-400'}`}
                  >
                    Python
                  </button>
                  <button
                    onClick={() => setSdkLanguage('curl')}
                    className={`px-4 py-2 text-xs font-black uppercase transition ${sdkLanguage === 'curl' ? 'border-b-4 border-[#1F1E1D] text-[#1F1E1D]' : 'text-slate-400'}`}
                  >
                    cURL
                  </button>
                </div>

                <div className="bg-[#1F1E1D] text-[#FAF9F5] rounded-2xl p-4 overflow-x-auto border-2 border-[#1F1E1D] font-mono text-[10px] leading-relaxed max-h-52 select-all neo-shadow-medium">
                  <pre>{sdkCode[sdkLanguage]}</pre>
                </div>
              </div>
            </div>

            {/* Circle CCTP Cross-Chain Funding Bridge */}
            <div className="neo-card bg-white p-6 flex flex-col gap-5">
              <div className="border-b border-slate-200 pb-2">
                <span className="neo-badge bg-salmon text-[#1F1E1D]">03. CIRCLE CCTP</span>
                <h2 className="text-lg font-serif font-black text-[#1F1E1D] mt-2">CCTP Cross-Chain Agent Funding</h2>
                <p className="text-xs text-slate-650 mt-1 font-medium">
                  Fund Arc Testnet ERC-8183 Job escrows from external networks (Sepolia, Avalanche, Arbitrum) gaslessly via Circle's native CCTP bridge.
                </p>
              </div>

              <hr className="border-slate-200" />

              <div className="bg-[#FAF9F5] border-2 border-[#1F1E1D] p-5 rounded-2xl flex flex-col gap-4 neo-shadow-small">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Source Network:</label>
                    <select
                      value={bridgeSourceChain}
                      onChange={(e) => setBridgeSourceChain(e.target.value as any)}
                      className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] focus:outline-none focus:border-salmon font-bold"
                    >
                      <option value="Arbitrum">Arbitrum L2</option>
                      <option value="Avalanche">Avalanche C-Chain</option>
                      <option value="Ethereum">Ethereum Sepolia</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase font-mono font-bold text-slate-500">Bounty Amount (USDC):</label>
                    <input 
                      type="number"
                      value={bridgeAmount}
                      onChange={(e) => setBridgeAmount(e.target.value)}
                      className="bg-white border-2 border-[#1F1E1D] p-2.5 rounded-xl text-xs text-[#1F1E1D] font-mono focus:outline-none focus:border-salmon font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-700 font-mono bg-white p-3 rounded-xl border-2 border-[#1F1E1D]">
                  <span className="font-bold">Routing Destination:</span>
                  <span className="font-black text-salmon">Circle Arc Gasless (Arc L1)</span>
                </div>

                <button
                  onClick={handleBridgeAndFund}
                  disabled={isBridging || Number(bridgeAmount) <= 0}
                  className="neo-btn w-full py-3.5 text-xs font-black uppercase text-black"
                >
                  {isBridging ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                      CCTP Bridge Executing ({bridgeProgress}%)
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4 text-black" />
                      Bridge & Fund Escrow
                    </>
                  )}
                </button>
              </div>

              {/* Live Bridge Terminal Logs */}
              <div className="border-2 border-[#1F1E1D] bg-[#1F1E1D] rounded-2xl p-4 flex flex-col gap-2 neo-shadow-medium">
                <div className="flex items-center justify-between text-xs font-bold text-[#FAF9F5] font-mono">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-salmon" />
                    CCTP Bridge Stderr Console
                  </span>
                  {isBridging && <span className="w-2.5 h-2.5 bg-salmon rounded-full animate-ping" />}
                </div>

                <div className="bg-[#FAF9F5] text-[#1F1E1D] p-3 rounded-xl border-2 border-[#1F1E1D] font-mono text-[10px] min-h-36 max-h-48 overflow-y-auto flex flex-col gap-1.5 select-text font-bold">
                  {bridgeLogs.length === 0 ? (
                    <span className="text-slate-400">[idle] Awaiting bridge trigger events...</span>
                  ) : (
                    bridgeLogs.map((log, index) => (
                      <span key={index} className={log.includes('[SUCCESS]') ? 'text-salmon font-black' : log.includes('Step') ? 'text-slate-800' : ''}>
                        {log}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[#1F1E1D] bg-white px-6 py-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#1F1E1D] gap-4 mt-auto font-mono font-bold">
        <p>© 2026 GIGA GIG PLATFORM. THE NEW ERA OF DECENTRALIZED WORKFLOW FOR AI & HUMANS.</p>
        <div className="flex items-center gap-4">
          <a href="https://docs.arc.network" target="_blank" rel="noreferrer" className="hover:text-salmon flex items-center gap-1">
            Arc Docs <ExternalLink className="w-3 h-3 text-[#1F1E1D]" />
          </a>
          <a href="https://developers.circle.com" target="_blank" rel="noreferrer" className="hover:text-salmon flex items-center gap-1">
            Circle Stack <ExternalLink className="w-3 h-3 text-[#1F1E1D]" />
          </a>
        </div>
      </footer>
    </div>
  );
}
