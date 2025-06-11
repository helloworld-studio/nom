require('dotenv').config();
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const axios = require('axios');

// Constants
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const LETSBONK_PROGRAM_ID = 'WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh';
const NEW_TOKEN_WINDOW = 5 * 60; // 5 minutes in seconds

// Set up connection
const connection = new Connection(RPC_URL, 'confirmed');
const processedTransactions = new Set();
const knownTokens = new Set();

// Utility functions
function formatLog(message, level = "info") {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logMessage);
  return logMessage;
}

function isLetsBonkToken(mintAddress) {
  return true; 
}

async function isTokenAddress(address) {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(address));
    return accountInfo !== null && accountInfo.data.length > 0;
  } catch (error) {
    formatLog(`Error checking if ${address} is a token: ${error.message}`, "error");
    return false;
  }
}

async function getTokenMetadata(mintAddress) {
  try {
    return {
      name: `Test Token ${mintAddress.slice(0, 6)}`,
      symbol: `TT${mintAddress.slice(0, 3)}`,
      uri: null,
      image: null,
      metadata: {}
    };
  } catch (error) {
    formatLog(`Error fetching metadata for ${mintAddress}: ${error.message}`, "error");
    return {
      name: "Unknown",
      symbol: "UNKNOWN",
      uri: null,
      image: null,
      metadata: {}
    };
  }
}

// Main WebSocket monitoring function
async function testOptimizedWebSocketMonitoring() {
  formatLog("Starting optimized WebSocket token monitoring test...", "info");
  
  // Subscribe to program logs
  const subscriptionId = connection.onLogs(
    new PublicKey(LETSBONK_PROGRAM_ID),
    async (logs, context) => {
      try {
        // Only process transactions that we haven't seen before
        if (processedTransactions.has(logs.signature)) {
          return;
        }
        processedTransactions.add(logs.signature);
        
        // Rate limiting: Add a small delay between processing transactions
        await new Promise(resolve => setTimeout(resolve, 100));
        
        formatLog(`WebSocket event received: ${logs.signature}`, "info");
        
        // Check if this transaction contains token creation instructions
        const tx = await connection.getParsedTransaction(logs.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed"
        });
        
        if (!tx || !tx.meta || !tx.blockTime) {
          return;
        }
        
        // Check if transaction is too old
        const currentTimeSeconds = Math.floor(Date.now() / 1000);
        const txAge = currentTimeSeconds - tx.blockTime;
        if (txAge > NEW_TOKEN_WINDOW) {
          formatLog(`Skipping older transaction from ${new Date(tx.blockTime * 1000).toLocaleString()}`, "info");
          return;
        }
        
        // Optimization: Only process transactions with token balances
        if (!tx.meta.postTokenBalances || tx.meta.postTokenBalances.length === 0) {
          return;
        }
        
        // Quick check for potential token creation
        let hasTokenCreation = false;
        let hasBonkToken = false;
        
        // Pre-filter to avoid unnecessary processing
        for (const balance of tx.meta.postTokenBalances) {
          if (!balance.mint) continue;
          
          // Skip SOL token
          if (balance.mint === "So11111111111111111111111111111111111111112") {
            continue;
          }
          
          // Check if it's a LetsBonk token
          if (isLetsBonkToken(balance.mint)) {
            hasBonkToken = true;
            
            // If we already know this token, no need to process further
            if (knownTokens.has(balance.mint)) {
              continue;
            }
            
            hasTokenCreation = true;
            break;
          }
        }
        
        // Skip if no potential token creation
        if (!hasTokenCreation) {
          if (hasBonkToken) {
            formatLog("Transaction contains known LetsBonk tokens only", "info");
          }
          return;
        }
        
        // Process each token balance for new tokens
        for (const balance of tx.meta.postTokenBalances) {
          if (!balance.mint || knownTokens.has(balance.mint)) {
            continue;
          }
          
          if (balance.mint === "So11111111111111111111111111111111111111112") {
            continue;
          }
          
          if (!isLetsBonkToken(balance.mint)) {
            formatLog(`Skipping non-LetsBonk token: ${balance.mint}`, "info");
            continue;
          }
          
          try {
            const isToken = await isTokenAddress(balance.mint);
            if (!isToken) continue;
            
            formatLog(`Found new LetsBonk token:`, "success");
            formatLog(`├─ Mint Address: ${balance.mint}`, "info");
            formatLog(`├─ Transaction: ${logs.signature}`, "info");
            knownTokens.add(balance.mint);
            
            const fetchedMetadata = await getTokenMetadata(balance.mint);
            formatLog(`├─ Name: ${fetchedMetadata.name}`, "info");
            formatLog(`├─ Symbol: ${fetchedMetadata.symbol}`, "info");
            
            let uiAmount = 0;
            if (balance.uiTokenAmount && balance.uiTokenAmount.uiAmount) {
              uiAmount = typeof balance.uiTokenAmount.uiAmount === 'string' ? 
                parseFloat(balance.uiTokenAmount.uiAmount) : 
                balance.uiTokenAmount.uiAmount;
            }
            
            const feeSol = tx.meta.fee ? tx.meta.fee / LAMPORTS_PER_SOL : 0;
            
            formatLog(`├─ Initial Buy Amount: ${uiAmount}`, "info");
            formatLog(`├─ Transaction Fee: ${feeSol} SOL`, "info");
            formatLog(`└─ Block Time: ${new Date(tx.blockTime * 1000).toLocaleString()}`, "info");
            
          } catch (tokenError) {
            formatLog(`Error processing token ${balance.mint}: ${tokenError.message}`, "error");
          }
        }
      } catch (error) {
        formatLog(`Error handling WebSocket event: ${error.message}`, "error");
      }
    },
    "confirmed"
  );
  
  formatLog(`WebSocket subscription established with ID: ${subscriptionId}`, "success");
  formatLog("Monitoring for new tokens in real-time (no historical data loaded)", "info");
  formatLog("Press Ctrl+C to stop the test", "info");
  
  // Keep the process running
  process.on('SIGINT', async () => {
    formatLog("Stopping WebSocket monitoring...", "info");
    try {
      await connection.removeOnLogsListener(subscriptionId);
      formatLog(`WebSocket subscription removed: ${subscriptionId}`, "info");
      process.exit(0);
    } catch (error) {
      formatLog(`Error stopping monitoring: ${error.message}`, "error");
      process.exit(1);
    }
  });
}

// Run the test
testOptimizedWebSocketMonitoring().catch(error => {
  formatLog(`Test failed: ${error.message}`, "error");
  process.exit(1);
});
