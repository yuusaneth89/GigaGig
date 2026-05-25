import { NextRequest, NextResponse } from 'next/server';
import { readJobs, writeJobs, Job } from '@/services/jobsDb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, action, workerAddress, solution, txHash } = body;

    if (!jobId || !action) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: jobId, action" },
        { status: 400 }
      );
    }

    const jobs = readJobs();
    const jobIndex = jobs.findIndex(j => j.id === Number(jobId));

    if (jobIndex === -1) {
      return NextResponse.json(
        { success: false, error: `Job with ID ${jobId} not found` },
        { status: 404 }
      );
    }

    const job = jobs[jobIndex];

    switch (action) {
      case 'claim':
        if (job.status !== 'Created') {
          return NextResponse.json({ success: false, error: `Cannot claim job in status: ${job.status}` }, { status: 400 });
        }
        if (!workerAddress) {
          return NextResponse.json({ success: false, error: "workerAddress is required to claim job" }, { status: 400 });
        }
        job.worker = workerAddress;
        job.status = 'Claimed';
        break;

      case 'submit':
        if (job.status !== 'Claimed') {
          return NextResponse.json({ success: false, error: `Cannot submit solution in status: ${job.status}` }, { status: 400 });
        }
        if (!solution) {
          return NextResponse.json({ success: false, error: "solution content is required to submit job" }, { status: 400 });
        }
        job.solution = solution;
        job.status = 'Submitted';
        if (txHash) job.txHash = txHash;
        break;

      case 'approve':
        if (job.status !== 'Submitted') {
          return NextResponse.json({ success: false, error: `Cannot approve job in status: ${job.status}` }, { status: 400 });
        }
        job.status = 'Approved';
        job.completedAt = Date.now();
        if (txHash) job.txHash = txHash;
        break;

      case 'cancel':
        if (job.status !== 'Created' && job.status !== 'Claimed' && job.status !== 'Submitted') {
          return NextResponse.json({ success: false, error: `Cannot cancel job in status: ${job.status}` }, { status: 400 });
        }
        job.status = 'Cancelled';
        if (txHash) job.txHash = txHash;
        break;

      default:
        return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
    }

    jobs[jobIndex] = job;
    writeJobs(jobs);

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} updated successfully with action: ${action}`,
      job
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
