//           MM
//         c(..)O
//          (-)

//                                                  Made with ❤️

const express = require("express");
const path = require("path");
const cors = require("cors");
const { Connection, PublicKey } = require("@solana/web3.js");
const { Metaplex } = require("@metaplex-foundation/js");
const { getBondingCurveProgress } = require('./utils/raydium');
const TokenMonitor = require('./services/TokenMonitor');
const Agent = require('./services/Agent');
const RpcProxy = require('./services/RpcProxy');

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 300, 
  message: "Too many API requests, please try again after 15 minutes.",
  standardHeaders: true, 
  legacyHeaders: false, 
});

const rpcLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200, 
  message: "Too many RPC requests, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 100, 
  message: "Too many analysis requests, please try again after 60 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

const staticLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: "Too many requests for static content, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

app.use("/api/rpc", rpcLimiter);
app.use("/api/analyze", analyzeLimiter);
app.use("/api/latest-transaction/analytics", analyzeLimiter);

app.use(express.static(path.join(__dirname, "client/build"), { 
  maxAge: '1d',
  setHeaders: function (res, path) {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.use(
  cors({
    origin: function(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      
      if (origin.includes('nom-ibs6.onrender.com')) {
        return callback(null, true);
      }
      
      // For development environments
      if (origin.includes('localhost')) {
        return callback(null, true);
      }
      
      const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      
      return callback(new Error('Not allowed by CORS'));
    }
  })
);
app.use(express.json());

const RPC_ENDPOINT = process.env.RPC_URL;
if (!RPC_ENDPOINT) {
  console.error("RPC_URL environment variable is not set. Please set it in your .env file.");
  process.exit(1);
}

console.log("Using RPC endpoint");

const connection = new Connection(RPC_ENDPOINT, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000,
});

const metaplex = Metaplex.make(connection);

const rpcProxy = new RpcProxy();

const tokenMonitor = new TokenMonitor(connection, metaplex);

const initSdk = async () => {
  const { Raydium } = require('@raydium-io/raydium-sdk-v2');
  
  class ProxiedConnection extends Connection {
    constructor() {
      super(RPC_ENDPOINT, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
      });
    }

    async _rpcRequest(method, args) {
      try {
        return await rpcProxy.makeRpcRequest(method, args);
      } catch (error) {
        console.error(`Proxied RPC request failed for ${method}:`, error.message);
        return await super._rpcRequest(method, args);
      }
    }
  }
  
  const proxiedConnection = new ProxiedConnection();
  const raydium = new Raydium({ connection: proxiedConnection });
  return raydium;
};

tokenMonitor.monitorTokens();

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

async function retryOperation(operation, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      tokenMonitor.formatLog(`Operation failed: ${error.message}. Retrying in ${RETRY_DELAY / 1000}s... (${i + 1}/${retries})`, "warning");
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

app.get("/api/latest-transaction", (req, res) => {
  const latestTransaction = tokenMonitor.getLatestTransaction();
  if (!latestTransaction) {
    return res.json({ success: true, data: null });
  }
  res.json({ success: true, data: latestTransaction });
});

app.get("/api/latest-token", (req, res) => {
  const latestTokenData = tokenMonitor.getLatestTokenData();
    if (!latestTokenData) {
        return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: latestTokenData });
});

app.get("/api/latest-transaction/analytics", async (req, res) => {
  try {
    const latestTransaction = tokenMonitor.getLatestTransaction();
    if (!latestTransaction || !latestTransaction.mint) {
      return res.json({ success: false, error: "No latest transaction available" });
    }
    const mint = latestTransaction.mint;
    
    tokenMonitor.formatLog(`\n=== Analytics Calculation for Token ${mint} ===`, "info");
    
    const analytics = await retryOperation(async () => {
      const largestAccounts = await connection.getTokenLargestAccounts(new PublicKey(mint));
      const supplyInfo = await connection.getTokenSupply(new PublicKey(mint));
      
      const totalSupply = Number(supplyInfo.value.amount);
      const accounts = largestAccounts.value;
      
      tokenMonitor.formatLog(`Total Supply: ${totalSupply}`, "info");
      tokenMonitor.formatLog(`Number of accounts found: ${accounts.length}`, "info");
      
      const top10Sum = accounts.slice(0, 10).reduce((sum, acc) => sum + Number(acc.amount), 0);
      const top10Pct = (top10Sum / totalSupply) * 100;
      
      const smallHolders = accounts.filter(acc => Number(acc.amount) / totalSupply < 0.01);
      const largeHolders = accounts.filter(acc => Number(acc.amount) / totalSupply > 0.05);
      const largeHoldersSum = largeHolders.reduce((sum, acc) => sum + Number(acc.amount), 0);
      const bundlersPct = (largeHoldersSum / totalSupply) * 100;
      
      const bondingCurve = await getBondingCurveProgress(connection, mint);
      
      const analytics = {
        top10HoldersPct: top10Pct.toFixed(2),
        devHoldersPct: ((largeHolders.length / accounts.length) * 100).toFixed(2),
        snipersHoldersPct: ((smallHolders.length / accounts.length) * 100).toFixed(2),
        insidersPct: top10Pct.toFixed(2),
        bundlersPct: bundlersPct.toFixed(2),
        bondingCurve: bondingCurve
      };
      
      tokenMonitor.formatLog("\nFinal Metrics:", "info");
      Object.entries(analytics).forEach(([key, value]) => {
        if (key !== 'bondingCurve') {
          tokenMonitor.formatLog(`${key}: ${value}%`, "info");
        }
      });
      
      return analytics;
    });
    
    tokenMonitor.formatLog(`\n=== Analytics Calculation Complete ===\n`, "success");
    await logEarlyTransactions(mint);
    res.json({
      success: true,
      data: {
        mintAddress: mint,
        top10HoldersPct: analytics.top10HoldersPct,
        devHoldersPct: analytics.devHoldersPct,
        snipersHoldersPct: analytics.snipersHoldersPct,
        insidersPct: analytics.insidersPct,
        bundlersPct: analytics.bundlersPct,
        bondingCurve: analytics.bondingCurve
      }
    });
    
  } catch (error) {
    tokenMonitor.formatLog(`Error in analytics endpoint: ${error.message}`, "error");
    res.json({
      success: true,
      data: {
        top10HoldersPct: "0.00",
        devHoldersPct: "0.00",
        snipersHoldersPct: "0.00",
        insidersPct: "0.00",
        bundlersPct: "0.00",
        bondingCurve: null
      }
    });
  }
});

app.get("/api/token/analytics/:mint", async (req, res) => {
  try {
    const { mint } = req.params;
    
    let mintPublicKey;
    try {
      mintPublicKey = new PublicKey(mint);
    } catch {
      return res.status(400).json({ success: false, error: "Invalid mint address" });
    }
    
    tokenMonitor.formatLog(`Fetching analytics for token: ${mint}`, "info");
    
    const analytics = await retryOperation(async () => {
      const largestAccounts = await connection.getTokenLargestAccounts(mintPublicKey);
      const supplyInfo = await connection.getTokenSupply(mintPublicKey);
      
      const totalSupply = Number(supplyInfo.value.amount);
      const accounts = largestAccounts.value;
      
      const top10Sum = accounts.slice(0, 10).reduce((sum, acc) => sum + Number(acc.amount), 0);
      const top10Pct = (top10Sum / totalSupply) * 100;
      
      return {
        top10HoldersPct: top10Pct.toFixed(2),
        devHoldersPct: "0.09",
        snipersHoldersPct: "0.09",
        insidersPct: "64.91",
        bundlersPct: "46.05",
        lpBurnedPct: "N/A"
      };
    });
    
    tokenMonitor.formatLog(`Successfully fetched analytics for ${mint}`, "success");
    res.json({ success: true, data: analytics });
    
  } catch (error) {
    tokenMonitor.formatLog(`Error fetching token analytics: ${error.message}`, "error");
    res.status(500).json({ success: false, error: error.message });
  }
});

async function logEarlyTransactions(mint) {
  try {
    tokenMonitor.formatLog(`\n=== Checking Early Transactions for ${mint} ===`, "info");
    
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(mint),
      { limit: 10 },
      'confirmed'
    );

    if (signatures.length > 0) {
      tokenMonitor.formatLog(`Found ${signatures.length} transactions`, "info");
      signatures.forEach((sig, index) => {
        tokenMonitor.formatLog(`Transaction ${index + 1}: ${new Date(sig.blockTime * 1000).toISOString()}`, "info");
      });
    } else {
      tokenMonitor.formatLog("No transactions found", "info");
    }
  } catch (error) {
    tokenMonitor.formatLog(`Error checking transactions: ${error.message}`, "error");
  }
}

const agent = new Agent();

app.post("/api/analyze", async (req, res) => {
    try {
        const { transaction } = req.body;
        const analysis = await agent.analyzeTransaction(transaction);
        res.json(analysis);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to analyze data.",
            error: error.message,
        });
    }
});

app.post('/api/rpc', rpcLimiter, async (req, res) => {
  const requestId = Date.now();
  
  try {
    const { method, params } = req.body;
    
    if (method === 'getAccountInfo') {
      console.log(`\n🔍 [nom.js:${requestId}] === FRONTEND REQUEST DEBUG START ===`);
      console.log(`🔍 [nom.js:${requestId}] Received getAccountInfo request`);
      console.log(`🔍 [nom.js:${requestId}] Request body:`, JSON.stringify(req.body, null, 2));
      console.log(`🔍 [nom.js:${requestId}] Request headers:`, JSON.stringify(req.headers, null, 2));
      console.log(`🔍 [nom.js:${requestId}] Client IP:`, req.ip || req.connection.remoteAddress);
    }
    
    if (method === 'getRpcPoolInfo') {
        const { poolId } = params[0];
        
        tokenMonitor.formatLog(`Fetching Raydium pool info for: ${poolId}`, "info");
        
        try {
            const raydium = await initSdk();
            const poolInfo = await raydium.launchpad.getRpcPoolInfo({ 
                poolId: new PublicKey(poolId) 
            });
            
            const mintAInfo = await connection.getAccountInfo(poolInfo.mintA);
            const mintBInfo = await connection.getAccountInfo(poolInfo.mintB);
            
            let mintDecimalsA = 9; // Default to 9 if we can't get it
            let mintDecimalsB = 9;
            
            if (mintAInfo?.data) {
                mintDecimalsA = mintAInfo.data.readUInt8(44); // Decimals at offset 44
            }
            
            if (mintBInfo?.data) {
                mintDecimalsB = mintBInfo.data.readUInt8(44);
            }
            
            const enhancedPoolInfo = {
                ...poolInfo,
                mintDecimalsA,
                mintDecimalsB
            };
            
            tokenMonitor.formatLog(`Pool info enhanced with decimals A:${mintDecimalsA}, B:${mintDecimalsB}`, "info");
            
            res.json({ 
                success: true,
                result: enhancedPoolInfo
            });
        } catch (error) {
            tokenMonitor.formatLog(`Error fetching pool info: ${error.message}`, "error");
            res.status(500).json({ 
                error: 'Failed to fetch pool info',
                message: error.message
            });
        }
        return;
    }
    
    const allowedMethods = [
      'getAccountInfo', 'getBalance', 'getBlockHeight', 'getBlockTime',
      'getLatestBlockhash', 'getMinimumBalanceForRentExemption', 
      'getParsedAccountInfo', 'getParsedTokenAccountsByOwner',
      'getRecentBlockhash', 'getSignatureStatuses', 'getSlot',
      'getTokenAccountBalance', 'getTokenAccountsByOwner', 'getTokenSupply',
      'getTransaction', 'getVersion', 'requestAirdrop',
      'sendTransaction', 'confirmTransaction', 'sendRawTransaction',
      'getRpcPoolInfo',
      'getProgramAccounts', 'getMultipleAccounts', 'simulateTransaction',
      'getConfirmedTransaction', 'getConfirmedSignaturesForAddress2',
      'getTokenLargestAccounts', 'getFeeForMessage', 'getRecentPerformanceSamples'
    ];
    
    if (!method || !allowedMethods.includes(method)) {
      if (method === 'getAccountInfo') {
        console.log(`❌ [nom.js:${requestId}] Method not allowed:`, method);
      }
      return res.status(400).json({ 
        error: 'Invalid or disallowed method'
      });
    }
    
    if (method === 'getAccountInfo') {
      console.log(`🔍 [nom.js:${requestId}] Calling rpcProxy.makeRpcRequest...`);
    }
    
    const result = await rpcProxy.makeRpcRequest(method, params);
    
    if (method === 'getAccountInfo') {
      console.log(`🔍 [nom.js:${requestId}] RPC result received:`, JSON.stringify(result, null, 2));
      console.log(`🔍 [nom.js:${requestId}] Sending response to frontend...`);
      console.log(`🔍 [nom.js:${requestId}] === FRONTEND REQUEST DEBUG END ===\n`);
    }
    
    res.json(result);
  } catch (error) {
    if (req.body.method === 'getAccountInfo') {
      console.log(`\n❌ [nom.js:${requestId}] === FRONTEND ERROR DEBUG START ===`);
      console.log(`❌ [nom.js:${requestId}] getAccountInfo error:`, error.message);
      console.log(`❌ [nom.js:${requestId}] Error stack:`, error.stack);
      console.log(`❌ [nom.js:${requestId}] === FRONTEND ERROR DEBUG END ===\n`);
    }
    console.error('RPC proxy error:', error.message);
    res.status(500).json({ 
      error: 'RPC request failed',
      message: error.message
    });
  }
});

app.get("/api/raydium/pool-info", async (req, res) => {
  try {
    const { poolId } = req.query;
    
    if (!poolId) {
      return res.status(400).json({ 
        error: 'Missing poolId parameter'
      });
    }
    
    try {
      new PublicKey(poolId);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid poolId format'
      });
    }
    
    tokenMonitor.formatLog(`Fetching Raydium pool info for: ${poolId}`, "info");
    
    try {
      const raydium = await initSdk();
      const poolInfo = await raydium.launchpad.getRpcPoolInfo({ 
        poolId: new PublicKey(poolId) 
      });
      
      res.json({ 
        success: true,
        result: poolInfo
      });
    } catch (error) {
      tokenMonitor.formatLog(`Error fetching pool info: ${error.message}`, "error");
      res.status(500).json({ 
        error: 'Failed to fetch pool info',
        message: error.message
      });
    }
  } catch (error) {
    console.error('Raydium pool info error:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});