require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');

// Constants
const LETSBONK_PROGRAM_ID = "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh";
const RPC_ENDPOINT = process.env.RPC_URL;

if (!RPC_ENDPOINT) {
  console.error("RPC_URL environment variable is not set. Please set it in your .env file.");
  process.exit(1);
}

console.log(`Using RPC endpoint: ${RPC_ENDPOINT}`);

// Create connection
const connection = new Connection(RPC_ENDPOINT, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000,
});

// Utility function for logging with timestamp
function formatLog(message, level = "info") {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logMessage);
  return logMessage;
}

// Test WebSocket subscription
async function testWebSocketSubscription() {
  formatLog("Starting WebSocket test...", "info");
  
  // First, get some recent transactions to compare with
  formatLog("Fetching recent transactions for reference...", "info");
  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(LETSBONK_PROGRAM_ID),
    { limit: 5 },
    "confirmed"
  );
  
  if (signatures.length > 0) {
    formatLog(`Found ${signatures.length} recent transactions:`, "info");
    signatures.forEach((sig, i) => {
      formatLog(`${i+1}. ${sig.signature} (${new Date(sig.blockTime * 1000).toLocaleString()})`, "info");
    });
  } else {
    formatLog("No recent transactions found", "warning");
  }
  
  // Set up WebSocket subscription
  formatLog("Setting up WebSocket subscription...", "info");
  
  // Track subscription events
  let eventCount = 0;
  const startTime = Date.now();
  
  // Subscribe to program account changes
  const subscriptionId = connection.onProgramAccountChange(
    new PublicKey(LETSBONK_PROGRAM_ID),
    (accountInfo, context) => {
      eventCount++;
      
      formatLog(`WebSocket event #${eventCount} received:`, "success");
      formatLog(`├─ Slot: ${context.slot}`, "info");
      formatLog(`├─ Account: ${accountInfo.accountId.toString()}`, "info");
      formatLog(`├─ Owner: ${accountInfo.accountInfo.owner.toString()}`, "info");
      formatLog(`├─ Data Length: ${accountInfo.accountInfo.data.length} bytes`, "info");
      formatLog(`└─ Executable: ${accountInfo.accountInfo.executable}`, "info");
      
      // Get recent signatures for this account to see what transaction triggered this
      setTimeout(async () => {
        try {
          const recentSigs = await connection.getSignaturesForAddress(
            accountInfo.accountId,
            { limit: 1 },
            "confirmed"
          );
          
          if (recentSigs && recentSigs.length > 0) {
            formatLog(`Recent transaction for this account: ${recentSigs[0].signature}`, "info");
            
            // Get transaction details
            const tx = await connection.getParsedTransaction(recentSigs[0].signature, {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed"
            });
            
            if (tx && tx.meta && tx.meta.postTokenBalances) {
              formatLog(`Transaction has ${tx.meta.postTokenBalances.length} token balances`, "info");
              
              // Look for potential token mints
              tx.meta.postTokenBalances.forEach(balance => {
                if (balance.mint) {
                  formatLog(`Found token mint: ${balance.mint}`, "info");
                  
                  // Check if it's a LetsBonk token (ends with "bonk")
                  if (balance.mint.toLowerCase().endsWith("bonk")) {
                    formatLog(`This appears to be a LetsBonk token: ${balance.mint}`, "success");
                  }
                }
              });
            }
          }
        } catch (error) {
          formatLog(`Error fetching transaction details: ${error.message}`, "error");
        }
      }, 1000); // Small delay to ensure transaction is available
    },
    "confirmed"
  );
  
  formatLog(`WebSocket subscription established with ID: ${subscriptionId}`, "success");
  
  // Keep the process running
  formatLog("Test is running. Waiting for WebSocket events...", "info");
  formatLog("Press Ctrl+C to stop the test", "info");
  
  // Check if we're receiving events periodically
  const checkInterval = setInterval(() => {
    const runningTime = Math.floor((Date.now() - startTime) / 1000);
    formatLog(`Test has been running for ${runningTime} seconds with ${eventCount} events received`, "info");
    
    // If no events after 60 seconds, try to fetch some recent transactions to see if there's activity
    if (eventCount === 0 && runningTime > 60 && runningTime % 60 === 0) {
      formatLog("No events received yet. Checking for recent program activity...", "info");
      
      connection.getSignaturesForAddress(
        new PublicKey(LETSBONK_PROGRAM_ID),
        { limit: 3 },
        "confirmed"
      ).then(recentSigs => {
        if (recentSigs.length > 0) {
          formatLog(`There is recent program activity (${recentSigs.length} transactions)`, "info");
          recentSigs.forEach((sig, i) => {
            formatLog(`${i+1}. ${sig.signature} (${new Date(sig.blockTime * 1000).toLocaleString()})`, "info");
          });
        } else {
          formatLog("No recent program activity detected", "warning");
        }
      }).catch(err => {
        formatLog(`Error checking recent activity: ${err.message}`, "error");
      });
    }
  }, 30000); // Check every 30 seconds
  
  // Alternative approach: Also set up a transaction subscription as a backup
  formatLog("Setting up additional transaction subscription for the program...", "info");
  
  const txSubscriptionId = connection.onLogs(
    new PublicKey(LETSBONK_PROGRAM_ID),
    (logs, context) => {
      formatLog(`Transaction log event received:`, "success");
      formatLog(`├─ Slot: ${context.slot}`, "info");
      formatLog(`├─ Signature: ${logs.signature}`, "info");
      formatLog(`└─ Logs: ${logs.logs.length} entries`, "info");
      
      // Process the transaction to see if it contains token creation
      setTimeout(async () => {
        try {
          const tx = await connection.getParsedTransaction(logs.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed"
          });
          
          if (tx && tx.meta && tx.meta.postTokenBalances) {
            formatLog(`Transaction has ${tx.meta.postTokenBalances.length} token balances`, "info");
            
            // Look for potential token mints
            tx.meta.postTokenBalances.forEach(balance => {
              if (balance.mint) {
                formatLog(`Found token mint: ${balance.mint}`, "info");
                
                // Check if it's a LetsBonk token (ends with "bonk")
                if (balance.mint.toLowerCase().endsWith("bonk")) {
                  formatLog(`This appears to be a LetsBonk token: ${balance.mint}`, "success");
                }
              }
            });
          }
        } catch (error) {
          formatLog(`Error fetching transaction details: ${error.message}`, "error");
        }
      }, 1000); // Small delay to ensure transaction is available
    },
    "confirmed"
  );
  
  formatLog(`Transaction log subscription established with ID: ${txSubscriptionId}`, "success");
  
  // Handle cleanup on process exit
  process.on('SIGINT', async () => {
    formatLog("Cleaning up subscriptions...", "info");
    
    try {
      await connection.removeAccountChangeListener(subscriptionId);
      formatLog(`Removed account change subscription: ${subscriptionId}`, "info");
      
      await connection.removeOnLogsListener(txSubscriptionId);
      formatLog(`Removed transaction log subscription: ${txSubscriptionId}`, "info");
      
      clearInterval(checkInterval);
      formatLog(`Test completed. Received ${eventCount} WebSocket events.`, "info");
    } catch (error) {
      formatLog(`Error during cleanup: ${error.message}`, "error");
    }
    
    process.exit(0);
  });
}

// Run the test
testWebSocketSubscription().catch(error => {
  formatLog(`Error in test: ${error.message}`, "error");
  process.exit(1);
});
