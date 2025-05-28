const { PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { getBondingCurveProgress } = require('../utils/raydium');
const axios = require("axios");

const RAYDIUM_LAUNCHPAD_PROGRAM_ID = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const LETSBONK_PROGRAM_ID = "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh";
const NEW_TOKEN_WINDOW = 5 * 60; 

class TokenMonitor {
  constructor(connection, metaplex) {
    this.connection = connection;
    this.metaplex = metaplex;
    this.processedTransactions = new Set();
    this.knownTokens = new Set();
    this.allTokensData = new Map();
    this.metadataCache = new Map();
    this.latestTransaction = null;
    this.latestTokenData = null;
    this.subscriptionId = null;
    this.isMonitoring = false;
    this.startTime = Math.floor(Date.now() / 1000);

    this.RAYDIUM_LAUNCHPAD_PROGRAM_ID = RAYDIUM_LAUNCHPAD_PROGRAM_ID;
    this.LETSBONK_PROGRAM_ID = LETSBONK_PROGRAM_ID;
    this.NEW_TOKEN_WINDOW = NEW_TOKEN_WINDOW;
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 5000; // 5 seconds
  }

  formatLog(message, level = "info") {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage);
    return logMessage;
  }

  async extractMetadataFromTransaction(tx) {
    try {
      const metaplexInstruction = tx.transaction.message.instructions.find(
        ix => ix.programId.toString() === "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
      );

      if (!metaplexInstruction || !metaplexInstruction.data) {
        return null;
      }

      const dataStr = metaplexInstruction.data;
      
      const nameMatch = dataStr.match(/"name":"([^"]+)"/);
      const symbolMatch = dataStr.match(/"symbol":"([^"]+)"/);
      const uriMatch = dataStr.match(/"uri":"([^"]+)"/);

      const metadata = {
        name: nameMatch ? nameMatch[1] : null,
        symbol: symbolMatch ? symbolMatch[1] : null,
        uri: uriMatch ? uriMatch[1] : null,
        website: null,
        twitter: null,
        telegram: null
      };

      if (metadata.uri) {
        try {
          const response = await axios.get(metadata.uri);
          const extraData = response.data;
          
          metadata.image = extraData.image || null;
          metadata.website = extraData.website || null;
          metadata.twitter = extraData.twitter || null;
          metadata.telegram = extraData.telegram || null;
          metadata.description = extraData.description || null;
          
          this.formatLog(`Successfully fetched extended metadata from URI`, "info");
        } catch (error) {
          this.formatLog(`Note: Could not fetch extended metadata from URI: ${error.message}`, "info");
        }
      }

      return metadata;
    } catch (error) {
      this.formatLog(`Note: No metadata in transaction: ${error.message}`, "info");
      return null;
    }
  }

  async verifyTokenWithLaunchpad(mintAddress) {
    const cacheKey = `launchpad_${mintAddress}`;
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey);
    }

    try {
      const tokenInfo = await this.connection.getParsedAccountInfo(new PublicKey(mintAddress));
      
      const isLaunchpad = tokenInfo?.value?.owner?.toString() === this.RAYDIUM_LAUNCHPAD_PROGRAM_ID;
      
      this.metadataCache.set(cacheKey, isLaunchpad);
      
      if (isLaunchpad) {
        this.formatLog(`Verified ${mintAddress} is on Raydium Launchpad`, "info");
        return true;
      }
      return false;
    } catch (error) {
      this.formatLog(`Error verifying token with Raydium: ${error.message}`, "error");
      this.metadataCache.set(cacheKey, false);
      return false;
    }
  }

  async getTokenMetadata(mintAddress) {
    if (this.metadataCache.has(mintAddress)) {
      return this.metadataCache.get(mintAddress);
    }

    return await this.retryOperation(async () => {
        try {
            const mintPublicKey = new PublicKey(mintAddress);
            const tokenMetadata = await this.metaplex.nfts().findByMint({
                mintAddress: mintPublicKey,
            });

            const metadata = {
                address: mintAddress,
                name: tokenMetadata?.name || "Unknown",
                symbol: tokenMetadata?.symbol || "Unknown",
                uri: tokenMetadata?.uri || null,
                image: null,
                metadata: {}
            };

            if (tokenMetadata?.uri) {
                try {
                    const response = await axios.get(tokenMetadata.uri, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'application/json, text/plain, */*'
                        }
                    });
                    const extraData = response.data;
                    metadata.image = extraData?.image || null;
                    metadata.metadata = {
                        description: extraData?.description || null,
                        website: extraData?.properties?.website || extraData?.website || null,
                        twitter: extraData?.properties?.twitter || extraData?.twitter || null,
                        telegram: extraData?.properties?.telegram || extraData?.telegram || null,
                    };
                    this.formatLog(`Successfully fetched metadata from URI for ${metadata.name}`, "info");
                } catch (uriError) {
                    let errorMsg = uriError.message;
                    if (uriError.response) {
                        errorMsg = `Status ${uriError.response.status}: ${uriError.response.statusText}`;
                    }
                    this.formatLog(`Metadata URI fetch failed for ${mintAddress} (${metadata.name}): ${errorMsg}`, "warning");
                }
            } else {
                this.formatLog(`No metadata URI found for ${mintAddress}`, "info");
            }

            this.metadataCache.set(mintAddress, metadata);
            return metadata;
        } catch (error) {
            this.formatLog(`Failed to fetch primary metadata for ${mintAddress}: ${error.message}`, "error");
            const fallbackMetadata = {
                address: mintAddress,
                name: "Unknown",
                symbol: "Unknown",
                uri: null,
                image: null,
                metadata: {}
            };
            this.metadataCache.set(mintAddress, fallbackMetadata);
            return fallbackMetadata;
        }
    });
  }

  getLatestTransaction() {
    return this.latestTransaction;
  }

  getLatestTokenData() {
    return this.latestTokenData;
  }

  async retryOperation(operation, retries = this.MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;
        this.formatLog(`Operation failed: ${error.message}. Retrying in ${this.RETRY_DELAY / 1000}s... (${i + 1}/${retries})`, "warning");
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      }
    }
  }

  // Method to check if token is from LetsBonk platform
  isLetsBonkToken(mintAddress) {
    return mintAddress.toLowerCase().endsWith('bonk');
  }

  async processTokenCreation(signature, tx, mintAddress, platform = "Raydium Launchpad") {
    try {
      // Add check to prevent duplicate processing
      if (this.allTokensData.has(mintAddress)) {
        this.formatLog(`Token ${mintAddress} already processed, skipping duplicate`, "info");
        return;
      }
      
      // Check if this is a LetsBonk token
      const isLetsBonk = this.isLetsBonkToken(mintAddress);
      const actualPlatform = isLetsBonk ? "LetsBonk" : "Raydium Launchpad";
      
      // Get basic token info from transaction
      let uiAmount = 0;
      for (const balance of tx.meta.postTokenBalances) {
        if (balance.mint === mintAddress) {
          if (balance.uiTokenAmount && balance.uiTokenAmount.uiAmount) {
            uiAmount = typeof balance.uiTokenAmount.uiAmount === 'string' ? 
              parseFloat(balance.uiTokenAmount.uiAmount) : 
              balance.uiTokenAmount.uiAmount;
          }
          break;
        }
      }
      
      const feeSol = tx.meta.fee ? tx.meta.fee / LAMPORTS_PER_SOL : 0;
      
      // Get metadata (this is the only RPC call we'll make)
      const fetchedMetadata = await this.getTokenMetadata(mintAddress);
      
      const tokenData = {
        id: signature,
        mint: mintAddress,
        name: fetchedMetadata.name || "Unknown",
        symbol: fetchedMetadata.symbol || "Unknown",
        platform: actualPlatform,
        isLetsBonk: isLetsBonk, // Add flag
        initialBuy: uiAmount,
        solAmount: feeSol,
        uri: fetchedMetadata.uri,
        image: fetchedMetadata.image,
        metadata: fetchedMetadata.metadata || {},
        transaction: {
          signature: signature,
          blockTime: tx.blockTime,
          slot: tx.slot
        }
      };

      // Try to get additional metadata from transaction itself (no RPC)
      const txMetadata = await this.extractMetadataFromTransaction(tx);
      if (txMetadata) {
        tokenData.name = txMetadata.name || tokenData.name;
        tokenData.symbol = txMetadata.symbol || tokenData.symbol;
        tokenData.uri = txMetadata.uri || tokenData.uri;
        tokenData.metadata.website = txMetadata.website || tokenData.metadata.website;
        tokenData.metadata.twitter = txMetadata.twitter || tokenData.metadata.twitter;
        tokenData.metadata.telegram = txMetadata.telegram || tokenData.metadata.telegram;
        tokenData.metadata.description = txMetadata.description || tokenData.metadata.description;
        tokenData.image = txMetadata.image || tokenData.image;
      }
      
      // Get creator from transaction
      if (tx.transaction?.message?.accountKeys) {
        const signers = tx.transaction.message.accountKeys
          .filter(key => key.signer)
          .map(key => key.pubkey.toString());
        
        if (signers.length > 0) {
          tokenData.creator = signers[0];
          this.formatLog(`├─ Creator: ${tokenData.creator}`, "info");
        }
      }

      // Enhanced logging with platform detection
      this.formatLog(`├─ Platform: ${actualPlatform} ${isLetsBonk ? '🎯' : ''}`, "info");
      this.formatLog(`├─ Name: ${tokenData.name}`, "info");
      this.formatLog(`├─ Symbol: ${tokenData.symbol}`, "info");
      this.formatLog(`├─ Initial Buy Amount: ${uiAmount}`, "info");
      this.formatLog(`├─ Transaction Fee: ${feeSol} SOL`, "info");
      if (tokenData.metadata.website) this.formatLog(`├─ Website: ${tokenData.metadata.website}`, "info");
      if (tokenData.metadata.twitter) this.formatLog(`├─ Twitter: ${tokenData.metadata.twitter}`, "info");
      if (tokenData.metadata.telegram) this.formatLog(`├─ Telegram: ${tokenData.metadata.telegram}`, "info");
      this.formatLog(`└─ Block Time: ${new Date(tx.blockTime * 1000).toLocaleString()}`, "info");
      
      // Set as latest token
      this.latestTokenData = tokenData;
      this.latestTransaction = tokenData;
      this.formatLog(`New latest token set: ${tokenData.name} (${tokenData.symbol}) - ${actualPlatform}`, "success");
      
      // Add line break after each token
      console.log(''); // Empty line for separation
      
      this.allTokensData.set(mintAddress, tokenData);
    } catch (tokenError) {
      this.formatLog(`Error processing token ${mintAddress}: ${tokenError.message}`, "error");
      console.log(''); // Empty line after errors too
    }
  }

  // Simplified filtering - only look for the actual token creation instruction
  isRaydiumTokenCreation(logs) {
    return logs.logs.some(log => 
      log.includes("Program log: Instruction: Initialize")
    );
  }

  // Simplified platform detection - since we're only monitoring Raydium Launchpad
  async identifyTokenPlatform(tx, mintAddress) {
    return "Raydium Launchpad";
  }

  async monitorTokens() {
    if (this.isMonitoring) {
      this.formatLog("Token monitoring is already running", "warning");
      return;
    }

    try {
      this.isMonitoring = true;
      this.formatLog("Starting Raydium Launchpad token monitoring...", "info");
      this.formatLog("🎯 Monitoring: All Raydium Launchpad tokens (LetsBonk + others)", "info");
      this.formatLog(`Monitoring start time: ${new Date(this.startTime * 1000).toLocaleString()}`, "info");

      this.subscriptionId = this.connection.onLogs(
        new PublicKey(this.RAYDIUM_LAUNCHPAD_PROGRAM_ID),
        async (logs, context) => {
          try {
            // Early exit if already processed
            if (this.processedTransactions.has(logs.signature)) {
              return;
            }
            
            // Early exit if not a token creation
            if (!this.isRaydiumTokenCreation(logs)) {
              return;
            }
            
            this.processedTransactions.add(logs.signature);
            
            const tx = await this.connection.getParsedTransaction(logs.signature, {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed"
            });
            
            if (!tx || !tx.blockTime || tx.blockTime < this.startTime) {
              return;
            }
            
            if (!tx.meta?.postTokenBalances?.length) {
              return;
            }
            
            // Find new tokens - simplified
            for (const balance of tx.meta.postTokenBalances) {
              if (!balance.mint || 
                  balance.mint === "So11111111111111111111111111111111111111112" ||
                  this.knownTokens.has(balance.mint)) {
                continue;
              }
              
              // Add to known tokens immediately to prevent duplicates
              this.knownTokens.add(balance.mint);
              
              // Check if it's a LetsBonk token for enhanced logging
              const isLetsBonk = this.isLetsBonkToken(balance.mint);
              const tokenType = isLetsBonk ? "LetsBonk" : "Other Raydium";
              
              this.formatLog(`🎉 NEW ${tokenType.toUpperCase()} TOKEN CREATED!`, "success");
              this.formatLog(`├─ Mint Address: ${balance.mint}`, "info");
              this.formatLog(`├─ Transaction: ${logs.signature}`, "info");
              this.formatLog(`├─ Created: ${new Date(tx.blockTime * 1000).toLocaleString()}`, "info");
              
              await this.processTokenCreation(logs.signature, tx, balance.mint);
              
              // Process only the first new token per transaction to avoid spam
              break;
            }
            
          } catch (error) {
            this.formatLog(`Error processing transaction: ${error.message}`, "error");
          }
        },
        "confirmed"
      );

      this.formatLog("✅ Token monitoring started successfully", "success");
    } catch (error) {
      this.isMonitoring = false;
      this.formatLog(`Error starting token monitoring: ${error.message}`, "error");
      throw error;
    }
  }

  async stopMonitoring() {
    if (!this.isMonitoring) {
      this.formatLog("Token monitoring is not running", "warning");
      return;
    }
    
    if (this.subscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.subscriptionId);
        this.formatLog(`WebSocket subscription removed: ${this.subscriptionId}`, "info");
        this.subscriptionId = null;
        this.isMonitoring = false;
      } catch (error) {
        this.formatLog(`Error stopping token monitoring: ${error.message}`, "error");
      }
    }
  }

  clearCache() {
    this.metadataCache.clear();
    this.formatLog("Metadata cache cleared", "info");
  }

  getCacheStats() {
    return {
      metadataCacheSize: this.metadataCache.size,
      knownTokensSize: this.knownTokens.size,
      processedTransactionsSize: this.processedTransactions.size
    };
  }

  updateTokenSummary() {
    if (this.latestTokenData && this.latestTokenData.transaction && this.latestTokenData.transaction.blockTime) {
      const recentTokens = Array.from(this.knownTokens)
        .filter(mint => {
          const tokenData = this.allTokensData.get(mint);
          return tokenData && tokenData.transaction && tokenData.transaction.blockTime;
        })
        .map(mint => this.allTokensData.get(mint))
        .sort((a, b) => b.transaction.blockTime - a.transaction.blockTime);
      
      if (recentTokens.length > 0) {
        recentTokens.sort((a, b) => b.transaction.blockTime - a.transaction.blockTime);
        
        this.formatLog(`DEBUG - Most recent tokens by blockTime:`, "info");
        recentTokens.slice(0, 3).forEach((token, i) => {
          this.formatLog(`${i+1}. ${token.name} (${token.symbol}): ${token.transaction.blockTime}`, "info");
        });
        
        const chronologicalTokens = [...recentTokens].reverse();
        
        this.formatLog("------- TOKEN SUMMARY (CHRONOLOGICAL ORDER) -------", "info");
        chronologicalTokens.slice(0, 5).forEach((token, index) => {
          const date = new Date(token.transaction.blockTime * 1000).toLocaleString();
          this.formatLog(`${index + 1}. ${token.name} (${token.symbol}) - Created: ${date}`, "info");
        });
        this.formatLog("-------------------------------------------", "info");
      }
    }
    
    if (this.latestTokenData) {
      this.formatLog(`Latest token: ${this.latestTokenData.name} (${this.latestTokenData.symbol})`, "success");
    } else {
      this.formatLog("No tokens found in this check", "info");
    }
  }
}

module.exports = TokenMonitor;