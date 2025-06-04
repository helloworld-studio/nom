import React, { useState, useEffect, useMemo } from 'react';
import { TxVersion, Curve, getPdaLaunchpadPoolId, PlatformConfig } from '@raydium-io/raydium-sdk-v2';
import { PublicKey, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import { toast } from 'react-toastify';
import { initSdk } from '../config';
import axios from 'axios';
import { VersionedTransaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSpring, animated } from '@react-spring/web';

const RAYDIUM_LAUNCHPAD_PROGRAM_ID = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";

const NOM_TOKEN_MINT = "2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk";
const NOM_POOL_ID = "949rM1nZto1ZGYP5Mxwrfvwhr5CxRbVTsHaCL9S73pLu";

const SwapComponent = ({ tokenMint, tokenName, tokenSymbol, onClose }) => {
    const { publicKey, connected, signTransaction, signAllTransactions } = useWallet();
    
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [balance, setBalance] = useState(0);
    const [hasRequiredToken, setHasRequiredToken] = useState(false);
    const [slippage, setSlippage] = useState(1);
    const [customSlippage, setCustomSlippage] = useState('');
    const [showCustomSlippage, setShowCustomSlippage] = useState(false);

    const [fixedTokenData] = useState({
        mint: tokenMint,
        name: tokenName,
        symbol: tokenSymbol
    });

    const [quickBuyAmount, setQuickBuyAmount] = useState('0.1');

    // Create connection instance using useMemo to avoid recreation on every render
    const connection = useMemo(() => 
        new Connection(process.env.REACT_APP_RPC_URL),
        [] // Empty dependency array as the RPC URL is constant
    );

    // Add animation spring
    const slideAnimation = useSpring({
        from: { 
            transform: 'translate(-150%, -50%)',
            opacity: 0 
        },
        to: { 
            transform: 'translate(-50%, -50%)',
            opacity: 1 
        },
        config: {
            tension: 120,
            friction: 20,
            mass: 1
        }
    });

    useEffect(() => {
        const fetchBalance = async () => {
            if (publicKey) {
                const balance = await connection.getBalance(publicKey);
                setBalance(balance / LAMPORTS_PER_SOL);
            }
        };
        fetchBalance();
    }, [publicKey, connection]);

    useEffect(() => {
        const checkRequiredToken = async () => {
            if (!publicKey) return;
            
            try {
                const requiredTokenMint = new PublicKey('2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk');
                
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                    publicKey,
                    {
                        mint: requiredTokenMint
                    }
                );

                if (!tokenAccounts?.value?.length) {
                    console.log('No token accounts found');
                    setHasRequiredToken(false);
                    return;
                }

                const requiredToken = tokenAccounts.value.find(account => 
                    account.account.data.parsed.info.tokenAmount.amount > 0
                );

                setHasRequiredToken(!!requiredToken);

            } catch (error) {
                console.error('Error checking required token:', error);
                setHasRequiredToken(false);
            }
        };

        checkRequiredToken();
    }, [publicKey, connection]);

    useEffect(() => {
        const handleWalletChange = async () => {
            console.log('Wallet state changed:', { connected, publicKey: publicKey?.toString() });
            
            // Reset states when wallet disconnects
            if (!connected || !publicKey) {
                setBalance(0);
                setHasRequiredToken(false);
                setFromAmount('');
                setToAmount('');
                return;
            }

            // Refresh balances and token check when wallet changes
            try {
                // Update SOL balance
                const balance = await connection.getBalance(publicKey);
                setBalance(balance / LAMPORTS_PER_SOL);

                // Check for required token
                const requiredTokenMint = new PublicKey('2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk');
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                    publicKey,
                    {
                        mint: requiredTokenMint
                    }
                );

                if (!tokenAccounts?.value?.length) {
                    setHasRequiredToken(false);
                    return;
                }

                const requiredToken = tokenAccounts.value.find(account => 
                    account.account.data.parsed.info.tokenAmount.amount > 0
                );

                setHasRequiredToken(!!requiredToken);

            } catch (error) {
                console.error('Error updating wallet state:', error);
                setHasRequiredToken(false);
            }
        };

        handleWalletChange();

    }, [connected, publicKey, connection]); // Dependencies include wallet state changes

    const getPoolId = async (raydium, mintA, mintB) => {
        if (mintA.toString() === NOM_TOKEN_MINT) {
            return new PublicKey(NOM_POOL_ID);
        }
        return getPdaLaunchpadPoolId(new PublicKey(RAYDIUM_LAUNCHPAD_PROGRAM_ID), mintA, mintB).publicKey;
    };

    const calculateSwap = async (inputAmount, fromToken, toToken) => {
        setToAmount('');
        if (!fixedTokenData.mint || inputAmount <= 0) {
            console.log("Calculation skipped: Invalid input amount or tokenMint missing");
            return;
        }

        try {
            const raydium = await initSdk();
            const mintA = new PublicKey(fixedTokenData.mint);
            const mintB = NATIVE_MINT;
            const inAmount = new BN(Math.floor(inputAmount * LAMPORTS_PER_SOL));
            const slippageBasisPoints = getSlippageBasisPoints();

            const poolId = await getPoolId(raydium, mintA, mintB);
            console.log("Pool ID:", poolId.toString());
            
            const poolInfo = await raydium.launchpad.getRpcPoolInfo({ poolId });
            if (!poolInfo) {
                toast.error('Could not get pool info for this token.');
                return;
            }


            // Log pool info without modifying it
            console.log("Pool Info:", {
                status: poolInfo.status,
                curveType: poolInfo.configInfo.curveType,
                supply: poolInfo.supply.toString(),
                realA: poolInfo.realA.toString(),
                realB: poolInfo.realB.toString(),
                virtualA: poolInfo.virtualA.toString(),
                virtualB: poolInfo.virtualB.toString(),
                tradeFeeRate: poolInfo.configInfo.tradeFeeRate.toString(),
                platformFee: poolInfo.platformFee.toString()
            });

            // === STEP 1: DEBUGGING PLATFORM CONFIG ===
            console.log('=== DEBUGGING PLATFORM CONFIG ===');
            try {
                const data = await raydium.connection.getAccountInfo(poolInfo.platformId);
                if (data) {
                    const platformInfo = PlatformConfig.decode(data.data);
                    console.log('Official platformInfo.feeRate:', platformInfo.feeRate.toString());
                    console.log('Current poolInfo.platformFee:', poolInfo.platformFee.toString());
                    console.log('Are they equal?', platformInfo.feeRate.eq(poolInfo.platformFee));
                    
                    // Store for later use in testing
                    window.debugPlatformInfo = platformInfo;
                } else {
                    console.log('No platform account data found');
                }
            } catch (e) {
                console.log('Platform config decode error:', e);
            }

            // === STEP 2: POOL VALIDATION ===
            console.log('=== POOL VALIDATION ===');
            console.log('Pool status:', poolInfo.status);
            console.log('Pool mintA:', poolInfo.mintA.toString());
            console.log('Pool mintB:', poolInfo.mintB.toString());
            console.log('Expected mintA:', fixedTokenData.mint);
            console.log('Expected mintB:', NATIVE_MINT.toString());
            console.log('Pool platformId:', poolInfo.platformId.toString());

            // === STEP 3: POOL DIRECTION CHECK ===
            console.log('=== POOL DIRECTION CHECK ===');
            console.log('mintA (token):', poolInfo.mintA.toString());
            console.log('mintB (should be SOL):', poolInfo.mintB.toString());
            console.log('NATIVE_MINT:', NATIVE_MINT.toString());
            console.log('Is mintB actually SOL?', poolInfo.mintB.equals(NATIVE_MINT));
            console.log('Input amount (lamports):', inAmount.toString());
            console.log('Input amount (SOL):', inAmount.div(new BN(LAMPORTS_PER_SOL)).toString());
            console.log('Pool SOL reserves:', poolInfo.realB.toString());
            console.log('Pool token reserves:', poolInfo.realA.toString());

            // Test with official parameters (Step 2 from our plan)
            if (window.debugPlatformInfo) {
                console.log('=== TESTING WITH OFFICIAL PARAMETERS ===');
                try {
                    const shareFeeRate = new BN(10000); // As per docs
                    
                    const officialRes = Curve.buyExactIn({
                        poolInfo,
                        amountB: inAmount,
                        protocolFeeRate: poolInfo.configInfo.tradeFeeRate,
                        platformFeeRate: window.debugPlatformInfo.feeRate, // Use decoded platform fee
                        curveType: poolInfo.configInfo.curveType,
                        shareFeeRate, // Use proper share fee rate
                    });
                    
                    console.log('Official calculation result:', {
                        inputAmount: inAmount.toString(),
                        outputAmount: officialRes.amountA.toString(),
                        isNegative: officialRes.amountA.isNeg()
                    });
                    
                    // If official calculation works, we found the issue!
                    if (!officialRes.amountA.isNeg() && !officialRes.amountA.isZero()) {
                        console.log('🎉 OFFICIAL PARAMETERS WORK! The issue is with platform fee or share fee rate.');
                    }
                } catch (officialError) {
                    console.log('Official calculation also failed:', officialError);
                }
            }


            const result = Curve.buyExactIn({
                poolInfo,
                amountB: inAmount,
                protocolFeeRate: poolInfo.configInfo.tradeFeeRate,
                platformFeeRate: window.debugPlatformInfo.feeRate,
                curveType: poolInfo.configInfo.curveType,
                shareFeeRate: new BN(10000),
                slippageTolerance: slippageBasisPoints  // Add this line
            });
            
            // Only check if calculation succeeded
            if (!result || !result.amountA) {
                console.error("Calculation result invalid", result);
                toast.error('Calculation failed.');
                return;
            }
            
            // Proceed with the swap since liquidity is guaranteed by design
            if (result.amountA.isNeg()) {
                console.error("Negative calculation result", result.amountA.toString());
                toast.error('Insufficient liquidity for this swap amount.');
                return;
            }

            const decimals = poolInfo.mintDecimalsA;
            const divisor = new Decimal(10).pow(decimals);
            
            const expectedAmount = new Decimal(result.amountA.toString())
                .div(divisor)
                .toFixed(decimals);

            console.log("Final amount:", expectedAmount);
            setToAmount(expectedAmount);

        } catch (error) {
            console.error('Error calculating swap:', error);
            toast.error(`Calculation Error: ${error.message || 'Failed to calculate swap amount'}`);
            setToAmount('');
        }
    };

    const handleFromAmountChange = (value) => {
        setFromAmount(value);
        if (value && !isNaN(value)) {
            calculateSwap(parseFloat(value));
        } else {
            setToAmount('');
        }
    };

    const handleSlippageChange = (value) => {
        setSlippage(value);
        setShowCustomSlippage(value === 'custom');
        if (value !== 'custom') {
            setCustomSlippage('');
        }
    };

    const handleCustomSlippageChange = (value) => {
        const parsedValue = parseFloat(value);
        if (value === '' || (!isNaN(parsedValue) && parsedValue >= 0.01 && parsedValue <= 50)) {
            setCustomSlippage(value);
        }
    };

    const getSlippageBasisPoints = () => {
        if (slippage === 'custom' && customSlippage) {
            return new BN(Math.floor(parseFloat(customSlippage) * 100 * 100));
        }
        return new BN(slippage * 100 * 100);
    };

    const handleSwap = async () => {
        if (isLoading || !fromAmount || !publicKey) {
            toast.error('Wallet not connected or invalid amount');
            return;
        }
        setIsLoading(true);

        try {
            const wallet = {
                publicKey: publicKey,
                signTransaction,
                signAllTransactions
            };

            const raydium = await initSdk();
            raydium.setOwner(wallet.publicKey);

            const mintA = new PublicKey(fixedTokenData.mint);
            const mintB = NATIVE_MINT;
            const inAmount = new BN(Math.floor(parseFloat(fromAmount) * LAMPORTS_PER_SOL));
            const slippageBasisPoints = getSlippageBasisPoints();
            
            const poolId = await getPoolId(raydium, mintA, mintB);
            console.log("Swap Pool ID:", poolId.toString());
            
            const poolInfo = await raydium.launchpad.getRpcPoolInfo({ poolId });
            console.log("Swap Pool Info:", poolInfo);
            
            if (!poolInfo || !poolInfo.configInfo) {
                toast.error('Could not retrieve complete pool configuration for swap.');
                return;
            }

            // Use poolInfo directly without transformation
            const { transaction, execute } = await raydium.launchpad.buyToken({
                programId: new PublicKey(RAYDIUM_LAUNCHPAD_PROGRAM_ID),
                mintA,
                slippage: slippageBasisPoints,
                configInfo: poolInfo.configInfo,
                platformFeeRate: poolInfo.platformFee,
                txVersion: TxVersion.V0,
                buyAmount: inAmount,
                skipPreflight: false,
            });

            try {
                console.log('Attempting to execute transaction...');
                const result = await execute({ 
                    sendAndConfirm: true,
                    wallet: wallet // Pass wallet object explicitly
                });
                console.log('Swap executed:', result);
            } catch (executeError) {
                console.log('Falling back to manual transaction sending:', executeError);
                const signedTransaction = await signTransaction(transaction);
                const signature = await connection.sendRawTransaction(signedTransaction.serialize());
                await connection.confirmTransaction(signature, "confirmed");
            }
            
            toast.success('Swap successful!');
            
            if (publicKey) {
                const updatedBalance = await connection.getBalance(publicKey);
                setBalance(updatedBalance / LAMPORTS_PER_SOL);
            }
            
            onClose();
        } catch (error) {
            console.error('Swap error:', error);
            toast.error(error.message || 'Failed to complete swap');
        } finally {
            setIsLoading(false);
        }
    };

    const truncateAddress = (address) => {
        if (!address) return "";
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    const incrementAmount = () => {
        const currentVal = parseFloat(fromAmount) || 0;
        const newVal = (Math.round((currentVal + 0.1) * 10) / 10).toFixed(1); // Round to 1 decimal place
        handleFromAmountChange(newVal);
    };

    const decrementAmount = () => {
        const currentVal = parseFloat(fromAmount) || 0;
        if (currentVal >= 0.1) {
            const newVal = (Math.round((currentVal - 0.1) * 10) / 10).toFixed(1); // Round to 1 decimal place
            handleFromAmountChange(newVal);
        }
    };

    const incrementQuickBuyAmount = () => {
        const currentVal = parseFloat(quickBuyAmount) || 0;
        const newVal = (Math.round((currentVal + 0.1) * 10) / 10).toFixed(1);
        setQuickBuyAmount(newVal);
    };

    const decrementQuickBuyAmount = () => {
        const currentVal = parseFloat(quickBuyAmount) || 0;
        if (currentVal >= 0.1) {
            const newVal = (Math.round((currentVal - 0.1) * 10) / 10).toFixed(1);
            setQuickBuyAmount(newVal);
        }
    };

    const handleQuickBuyAmountChange = (value) => {
        if (value === '' || (!isNaN(value) && value >= 0)) {
            setQuickBuyAmount(value);
        }
    };

    const buyNomToken = async () => {
        if (!publicKey || !signTransaction) {
            toast.error('Please connect your wallet first');
            return;
        }

        setIsLoading(true);
        try {
            const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
            const outputMint = '2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk'; // NOM
            const amount = Math.floor(parseFloat(quickBuyAmount) * LAMPORTS_PER_SOL);
            const slippageBps = 100; // 1%
            const txVersion = 'V0';
            
            const quoteResponse = await axios.get(
                `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=${txVersion}`
            );
            
            const txResponse = await axios.post('https://transaction-v1.raydium.io/transaction/swap-base-in', {
                computeUnitPriceMicroLamports: '100',
                swapResponse: quoteResponse.data,
                txVersion,
                wallet: publicKey.toString(),
                wrapSol: true,
                unwrapSol: false,
            });
            
            const txBuffer = Buffer.from(txResponse.data.data[0].transaction, 'base64');
            const transaction = VersionedTransaction.deserialize(txBuffer);
            
            const signedTx = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTx.serialize());
            
            await connection.confirmTransaction(signature);
            
            toast.success('NOM token purchase sent!');
            
        } catch (error) {
            console.error('Error buying NOM token:', error);
            toast.error(`Failed to buy NOM: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!connected) {
        return (
            <div className="swap-container">
                <animated.div className="swap-box" style={slideAnimation}>
                    <p>Please connect your wallet to use the swap feature.</p>
                    <WalletMultiButton />
                    <button className="close-button" onClick={onClose}>Close</button>
                </animated.div>
            </div>
        );
    }

    return (
        <div className="swap-container">
            {!hasRequiredToken ? (
                <div className="swap-box">
                    <div className="error-message">
                        <h3>Access Restricted</h3>
                        <div className="error-content">
                            <p>To use this swap feature, you need to hold the required $NOM token in your wallet:</p>
                            <div className="token-info">
                                <span className="token-label">Required Token:</span>
                                <a 
                                    href={`https://letsbonk.fun/token/2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="token-address"
                                >
                                    2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk
                                </a>
                            </div>
                            <div className="quick-buy-section">
                                <div className="amount-input-container">
                                    <div className="amount-controls">
                                        <button 
                                            className="amount-control-btn"
                                            onClick={decrementQuickBuyAmount}
                                            disabled={isLoading}
                                        >
                                            -
                                        </button>
                                        <input
                                            type="text"
                                            value={quickBuyAmount}
                                            onChange={(e) => handleQuickBuyAmountChange(e.target.value)}
                                            className="quick-buy-input"
                                            placeholder="0.0"
                                            disabled={isLoading}
                                        />
                                        <button 
                                            className="amount-control-btn"
                                            onClick={incrementQuickBuyAmount}
                                            disabled={isLoading}
                                        >
                                            +
                                        </button>
                                    </div>
                                    <span className="currency-label">SOL</span>
                                </div>
                                <button 
                                    className="quick-buy-button"
                                    onClick={buyNomToken}
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Processing..." : `Buy ${quickBuyAmount} SOL of $NOM`}
                                </button>
                            </div>
                        </div>
                    </div>
                    <button className="close-button" onClick={onClose}>Close</button>
                </div>
            ) : (
                <div className="swap-box">
                    <div className="input-group">
                        <label>From</label>
                        <div className="amount-input">
                            <input
                                type="number"
                                value={fromAmount}
                                onChange={(e) => handleFromAmountChange(e.target.value)}
                                placeholder="0.0"
                                step="0.1"
                                min="0"
                            />
                            <div className="custom-amount-controls">
                                <button className="amount-control-btn" onClick={incrementAmount}>+</button>
                                <button className="amount-control-btn" onClick={decrementAmount}>−</button>
                            </div>
                            <div className="currency-info">
                                <span className="currency-symbol">👽</span> 
                                <span className="currency-name">SOL</span>
                            </div>
                        </div>
                        <div className="balance">Balance: {balance.toFixed(4)} SOL</div>
                    </div>

                    <div className="swap-arrow">↓</div>

                    <div className="input-group">
                        <label>To (Estimate)</label>
                        <div className="amount-input">
                            <input
                                type="text"
                                value={toAmount}
                                readOnly
                                placeholder="0.0"
                                className="to-amount-input"
                            />
                            <div className="currency-info">
                                <span className="currency-symbol">{fixedTokenData.symbol}</span>
                                <span className="currency-name">{fixedTokenData.name}</span>
                                <a 
                                    href={`https://letsbonk.fun/token/${fixedTokenData.mint}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="currency-mint"
                                >
                                    ({truncateAddress(fixedTokenData.mint)})
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="slippage-settings">
                        <label>Slippage Tolerance</label>
                        <div className="slippage-options">
                            <button 
                                className={`slippage-option ${slippage === 0.1 ? 'active' : ''}`}
                                onClick={() => handleSlippageChange(0.1)}
                            >
                                0.1%
                            </button>
                            <button 
                                className={`slippage-option ${slippage === 0.5 ? 'active' : ''}`}
                                onClick={() => handleSlippageChange(0.5)}
                            >
                                0.5%
                            </button>
                            <button 
                                className={`slippage-option ${slippage === 1 ? 'active' : ''}`}
                                onClick={() => handleSlippageChange(1)}
                            >
                                1%
                            </button>
                            <button 
                                className={`slippage-option ${slippage === 'custom' ? 'active' : ''}`}
                                onClick={() => handleSlippageChange('custom')}
                            >
                                Custom
                            </button>
                        </div>
                        
                        {showCustomSlippage && (
                            <div className="custom-slippage">
                                <input
                                    type="text"
                                    value={customSlippage}
                                    onChange={(e) => handleCustomSlippageChange(e.target.value)}
                                    placeholder="Enter %"
                                />
                                <span className="percent-sign">%</span>
                            </div>
                        )}
                    </div>

                    <button 
                        className="swap-execute-button"
                        onClick={handleSwap}
                        disabled={isLoading || !fromAmount || !toAmount || parseFloat(toAmount) <= 0}
                    >
                        {isLoading ? "Swapping..." : "Swap"}
                    </button>
                    <button className="close-button" onClick={onClose}>Close</button>
                </div>
            )}
        </div>
    );
};

export default SwapComponent;
