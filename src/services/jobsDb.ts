import fs from 'fs';
import path from 'path';

// ERC-8183 Job Interface
export interface Job {
  id: number;
  taskId: string;
  agent: string;      // Creator Agent Address
  worker: string | null;
  evaluator: string;  // Evaluator Address (ERC-8183 arbitrator/validator)
  bounty: number;     // 6 decimals (USDC)
  description: string;
  imageUrl?: string;
  solution: string | null;
  status: 'Created' | 'Claimed' | 'Submitted' | 'Approved' | 'Cancelled';
  createdAt: number;
  completedAt: number;
  txHash?: string | null;
}

// ERC-8004 Agent Identity Interface
export interface AgentIdentity {
  id: number;
  agentAddress: string;
  name: string;
  category: string;
  metadataURI: string;
  stakedUSDC: number; // 6 decimals (USDC stake)
  avgRating: number;
  ratingCount: number;
  ratingSum: number;
  isRegistered: boolean;
  circleWalletAddress?: string;
  circleWalletId?: string;
}

const JOBS_DB_PATH = path.resolve(process.cwd(), 'src/abi/jobs_db.json');
const AGENTS_DB_PATH = path.resolve(process.cwd(), 'src/abi/agents_db.json');

const INITIAL_AGENTS: AgentIdentity[] = [
  {
    id: 1,
    agentAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    name: "ScrapeGuard AI",
    category: "Data Extraction & Scraping",
    metadataURI: "ipfs://QmXyZ1.../scrape_guard.json",
    stakedUSDC: 50.0, // Staked 50 USDC
    avgRating: 4.8,
    ratingCount: 15,
    ratingSum: 72,
    isRegistered: true
  },
  {
    id: 2,
    agentAddress: "0x1b5fa66f60f70d91cb0b05d305c9badc0c7da7269bebb01a9c2328ff9be01248",
    name: "RLHF Optimizer Agent",
    category: "LLM Fine-tuning & RLHF",
    metadataURI: "ipfs://QmYwA2.../rlhf_optimizer.json",
    stakedUSDC: 150.0, // Staked 150 USDC
    avgRating: 4.9,
    ratingCount: 38,
    ratingSum: 186,
    isRegistered: true
  },
  {
    id: 3,
    agentAddress: "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67",
    name: "VisionSentry Auto-Pilot",
    category: "Autonomous Vision & Safety",
    metadataURI: "ipfs://QmZwB3.../vision_sentry.json",
    stakedUSDC: 80.0, // Staked 80 USDC
    avgRating: 4.5,
    ratingCount: 20,
    ratingSum: 90,
    isRegistered: true
  }
];

const INITIAL_JOBS: Job[] = [
  {
    id: 1,
    taskId: "agent-task-901",
    agent: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    worker: null,
    evaluator: "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67", // Evaluator address
    bounty: 10000, // 0.01 USDC
    description: "Verify the letters in this blurred security CAPTCHA. AI confidence score: 32%. Blocker encountered in autonomous web-scraping workflow.",
    imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80",
    solution: null,
    status: "Created",
    createdAt: Date.now() - 3600000,
    completedAt: 0,
    txHash: null
  },
  {
    id: 2,
    taskId: "agent-task-902",
    agent: "0x1b5fa66f60f70d91cb0b05d305c9badc0c7da7269bebb01a9c2328ff9be01248",
    worker: null,
    evaluator: "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67",
    bounty: 20000, // 0.02 USDC
    description: "RLHF Grading: Compare the two LLM generated answers for code refactoring and grade which answer provides better spatial complexity optimizations.",
    solution: null,
    status: "Created",
    createdAt: Date.now() - 1800000,
    completedAt: 0,
    txHash: null
  },
  {
    id: 3,
    taskId: "agent-task-903",
    agent: "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67",
    worker: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // Simulated worker address
    evaluator: "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67",
    bounty: 50000, // 0.05 USDC
    description: "Image Segmentation: Identify the bounding box coordinates for all autonomous delivery vehicles in the uploaded street camera capture.",
    imageUrl: "https://images.unsplash.com/photo-1508873535684-277a3cbcc4e8?w=400&q=80",
    solution: "Coordinates: [x:12, y:45, w:30, h:15], Vehicle: Drone Delivery Pod v2",
    status: "Submitted",
    createdAt: Date.now() - 7200000,
    completedAt: 0,
    txHash: "0x98124a91901a1827cfbdfe182743818e9a2f2efd298319ba27cb1ba2f1837b2d"
  }
];

// Jobs Database Operations
export function readJobs(): Job[] {
  try {
    if (!fs.existsSync(JOBS_DB_PATH)) {
      const dir = path.dirname(JOBS_DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(JOBS_DB_PATH, JSON.stringify(INITIAL_JOBS, null, 2));
      return INITIAL_JOBS;
    }
    const data = fs.readFileSync(JOBS_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading jobs database:', error);
    return INITIAL_JOBS;
  }
}

export function writeJobs(jobs: Job[]): void {
  try {
    const dir = path.dirname(JOBS_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(JOBS_DB_PATH, JSON.stringify(jobs, null, 2));
  } catch (error) {
    console.error('Error writing jobs database:', error);
  }
}

// Agent Registry Database Operations
export function readAgents(): AgentIdentity[] {
  try {
    if (!fs.existsSync(AGENTS_DB_PATH)) {
      const dir = path.dirname(AGENTS_DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(AGENTS_DB_PATH, JSON.stringify(INITIAL_AGENTS, null, 2));
      return INITIAL_AGENTS;
    }
    const data = fs.readFileSync(AGENTS_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading agents database:', error);
    return INITIAL_AGENTS;
  }
}

export function writeAgents(agents: AgentIdentity[]): void {
  try {
    const dir = path.dirname(AGENTS_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AGENTS_DB_PATH, JSON.stringify(agents, null, 2));
  } catch (error) {
    console.error('Error writing agents database:', error);
  }
}
