const { PublicKey } = require('@solana/web3.js');
const {
  LaunchpadPool,
  LaunchpadConfig,
  LAUNCHPAD_PROGRAM,
  getPdaLaunchpadPoolId,
  Curve,
} = require('@raydium-io/raydium-sdk-v2');

async function getBondingCurveProgress(connection, mint) {
  try {
    const mintPubkey = new PublicKey(mint);
    const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

    console.log(`\n🔍 Checking Launchpad pool for mint: ${mint}`);
    
    const result = await getPdaLaunchpadPoolId(
      LAUNCHPAD_PROGRAM,
      mintPubkey,
      WSOL
    );

    if (!result?.publicKey) {
      console.log(`❌ No WSOL pool found for mint: ${mint}`);
      return null;
    }

    const poolAccountInfo = await connection.getAccountInfo(result.publicKey);
    if (!poolAccountInfo) {
      console.log(`❌ No pool account info found for poolId: ${result.publicKey.toString()}`);
      return null;
    }

    const poolInfo = LaunchpadPool.decode(poolAccountInfo.data);

    // Map status codes to human readable format
    const statusMap = {
      0: 'UNINITIALIZED',
      1: 'UPCOMING',
      2: 'OPEN',
      3: 'ENDED'
    };

    // Get all the raw values
    const rawInfo = {
      baseDepositedAmount: poolInfo.baseDepositedAmount?.toString() || 'Not set',
      baseTargetAmount: poolInfo.baseTargetAmount?.toString() || 'Not set',
      status: statusMap[poolInfo.status] || `UNKNOWN(${poolInfo.status})`,
      startTime: poolInfo.startTime ? new Date(Number(poolInfo.startTime) * 1000).toLocaleString() : 'Not set',
      endTime: poolInfo.endTime ? new Date(Number(poolInfo.endTime) * 1000).toLocaleString() : 'Not set',
      mintA: poolInfo.mintA.toString(),
      mintB: poolInfo.mintB.toString(),
      mintDecimalsA: poolInfo.mintDecimalsA,
      mintDecimalsB: poolInfo.mintDecimalsB,
      poolId: result.publicKey.toString()
    };

    // Format the pool info in a more readable way
    console.log('📊 Pool Info:');
    console.log('  • Status:      ', rawInfo.status);
    console.log('  • Pool ID:     ', rawInfo.poolId);
    console.log('  • Token:       ', rawInfo.mintA, `(${rawInfo.mintDecimalsA} decimals)`);
    console.log('  • Paired with: ', rawInfo.mintB, `(${rawInfo.mintDecimalsB} decimals)`);
    console.log('  • Deposited:   ', rawInfo.baseDepositedAmount);
    console.log('  • Target:      ', rawInfo.baseTargetAmount);
    console.log('  • Start Time:  ', rawInfo.startTime);
    console.log('  • End Time:    ', rawInfo.endTime);

    // If pool is uninitialized, return that specific state
    if (poolInfo.status === 0) {
      return {
        status: 'UNINITIALIZED',
        poolId: result.publicKey.toString(),
        progress: '0.00',
        currentSupply: '0',
        totalSupply: '0'
      };
    }

    // Only try to get price and progress if pool is initialized
    const configData = await connection.getAccountInfo(poolInfo.configId);
    if (!configData) {
      console.log(`❌ No config data found for configId: ${poolInfo.configId.toString()}`);
      return null;
    }

    const configInfo = LaunchpadConfig.decode(configData.data);
    
    const poolPrice = Curve.getPrice({
      poolInfo,
      curveType: configInfo.curveType,
      decimalA: poolInfo.mintDecimalsA,
      decimalB: poolInfo.mintDecimalsB,
    }).toNumber();

    // Convert from lamports to SOL for display
    const baseDeposited = poolInfo.baseDepositedAmount ? 
      Number(poolInfo.baseDepositedAmount.toString()) / 1e9 : 0;
    const baseTarget = poolInfo.baseTargetAmount ? 
      Number(poolInfo.baseTargetAmount.toString()) / 1e9 : 0;
    
    const progress = baseTarget > 0 ? (baseDeposited / baseTarget) * 100 : 0;

    console.log(`  • Progress:    ${progress.toFixed(2)}% (${baseDeposited.toFixed(4)} / ${baseTarget.toFixed(4)} SOL)`);
    console.log(`  • Price:       ${poolPrice.toFixed(9)} SOL`);

    return {
      status: statusMap[poolInfo.status],
      progress: progress.toFixed(2),
      currentSupply: baseDeposited.toFixed(9),
      totalSupply: baseTarget.toFixed(9),
      poolId: result.publicKey.toString(),
      poolPrice: poolPrice.toFixed(20),
      startTime: rawInfo.startTime,
      endTime: rawInfo.endTime
    };

  } catch (error) {
    console.error('❌ Error getting bonding curve progress:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return null;
  }
}

module.exports = {
  getBondingCurveProgress
};
