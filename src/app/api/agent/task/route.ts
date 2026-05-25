import { NextRequest, NextResponse } from 'next/server';
import { readJobs, writeJobs, Job } from '@/services/jobsDb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const jobs = readJobs();

    if (id) {
      const job = jobs.find(j => j.id === Number(id));
      if (!job) {
        return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, job });
    }

    return NextResponse.json({ success: true, jobs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, description, bounty, imageUrl, agentAddress, evaluator } = body;

    if (!taskId || !description || !bounty) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: taskId, description, bounty" },
        { status: 400 }
      );
    }

    const jobs = readJobs();
    
    // Check if taskId already exists
    if (jobs.some(j => j.taskId === taskId)) {
      return NextResponse.json(
        { success: false, error: `Job with taskId '${taskId}' already exists` },
        { status: 400 }
      );
    }

    const newJob: Job = {
      id: jobs.length > 0 ? Math.max(...jobs.map(j => j.id)) + 1 : 1,
      taskId,
      agent: agentAddress || "0xAgentDAppMasterWallet",
      worker: null,
      evaluator: evaluator || "0xCA2DE969C3266f530a27bE3B46EC0550cF609c67", // Defaults to platform owner
      bounty: Number(bounty), // USDC amount (with 6 decimals, e.g. 10000 = 0.01 USDC)
      description,
      imageUrl: imageUrl || undefined,
      solution: null,
      status: 'Created',
      createdAt: Date.now(),
      completedAt: 0,
      txHash: null
    };

    jobs.push(newJob);
    writeJobs(jobs);

    return NextResponse.json({
      success: true,
      message: "Job registered successfully in GigaGig agent pool",
      job: newJob
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
