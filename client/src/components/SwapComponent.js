// Clean up the imports - remove unused ones
import React, { useState, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { PublicKey, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'; // Remove NATIVE_MINT
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
// Remove Decimal, initSdk imports since we don't need them anymore
import { toast } from 'react-toastify';
import axios from 'axios';
import rpcService from '../services/RpcService';
import { TxVersion, Curve, PlatformConfig, getPdaLaunchpadPoolId } from '@raydium-io/raydium-sdk-v2';
import { NATIVE_MINT } from '@solana/spl-token';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import { initSdk } from '../config';

const RAYDIUM_LAUNCHPAD_PROGRAM_ID = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const NOM_TOKEN_MINT = "2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk";
const NOM_POOL_ID = "949rM1nZto1ZGYP5Mxwrfvwhr5CxRbVTsHaCL9S73pLu";

const SwapComponent = ({ tokenMint, tokenName, tokenSymbol, onClose, isWalletVerified, setIsWalletVerified }) => {
    const { publicKey, connected, signTransaction } = useWallet();
    
    // ... rest of your existing state variables ...
    const [error, setError] = useState(null);
    const [walletBalance, setWalletBalance] = useState(0);
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
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

    // Simplified verification effect
    useEffect(() => {
        if (connected && publicKey) {
            console.log('✅ Wallet connected, setting as verified');
            setIsWalletVerified(true);
            setError(null);
        } else if (!connected) {
            setIsWalletVerified(false);
        }
    }, [connected, publicKey, setIsWalletVerified]);

    // Update balance fetch to use the prop with enhanced logging
    useEffect(() => {
        const fetchSolBalance = async () => {
            if (publicKey && connected) {
                try {
                    console.log('🔍 Attempting to fetch SOL balance for:', publicKey.toString());
                    console.log('🔍 RPC Service available:', !!rpcService);
                    console.log('🔍 RPC Service getBalance method:', typeof rpcService.getBalance);
                    
                    const balanceLamports = await rpcService.getBalance(publicKey);
                    console.log('✅ Successfully fetched balance:', balanceLamports);
                    
                    const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
                    setWalletBalance(balanceSol);
                    setError(null);
                } catch (fetchError) {
                    console.error('❌ Failed to fetch SOL balance:', fetchError);
                    console.error('❌ Error details:', {
                        message: fetchError.message,
                        stack: fetchError.stack,
                        name: fetchError.name,
                        code: fetchError.code
                    });
                    setError(`Failed to fetch SOL balance: ${fetchError.message}`);
                    toast.error(`RPC Error: ${fetchError.message}`);
                }
            } else {
                console.log('⚠️ Skipping balance fetch - conditions not met:', {
                    publicKey: !!publicKey,
                    connected
                });
            }
        };
        fetchSolBalance();
    }, [publicKey, connected]);

    // Update checkRequiredToken with enhanced logging
    useEffect(() => {
        const checkRequiredToken = async () => {
            if (!publicKey || !connected) {
                console.log('⚠️ Skipping token check - wallet not ready:', { publicKey: !!publicKey, connected });
                setHasRequiredToken(false);
                return;
            }
            
            try {
                console.log('🔍 Checking for required NOM token...');
                const requiredTokenMintPk = new PublicKey(NOM_TOKEN_MINT);
                console.log('🔍 Required token mint:', requiredTokenMintPk.toString());
                
                const tokenAccountsResponse = await rpcService.getTokenAccountsByOwner(
                    publicKey,
                    TOKEN_PROGRAM_ID
                );
                
                console.log('🔍 Token accounts response:', tokenAccountsResponse);
                
                if (tokenAccountsResponse.error) {
                    console.error('❌ Error fetching token accounts:', tokenAccountsResponse.error);
                    setHasRequiredToken(false);
                    return;
                }
                
                const accounts = tokenAccountsResponse.value || tokenAccountsResponse.result?.value || [];
                console.log('🔍 Found token accounts:', accounts.length);
                
                const requiredTokenAccount = accounts.find(account => 
                    account.account.data.parsed?.info?.mint === requiredTokenMintPk.toString()
                );

                if (requiredTokenAccount) {
                    const tokenAmount = Number(requiredTokenAccount.account.data.parsed.info.tokenAmount.uiAmount);
                    console.log('✅ Found NOM token with amount:', tokenAmount);
                    if (tokenAmount > 0) {
                        setHasRequiredToken(true);
                        return;
                    }
                }
                console.log('⚠️ No NOM token found or zero balance');
                setHasRequiredToken(false);
            } catch (error) {
                console.error('❌ Error checking required NOM token:', error);
                console.error('❌ Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
                setHasRequiredToken(false);
                toast.error(`Token check failed: ${error.message}`);
            }
        };

        checkRequiredToken();
    }, [publicKey, connected]);

    const getPoolId = async (mintA, mintB) => {
        if (mintA.toString() === NOM_TOKEN_MINT) {
            return new PublicKey(NOM_POOL_ID);
        }
        return getPdaLaunchpadPoolId(new PublicKey(RAYDIUM_LAUNCHPAD_PROGRAM_ID), mintA, mintB).publicKey;
    };

    // Use the launchpad-specific calculation approach (like the working oldswap.js)
    const calculateSwap = async (inputAmount) => {
        setToAmount(''); 
        if (!fixedTokenData.mint || inputAmount <= 0) {
            console.log("Calculation skipped: Invalid input amount or tokenMint missing");
            return;
        }

        try {
            console.log(`Calculating launchpad swap for ${inputAmount} SOL to ${fixedTokenData.mint}`);
            
            // First try Trade API to see if token has graduated
            const inputMint = 'So11111111111111111111111111111111111111112';
            const outputMint = fixedTokenData.mint;
            const amount = Math.floor(inputAmount * LAMPORTS_PER_SOL);
            const slippageBps = Math.floor((slippage === 'custom' ? parseFloat(customSlippage) : slippage) * 100);
            
            try {
                console.log('🔍 Checking if token has graduated to AMM...');
                const quoteResponse = await axios.get(
                    `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=V0`
                );
                
                if (quoteResponse.data && quoteResponse.data.success && quoteResponse.data.data && quoteResponse.data.data.outputAmount) {
                    // Token has graduated, use Trade API result
                    const outputAmount = quoteResponse.data.data.outputAmount;
                    const outputDecimals = quoteResponse.data.data.outputMint?.decimals || 6;
                    const humanReadableAmount = (outputAmount / Math.pow(10, outputDecimals)).toFixed(outputDecimals);
                    console.log(`✅ Token graduated - Expected output: ${humanReadableAmount} ${fixedTokenData.symbol}`);
                    setToAmount(humanReadableAmount);
                    return;
                }
            } catch (tradeApiError) {
                console.log('🔍 Trade API failed, token likely still on launchpad bonding curve');
            }

            // Token is still on launchpad, use SDK calculation
            console.log('🔍 Using launchpad bonding curve calculation...');
            const mintA = new PublicKey(fixedTokenData.mint);
            const mintB = NATIVE_MINT;
            const inAmount = new BN(Math.floor(inputAmount * LAMPORTS_PER_SOL));

            const poolId = await getPoolId(mintA, mintB);
            console.log("Launchpad Pool ID:", poolId.toString());
            
            // Use your working RPC approach for pool info
            const poolInfoResponse = await rpcService.getRpcPoolInfo({ poolId });
            const poolInfo = poolInfoResponse.result;
            console.log("Launchpad Pool Info:", poolInfo);

            if (!poolInfo || typeof poolInfo.mintDecimalsA !== 'number') {
                console.error("Invalid poolInfo for launchpad token", poolInfo);
                toast.error('Could not get valid pool info for this launchpad token.');
                return;
            }

            // Get platform data using your working approach
            const platformDataResponse = await rpcService.getAccountInfo(poolInfo.platformId);
            const platformData = platformDataResponse.result;
            if (!platformData) {
                console.error("Could not get platform account info for launchpad");
                toast.error('Could not get platform info for launchpad token.');
                return;
            }

            // Decode platform data (using your working conversion method)
            let platformInfo;
            try {
                if (platformData.data && platformData.data instanceof Uint8Array) {
                    platformInfo = PlatformConfig.decode(platformData.data);
                } else if (platformData.value && platformData.value.data) {
                    const dataObj = platformData.value.data;
                    const dataArray = Object.keys(dataObj)
                        .sort((a, b) => parseInt(a) - parseInt(b))
                        .map(key => dataObj[key]);
                    const platformConfigData = new Uint8Array(dataArray);
                    platformInfo = PlatformConfig.decode(platformConfigData);
                } else {
                    throw new Error('Unknown platform data format');
                }
            } catch (decodeError) {
                console.error('Platform decode error:', decodeError);
                toast.error('Failed to decode platform data');
                return;
            }

            if (!poolInfo.configInfo) {
                console.error("poolInfo.configInfo missing for launchpad");
                toast.error('Pool configuration details are missing.');
                return;
            }

            // Convert fee rates to BN (your working conversion)
            let protocolFeeRate;
            if (typeof poolInfo.configInfo.tradeFeeRate === 'string') {
                protocolFeeRate = new BN(poolInfo.configInfo.tradeFeeRate, 16);
            } else if (poolInfo.configInfo.tradeFeeRate instanceof BN) {
                protocolFeeRate = poolInfo.configInfo.tradeFeeRate;
            } else {
                protocolFeeRate = new BN(poolInfo.configInfo.tradeFeeRate);
            }

            console.log("Launchpad calculation - protocolFeeRate:", protocolFeeRate.toString());
            console.log("Launchpad calculation - platformFeeRate:", platformInfo.feeRate.toString());

            // Convert poolInfo fields to BN objects with proper hex detection
            const convertToBN = (value, fieldName) => {
                console.log(`🔍 Converting ${fieldName}:`, value, `(type: ${typeof value})`);
                
                if (value instanceof BN) return value;
                if (typeof value === 'number') return new BN(value);
                if (typeof value === 'string') {
                    try {
                        // Check if string contains hex characters (a-f)
                        const isHex = /[a-fA-F]/.test(value) || /^[0-9a-fA-F]+$/.test(value);
                        
                        if (isHex) {
                            console.log(`🔍 Converting ${fieldName} as hex: ${value}`);
                            return new BN(value, 16);
                        } else {
                            console.log(`🔍 Converting ${fieldName} as decimal: ${value}`);
                            return new BN(value, 10);
                        }
                    } catch (error) {
                        console.error(`❌ Error converting ${fieldName} with value "${value}":`, error);
                        return new BN(0);
                    }
                }
                console.log(`🔍 Using default 0 for ${fieldName}`);
                return new BN(0);
            };

            const poolInfoForCalculation = {
                ...poolInfo,
                virtualA: convertToBN(poolInfo.virtualA, 'virtualA'),
                virtualB: convertToBN(poolInfo.virtualB, 'virtualB'),
                realA: convertToBN(poolInfo.realA, 'realA'),
                realB: convertToBN(poolInfo.realB, 'realB'),
                epoch: convertToBN(poolInfo.epoch, 'epoch'),
            };

            console.log("🔍 Converted poolInfo fields to BN objects");
            console.log("🔍 virtualA:", poolInfoForCalculation.virtualA.toString());
            console.log("🔍 virtualB:", poolInfoForCalculation.virtualB.toString());

            // Use Curve.buyExactIn for launchpad bonding curve calculation
            const res = Curve.buyExactIn({
                poolInfo: poolInfoForCalculation,
                amountB: inAmount,
                protocolFeeRate: protocolFeeRate,
                platformFeeRate: platformInfo.feeRate,
                curveType: poolInfo.configInfo.curveType,
                shareFeeRate: new BN(0),
            });

            if (!res || !res.amountA) {
                console.error("Launchpad calculation result invalid", res);
                toast.error('Launchpad calculation failed.');
                return;
            }

            const decimals = poolInfo.mintDecimalsA;
            const divisor = new Decimal(10).pow(decimals);
            const expectedAmount = new Decimal(res.amountA.toString())
                .div(divisor)
                .toFixed(decimals);

            console.log(`✅ Launchpad bonding curve output: ${expectedAmount} ${fixedTokenData.symbol}`);
            setToAmount(expectedAmount);

        } catch (error) {
            console.error('Error calculating launchpad swap:', error);
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

    const handleSwap = async () => {
        if (isLoading || !fromAmount || !publicKey || !signTransaction) {
            toast.error('Wallet not connected or transaction signing is unavailable.');
            return;
        }
        setIsLoading(true);

        try {
            console.log('🔄 Starting launchpad token swap...');
            
            // Check if token has graduated first
            const inputMint = 'So11111111111111111111111111111111111111112';
            const outputMint = fixedTokenData.mint;
            const amount = Math.floor(parseFloat(fromAmount) * LAMPORTS_PER_SOL);
            const slippageBps = Math.floor((slippage === 'custom' ? parseFloat(customSlippage) : slippage) * 100);
            
            try {
                console.log('🔍 Checking if token has graduated...');
                const quoteResponse = await axios.get(
                    `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=V0`
                );
                
                if (quoteResponse.data && quoteResponse.data.success && quoteResponse.data.data) {
                    // Use Trade API for graduated tokens
                    console.log('✅ Token graduated, using Trade API...');
                    
                    const txResponse = await axios.post('https://transaction-v1.raydium.io/transaction/swap-base-in', {
                        computeUnitPriceMicroLamports: '100000',
                        swapResponse: quoteResponse.data,
                        txVersion: 'V0',
                        wallet: publicKey.toString(),
                        wrapSol: true,
                        unwrapSol: false,
                    });
                    
                    const txBuffer = Buffer.from(txResponse.data.data[0].transaction, 'base64');
                    const transaction = VersionedTransaction.deserialize(txBuffer);
                    const signedTransaction = await signTransaction(transaction);
                    
                    const signature = await rpcService.sendRawTransaction(signedTransaction.serialize(), {
                        skipPreflight: false,
                        preflightCommitment: "confirmed"
                    });
                    
                    toast.success('Graduated token swap sent! Signature: ' + signature.substring(0,10) + '...');
                    
                    const confirmationResponse = await rpcService.confirmTransaction(signature, "confirmed");
                    if (confirmationResponse.result.value.err) {
                        throw new Error(`Transaction failed: ${confirmationResponse.result.value.err}`);
                    }
                    
                    toast.success('Swap successful!');
                    onClose();
                    return;
                }
            } catch (tradeApiError) {
                console.log('🔍 Trade API failed, using launchpad buyToken...');
            }

            // Use launchpad buyToken for bonding curve tokens
            console.log('🔍 Using launchpad buyToken for bonding curve...');
            const raydium = await initSdk();
            raydium.setOwner(publicKey);

            const mintA = new PublicKey(fixedTokenData.mint);
            const mintB = NATIVE_MINT;
            const inAmount = new BN(Math.floor(parseFloat(fromAmount) * LAMPORTS_PER_SOL));
            const slippageBasisPoints = new BN(slippageBps);

            const poolId = await getPoolId(mintA, mintB);
            const poolInfoResponse = await rpcService.getRpcPoolInfo({ poolId });
            const poolInfo = poolInfoResponse.result;
            
            if (!poolInfo || !poolInfo.configInfo) {
                throw new Error('Could not retrieve launchpad pool configuration');
            }

            const platformDataResponse = await rpcService.getAccountInfo(poolInfo.platformId);
            const platformData = platformDataResponse.result;
            if (!platformData) {
                throw new Error('Could not get launchpad platform info');
            }
            
            // Decode platform data
            let platformInfo;
            if (platformData.data && platformData.data instanceof Uint8Array) {
                platformInfo = PlatformConfig.decode(platformData.data);
            } else if (platformData.value && platformData.value.data) {
                const dataObj = platformData.value.data;
                const dataArray = Object.keys(dataObj)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map(key => dataObj[key]);
                const platformConfigData = new Uint8Array(dataArray);
                platformInfo = PlatformConfig.decode(platformConfigData);
            }
            
            // Use launchpad buyToken (like in your working oldswap.js)
            const { transaction } = await raydium.launchpad.buyToken({
                programId: new PublicKey(RAYDIUM_LAUNCHPAD_PROGRAM_ID),
                mintA,
                slippage: slippageBasisPoints,
                txVersion: TxVersion.V0,
                buyAmount: inAmount,
                configInfo: poolInfo.configInfo,
                platformFeeRate: platformInfo.feeRate,
                skipPreflight: false,
            });

            if (!transaction) throw new Error("No transaction returned from launchpad buyToken");

            const signedTransaction = await signTransaction(transaction);
            const signature = await rpcService.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: "confirmed"
            });
            
            toast.success('Launchpad swap sent! Signature: ' + signature.substring(0,10) + '...');
            
            const confirmationResponse = await rpcService.confirmTransaction(signature, "confirmed");
            if (confirmationResponse.result.value.err) {
                throw new Error(`Transaction failed: ${confirmationResponse.result.value.err}`);
            }
            
            toast.success('Launchpad swap successful!');
            
            if (publicKey) {
                const updatedBalance = await rpcService.getBalance(publicKey);
                setWalletBalance(updatedBalance / LAMPORTS_PER_SOL);
            }
            
            onClose();
        } catch (error) {
            console.error('Launchpad swap error:', error);
            toast.error(`Swap failed: ${error.message || 'Unknown error'}`);
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
        const newVal = (Math.round((currentVal + 0.1) * 10) / 10).toFixed(1);
        handleFromAmountChange(newVal);
    };

    const decrementAmount = () => {
        const currentVal = parseFloat(fromAmount) || 0;
        if (currentVal >= 0.1) {
            const newVal = (Math.round((currentVal - 0.1) * 10) / 10).toFixed(1);
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
            console.log('Getting swap quote...');
            
            // Copy the exact working approach from oldswap.js
            const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
            const outputMint = '2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk'; // NOM
            const amount = Math.floor(parseFloat(quickBuyAmount) * LAMPORTS_PER_SOL);
            const slippageBps = 100; // 1%
            const txVersion = 'V0';
            
            const quoteResponse = await axios.get(
                `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=${txVersion}`
            );
            
            console.log('Quote received:', quoteResponse.data);
            
            const txResponse = await axios.post('https://transaction-v1.raydium.io/transaction/swap-base-in', {
                computeUnitPriceMicroLamports: '100',
                swapResponse: quoteResponse.data,
                txVersion,
                wallet: publicKey.toString(),
                wrapSol: true,
                unwrapSol: false,
            });
            
            console.log('Transaction received:', txResponse.data);
            
            const txBuffer = Buffer.from(txResponse.data.data[0].transaction, 'base64');
            const transaction = VersionedTransaction.deserialize(txBuffer);
            
            console.log('Signing transaction...');
            const signedTx = await signTransaction(transaction);
            
            console.log('Sending transaction...');
            const signature = await rpcService.sendRawTransaction(signedTx.serialize());
            
            console.log('Transaction sent:', signature);
            toast.success('NOM token purchase sent!');
            
            // Update balance and check for NOM token
            if (publicKey) {
                const updatedBalance = await rpcService.getBalance(publicKey);
                setWalletBalance(updatedBalance / LAMPORTS_PER_SOL);
                
                // Re-check NOM token balance after delay
                setTimeout(async () => {
                    try {
                        const requiredTokenMintPk = new PublicKey(NOM_TOKEN_MINT);
                        const tokenAccountsResponse = await rpcService.getTokenAccountsByOwner(
                            publicKey, 
                            TOKEN_PROGRAM_ID
                        );
                        if (!tokenAccountsResponse.error) {
                            const accounts = tokenAccountsResponse.value || tokenAccountsResponse.result?.value || [];
                            const requiredTokenAccount = accounts.find(account => 
                                account.account.data.parsed?.info?.mint === requiredTokenMintPk.toString()
                            );
                            if (requiredTokenAccount) {
                                const tokenAmount = Number(requiredTokenAccount.account.data.parsed.info.tokenAmount.uiAmount);
                                if (tokenAmount > 0) {
                                    setHasRequiredToken(true);
                                    toast.success('NOM token detected! You can now use the swap feature.');
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error rechecking NOM token:', error);
                    }
                }, 2000);
            }
            
        } catch (error) {
            console.error('Error buying NOM token:', error);
            toast.error(`Failed to buy NOM: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Conditional rendering based on wallet connection
    if (!connected) {
        return (
            <div className="swap-container">
                <animated.div className="swap-box" style={slideAnimation}>
                    <p>Please connect your wallet to use the swap feature.</p>
                    <WalletMultiButton />
                    {error && <p className="error-message">{error}</p>} {/* Use error here */}
                    <button className="close-button" onClick={onClose}>Close</button>
                </animated.div>
            </div>
        );
    }

    // if (!isVerified) {
    //     return (
    //         <div className="swap-container">
    //             <animated.div className="swap-box" style={slideAnimation}>
    //                 <p>Please verify your wallet ownership.</p>
    //                 <button onClick={verifyWalletOwnership} disabled={isLoading || !signMessage}>
    //                     {isLoading ? 'Verifying...' : 'Verify Wallet'}
    //                 </button>
    //                 {error && <p className="error-message">{error}</p>}
    //                 <button className="close-button" onClick={onClose}>Close</button>
    //             </animated.div>
    //         </div>
    //     );
    // }

    return (
        <div className="swap-container">
            <animated.div className="swap-box" style={slideAnimation}>
                {!hasRequiredToken ? (
                    <>
                        <div className="error-message">
                            <h3>Access Restricted</h3>
                            <div className="error-content">
                                <p>To use this swap feature, you need to hold $NOM token.</p>
                                <div className="token-info">
                                    <span className="token-label">Required:</span>
                                    <a 
                                        href={`https://solscan.io/token/${NOM_TOKEN_MINT}`}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="token-address"
                                    >
                                        $NOM ({(NOM_TOKEN_MINT)})
                                    </a>
                                </div>
                            </div>
                        </div>
                        
                        <div className="quick-buy-section">
                            <h4>Buy $NOM</h4>
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
                                disabled={isLoading || !connected || !publicKey || !signTransaction}
                            >
                                {isLoading ? "Processing..." : `Buy ${quickBuyAmount} SOL of $NOM`}
                            </button>
                        </div>
                        
                        <button className="close-button" onClick={onClose}>Close</button>
                    </>
                ) : (
                    <>
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
                                    <span className="currency-symbol">◎</span> 
                                    <span className="currency-name">SOL</span>
                                </div>
                            </div>
                            <div className="balance">Balance: {walletBalance.toFixed(4)} SOL</div>
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
                                        href={`https://solscan.io/token/${fixedTokenData.mint}`}
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
                            disabled={isLoading || !fromAmount || !toAmount || parseFloat(toAmount) <= 0 || !connected || !publicKey || !signTransaction}
                        >
                            {isLoading ? "Swapping..." : "Swap"}
                        </button>
                        <button className="close-button" onClick={onClose}>Close</button>
                    </>
                )}
            </animated.div>
        </div>
    );
};

export default SwapComponent;
