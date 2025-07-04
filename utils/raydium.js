const { PublicKey } = require('@solana/web3.js');
const {
  LaunchpadPool,
  LaunchpadConfig,
  LAUNCHPAD_PROGRAM,
  getPdaLaunchpadPoolId,
  Curve,
} = require('@raydium-io/raydium-sdk-v2');
const axios = require('axios');

async function getBondingCurveProgress(connection, mint) {
  try {
    // Use the correct Dexscreener API endpoint for Solana pairs
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/solana/${mint}`);
    
    if (!response.data || !response.data.pairs || response.data.pairs.length === 0) {
      console.log(`❌ No pair data found on Dexscreener for mint: ${mint}`);
      return {
        progress: "0.00",
        dexscreenerUrl: `https://dexscreener.com/solana/${mint}`,
        liquidity: 0,
        graduationTarget: 61830.99
      };
    }

    const pair = response.data.pairs[0];
    const liquidity = pair.liquidity?.usd || 0;
    
    // Use the specific graduation target
    const graduationTarget = 61830.99; // $61,830.99 USD
    
    // Calculate progress as a percentage of the graduation target
    const progress = Math.min((liquidity / graduationTarget) * 100, 100).toFixed(2);
    
    console.log(`✅ Bonding curve data for ${mint}:`);
    console.log(`   Liquidity: $${liquidity}`);
    console.log(`   Progress: ${progress}%`);
    
    return {
      progress,
      dexscreenerUrl: `https://dexscreener.com/solana/${mint}`,
      liquidity,
      graduationTarget
    };

  } catch (error) {
    console.error('❌ Error getting bonding curve progress:', error.message);
    return {
      progress: "0.00",
      dexscreenerUrl: `https://dexscreener.com/solana/${mint}`,
      liquidity: 0,
      graduationTarget: 61830.99
    };
  }
}

module.exports = {
  getBondingCurveProgress
};
