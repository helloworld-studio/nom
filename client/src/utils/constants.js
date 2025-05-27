/**
 * Frontend application-wide constants
 * 
 * This file centralizes all program IDs, token addresses, and other
 * sensitive values that were previously hardcoded across the frontend.
 * 
 * SECURITY NOTE: While these values are not strictly "secrets" since they
 * are visible on the blockchain, centralizing them improves maintainability
 * and reduces the risk of using incorrect addresses.
 */

// Program IDs
export const PROGRAM_IDS = {
  RAYDIUM_LAUNCHPAD: "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
  TOKEN_PROGRAM: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  ASSOCIATED_TOKEN_PROGRAM: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  METAPLEX: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
};

// Token addresses
export const TOKEN_ADDRESSES = {
  NOM_TOKEN_MINT: "2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk",
  NATIVE_SOL: "So11111111111111111111111111111111111111112"
};

// Pool IDs
export const POOL_IDS = {
  NOM_POOL: "949rM1nZto1ZGYP5Mxwrfvwhr5CxRbVTsHaCL9S73pLu"
};

// Time constants
export const TIME_CONSTANTS = {
  RETRY_DELAY: 5000, // 5 seconds
  MAX_RETRIES: 3
};
