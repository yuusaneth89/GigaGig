// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

contract GigaGigPlatform is IERC165 {
    address public owner;
    address public usdcToken;
    uint256 public platformFeeBps = 200; // 2% platform fee in basis points (100 = 1%)

    // --- ERC-8004: Trustless Agent Registry (Identity & Reputation) ---
    struct Agent {
        uint256 id;
        address agentAddress;
        string name;
        string category;
        string metadataURI; // IPFS URI for models/endpoints
        uint256 stakedUSDC; // Staked USDC backing agent reputation (6 decimals)
        uint256 ratingSum;
        uint256 ratingCount;
        bool isRegistered;
    }

    uint256 public totalAgents;
    mapping(address => Agent) public agents;
    address[] public agentAddresses;

    event AgentRegistered(address indexed agentAddress, uint256 indexed agentId, string name, string category, string metadataURI);
    event CollateralStaked(address indexed agentAddress, uint256 amount, uint256 totalStaked);
    event CollateralUnstaked(address indexed agentAddress, uint256 amount, uint256 totalStaked);
    event CollateralSlashed(address indexed agentAddress, uint256 amount, string reason);
    event AgentRated(address indexed agentAddress, uint256 rating, uint256 newAverageRating);

    // --- Feature A: Micro-task registry & pool ---
    uint256 public totalMicroPaymentsPaid;
    uint256 public microPaymentCount;
    struct MicroTaskPayout {
        uint256 id;
        address worker;
        uint256 amount;
        string taskType;
        uint256 timestamp;
    }
    mapping(uint256 => MicroTaskPayout) public microPayouts;

    // --- Feature B: Streaming Payment System ---
    struct Stream {
        address client;
        address worker;
        uint256 ratePerSecond; // 6 decimals (USDC)
        uint256 startTime;
        uint256 endTime;
        uint256 claimedAmount;
        bool active;
    }
    uint256 public nextStreamId;
    mapping(uint256 => Stream) public streams;
    mapping(address => uint256[]) private _clientStreams;
    mapping(address => uint256[]) private _workerStreams;

    // --- Feature C & ERC-8183: AI Agent Escrow Jobs ---
    enum JobStatus { Created, Claimed, Submitted, Approved, Cancelled }
    struct AgentJob {
        uint256 id;
        string taskId; // External ID from AI agent / SDK
        address agent; // The AI Agent client
        address worker; // The human worker
        address evaluator; // Evaluator for task verification (ERC-8183)
        uint256 bounty; // USDC amount (6 decimals)
        string description;
        string solution;
        JobStatus status;
        uint256 createdAt;
        uint256 completedAt;
    }
    uint256 public nextJobId;
    mapping(uint256 => AgentJob) public jobs;
    mapping(address => uint256[]) private _agentJobs;
    mapping(address => uint256[]) private _workerJobs;

    event MicroTaskPaid(uint256 indexed payoutId, address indexed worker, uint256 amount, string taskType);
    event StreamCreated(uint256 indexed streamId, address indexed client, address indexed worker, uint256 ratePerSecond, uint256 duration);
    event StreamClaimed(uint256 indexed streamId, address indexed worker, uint256 amount);
    event StreamCancelled(uint256 indexed streamId, uint256 refundedToClient, uint256 paidToWorker);
    
    event JobCreated(uint256 indexed jobId, string taskId, address indexed agent, uint256 bounty, string description);
    event JobCreatedWithEvaluator(uint256 indexed jobId, string taskId, address indexed agent, address indexed evaluator, uint256 bounty);
    event JobClaimed(uint256 indexed jobId, address indexed worker);
    event JobSubmitted(uint256 indexed jobId, string solution);
    event JobApproved(uint256 indexed jobId, address indexed worker, uint256 payout, uint256 platformFee);
    event JobCancelled(uint256 indexed jobId, address indexed agent);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can call this");
        _;
    }

    constructor(address _usdcToken) {
        owner = msg.sender;
        usdcToken = _usdcToken;
    }

    // IERC165 Implementation
    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == 0x01ffc9a7 || // ERC-165 interface ID for ERC165
               interfaceId == 0x80048004 || // Simulated ERC-8004 Agent Identity
               interfaceId == 0x81838183;   // Simulated ERC-8183 Job Escrow
    }

    // Set Platform Fee Bps
    function setPlatformFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high (max 10%)");
        platformFeeBps = _feeBps;
    }

    // --- ERC-8004: Agent Registration, Staking and Slashing ---

    function registerAgent(
        string calldata _name,
        string calldata _category,
        string calldata _metadataURI
    ) external returns (uint256) {
        require(!agents[msg.sender].isRegistered, "Agent already registered");

        uint256 agentId = totalAgents++;
        agents[msg.sender] = Agent({
            id: agentId,
            agentAddress: msg.sender,
            name: _name,
            category: _category,
            metadataURI: _metadataURI,
            stakedUSDC: 0,
            ratingSum: 0,
            ratingCount: 0,
            isRegistered: true
        });
        agentAddresses.push(msg.sender);

        emit AgentRegistered(msg.sender, agentId, _name, _category, _metadataURI);
        return agentId;
    }

    function stakeCollateral(uint256 _amount) external {
        require(agents[msg.sender].isRegistered, "Agent must be registered first");
        require(_amount > 0, "Stake amount must be > 0");

        require(
            IERC20(usdcToken).transferFrom(msg.sender, address(this), _amount),
            "USDC stake transfer failed"
        );

        agents[msg.sender].stakedUSDC += _amount;
        emit CollateralStaked(msg.sender, _amount, agents[msg.sender].stakedUSDC);
    }

    function unstakeCollateral(uint256 _amount) external {
        require(agents[msg.sender].isRegistered, "Agent not registered");
        require(agents[msg.sender].stakedUSDC >= _amount, "Insufficient staked balance");
        require(_amount > 0, "Amount must be > 0");

        agents[msg.sender].stakedUSDC -= _amount;
        
        require(
            IERC20(usdcToken).transfer(msg.sender, _amount),
            "USDC unstake transfer failed"
        );

        emit CollateralUnstaked(msg.sender, _amount, agents[msg.sender].stakedUSDC);
    }

    function slashCollateral(address _agent, uint256 _amount, string calldata _reason) external onlyOwner {
        require(agents[_agent].isRegistered, "Agent not registered");
        require(agents[_agent].stakedUSDC >= _amount, "Slash amount exceeds stake");
        require(_amount > 0, "Amount must be > 0");

        agents[_agent].stakedUSDC -= _amount;

        // Route slashed funds to platform owner
        require(
            IERC20(usdcToken).transfer(owner, _amount),
            "Slashed transfer failed"
        );

        emit CollateralSlashed(_agent, _amount, _reason);
    }

    function rateAgent(address _agent, uint256 _rating) external {
        require(agents[_agent].isRegistered, "Agent not registered");
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5");

        agents[_agent].ratingSum += _rating;
        agents[_agent].ratingCount += 1;

        uint256 newAvg = agents[_agent].ratingSum / agents[_agent].ratingCount;
        emit AgentRated(_agent, _rating, newAvg);
    }

    function getAgentDetails(address _agent) external view returns (
        uint256 id,
        string memory name,
        string memory category,
        string memory metadataURI,
        uint256 stakedUSDC,
        uint256 avgRating
    ) {
        Agent memory a = agents[_agent];
        require(a.isRegistered, "Agent not registered");
        uint256 rating = a.ratingCount > 0 ? (a.ratingSum / a.ratingCount) : 0;
        return (a.id, a.name, a.category, a.metadataURI, a.stakedUSDC, rating);
    }

    function getRegisteredAgents() external view returns (address[] memory) {
        return agentAddresses;
    }

    // --- Feature A: Instant micro-task payout ---
    function payoutMicroTask(address _worker, uint256 _amount, string calldata _taskType) external onlyOwner {
        require(_worker != address(0), "Invalid worker address");
        require(_amount > 0, "Amount must be greater than zero");
        
        // Transfer USDC from contract balance to worker
        require(
            IERC20(usdcToken).transfer(_worker, _amount),
            "USDC transfer to worker failed"
        );

        uint256 payoutId = microPaymentCount++;
        microPayouts[payoutId] = MicroTaskPayout({
            id: payoutId,
            worker: _worker,
            amount: _amount,
            taskType: _taskType,
            timestamp: block.timestamp
        });

        totalMicroPaymentsPaid += _amount;

        emit MicroTaskPaid(payoutId, _worker, _amount, _taskType);
    }

    // Deposit USDC to fund micro-tasks payouts
    function depositPlatformFunds(uint256 _amount) external {
        require(
            IERC20(usdcToken).transferFrom(msg.sender, address(this), _amount),
            "Deposit failed"
        );
    }

    // --- Feature B: Create a stream of USDC payments ---
    function createStream(address _worker, uint256 _ratePerSecond, uint256 _duration) external returns (uint256) {
        require(_worker != address(0), "Invalid worker");
        require(_ratePerSecond > 0, "Rate must be > 0");
        require(_duration > 0, "Duration must be > 0");

        uint256 totalAmount = _ratePerSecond * _duration;
        require(
            IERC20(usdcToken).transferFrom(msg.sender, address(this), totalAmount),
            "USDC deposit for stream failed"
        );

        uint256 streamId = nextStreamId++;
        streams[streamId] = Stream({
            client: msg.sender,
            worker: _worker,
            ratePerSecond: _ratePerSecond,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            claimedAmount: 0,
            active: true
        });

        _clientStreams[msg.sender].push(streamId);
        _workerStreams[_worker].push(streamId);

        emit StreamCreated(streamId, msg.sender, _worker, _ratePerSecond, _duration);
        return streamId;
    }

    function getClaimableStreamBalance(uint256 _streamId) public view returns (uint256) {
        Stream memory s = streams[_streamId];
        if (!s.active || block.timestamp <= s.startTime) {
            return 0;
        }

        uint256 elapsed;
        if (block.timestamp >= s.endTime) {
            elapsed = s.endTime - s.startTime;
        } else {
            elapsed = block.timestamp - s.startTime;
        }

        uint256 totalEarned = s.ratePerSecond * elapsed;
        if (totalEarned <= s.claimedAmount) {
            return 0;
        }
        return totalEarned - s.claimedAmount;
    }

    function withdrawFromStream(uint256 _streamId) external {
        Stream storage s = streams[_streamId];
        require(s.active, "Stream is not active");
        
        uint256 claimable = getClaimableStreamBalance(_streamId);
        require(claimable > 0, "No funds claimable");

        s.claimedAmount += claimable;

        require(
            IERC20(usdcToken).transfer(s.worker, claimable),
            "Stream payout failed"
        );

        emit StreamClaimed(_streamId, s.worker, claimable);
    }

    function cancelStream(uint256 _streamId) external {
        Stream storage s = streams[_streamId];
        require(s.active, "Stream is not active");
        require(msg.sender == s.client || msg.sender == owner, "Only client/owner can cancel");

        s.active = false;

        uint256 elapsed;
        if (block.timestamp >= s.endTime) {
            elapsed = s.endTime - s.startTime;
        } else {
            if (block.timestamp <= s.startTime) {
                elapsed = 0;
            } else {
                elapsed = block.timestamp - s.startTime;
            }
        }

        uint256 totalEarned = s.ratePerSecond * elapsed;
        uint256 unpaidEarned = 0;
        if (totalEarned > s.claimedAmount) {
            unpaidEarned = totalEarned - s.claimedAmount;
        }

        uint256 totalStreamAmount = s.ratePerSecond * (s.endTime - s.startTime);
        uint256 refundAmount = totalStreamAmount - s.claimedAmount - unpaidEarned;

        s.claimedAmount += unpaidEarned;

        if (unpaidEarned > 0) {
            require(
                IERC20(usdcToken).transfer(s.worker, unpaidEarned),
                "Final worker payout failed"
            );
        }

        if (refundAmount > 0) {
            require(
                IERC20(usdcToken).transfer(s.client, refundAmount),
                "Client refund failed"
            );
        }

        emit StreamCancelled(_streamId, refundAmount, unpaidEarned);
    }

    // --- Feature C & ERC-8183: Programmable AI Agent Escrow Jobs ---

    // Backwards compatible original function (defaults evaluator to owner)
    function createAgentJob(
        string calldata _taskId,
        uint256 _bounty,
        string calldata _description
    ) external returns (uint256) {
        return _createJobInternal(_taskId, _bounty, _description, owner);
    }

    // ERC-8183 specification: allows setting custom independent evaluator
    function createAgentJobWithEvaluator(
        string calldata _taskId,
        uint256 _bounty,
        string calldata _description,
        address _evaluator
    ) external returns (uint256) {
        return _createJobInternal(_taskId, _bounty, _description, _evaluator);
    }

    function _createJobInternal(
        string memory _taskId,
        uint256 _bounty,
        string memory _description,
        address _evaluator
    ) internal returns (uint256) {
        require(_bounty > 0, "Bounty must be > 0");
        require(_evaluator != address(0), "Invalid evaluator address");

        require(
            IERC20(usdcToken).transferFrom(msg.sender, address(this), _bounty),
            "Job escrow deposit failed"
        );

        uint256 jobId = nextJobId++;
        jobs[jobId] = AgentJob({
            id: jobId,
            taskId: _taskId,
            agent: msg.sender,
            worker: address(0),
            evaluator: _evaluator,
            bounty: _bounty,
            description: _description,
            solution: "",
            status: JobStatus.Created,
            createdAt: block.timestamp,
            completedAt: 0
        });

        _agentJobs[msg.sender].push(jobId);

        emit JobCreated(jobId, _taskId, msg.sender, _bounty, _description);
        emit JobCreatedWithEvaluator(jobId, _taskId, msg.sender, _evaluator, _bounty);
        
        return jobId;
    }

    // Worker claims the job
    function claimAgentJob(uint256 _jobId) external {
        AgentJob storage job = jobs[_jobId];
        require(job.status == JobStatus.Created, "Job not available");
        require(msg.sender != job.agent, "Agent cannot claim their own job");

        job.worker = msg.sender;
        job.status = JobStatus.Claimed;

        _workerJobs[msg.sender].push(_jobId);

        emit JobClaimed(_jobId, msg.sender);
    }

    // Worker submits task results
    function submitAgentJobResult(uint256 _jobId, string calldata _solution) external {
        AgentJob storage job = jobs[_jobId];
        require(job.status == JobStatus.Claimed, "Job is not in claimed state");
        require(msg.sender == job.worker, "Only the assigned worker can submit results");

        job.solution = _solution;
        job.status = JobStatus.Submitted;

        emit JobSubmitted(_jobId, _solution);
    }

    // AI Agent or Evaluator approves task solution and releases payment
    function approveAgentJob(uint256 _jobId) external {
        AgentJob storage job = jobs[_jobId];
        require(job.status == JobStatus.Submitted, "Job results not submitted yet");
        
        // Authorization: Creator, Evaluator, or Contract Owner can settle
        require(
            msg.sender == job.agent || 
            msg.sender == job.evaluator || 
            msg.sender == owner, 
            "Only agent/evaluator/owner can approve"
        );

        job.status = JobStatus.Approved;
        job.completedAt = block.timestamp;

        // Settle funds with platform fee (e.g. 2%)
        uint256 platformFee = (job.bounty * platformFeeBps) / 10000;
        uint256 workerPayout = job.bounty - platformFee;

        // Pay worker
        require(
            IERC20(usdcToken).transfer(job.worker, workerPayout),
            "Worker payout failed"
        );

        // Pay platform fee to owner
        if (platformFee > 0) {
            require(
                IERC20(usdcToken).transfer(owner, platformFee),
                "Platform fee transfer failed"
            );
        }

        emit JobApproved(_jobId, job.worker, workerPayout, platformFee);
    }

    // AI Agent/Evaluator cancels or rejects the job (refunds agent)
    function cancelAgentJob(uint256 _jobId) external {
        AgentJob storage job = jobs[_jobId];
        require(job.status == JobStatus.Created || job.status == JobStatus.Claimed || job.status == JobStatus.Submitted, "Job cannot be cancelled");
        require(msg.sender == job.agent || msg.sender == job.evaluator || msg.sender == owner, "Only agent/evaluator/owner can cancel");

        // If claimed or submitted, let's enforce a timeout.
        if (job.status != JobStatus.Created) {
            require(
                block.timestamp > job.createdAt + 1 hours || 
                msg.sender == job.evaluator || 
                msg.sender == owner,
                "Job claimed; wait 1 hour or ask evaluator/owner for mediation"
            );
        }

        job.status = JobStatus.Cancelled;

        // Refund bounty to agent
        require(
            IERC20(usdcToken).transfer(job.agent, job.bounty),
            "Refund failed"
        );

        emit JobCancelled(_jobId, job.agent);
    }

    // Query helper functions
    function getAgentJobs(address _agent) external view returns (uint256[] memory) {
        return _agentJobs[_agent];
    }

    function getWorkerJobs(address _worker) external view returns (uint256[] memory) {
        return _workerJobs[_worker];
    }

    function getClientStreams(address _client) external view returns (uint256[] memory) {
        return _clientStreams[_client];
    }

    function getWorkerStreams(address _worker) external view returns (uint256[] memory) {
        return _workerStreams[_worker];
    }
}
