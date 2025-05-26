/**
 * Backend application-wide constants
 * 
 * This file centralizes all program IDs, token addresses, and other
 * sensitive values that were previously hardcoded across the backend.
 * 
 * SECURITY NOTE: While these values are not strictly "secrets" since they
 * are visible on the blockchain, centralizing them improves maintainability
 * and reduces the risk of using incorrect addresses.
 */

// Program IDs
const PROGRAM_IDS = {
  RAYDIUM_LAUNCHPAD: "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
  LETSBONK: "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh",
  TOKEN_PROGRAM: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  ASSOCIATED_TOKEN_PROGRAM: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  METAPLEX: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
};

// Token addresses
const TOKEN_ADDRESSES = {
  NOM_TOKEN_MINT: "2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk",
  NATIVE_SOL: "So11111111111111111111111111111111111111112"
};

// Pool IDs
const POOL_IDS = {
  NOM_POOL: "949rM1nZto1ZGYP5Mxwrfvwhr5CxRbVTsHaCL9S73pLu"
};

// Time constants
const TIME_CONSTANTS = {
  NEW_TOKEN_WINDOW: 5 * 60, // 5 minutes in seconds
  RETRY_DELAY: 5000, // 5 seconds
  MAX_RETRIES: 3
};

module.exports = {
  PROGRAM_IDS,
  TOKEN_ADDRESSES,
  POOL_IDS,
  TIME_CONSTANTS
};
