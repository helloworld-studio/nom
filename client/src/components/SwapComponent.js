import React, { useState, useEffect, useCallback } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { TxVersion, Curve, PlatformConfig, getPdaLaunchpadPoolId } from '@raydium-io/raydium-sdk-v2';
import { PublicKey, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import { toast } from 'react-toastify';
import { initSdk } from '../config';
import axios from 'axios';
import rpcService from '../services/RpcService';

const RAYDIUM_LAUNCHPAD_PROGRAM_ID = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const NOM_TOKEN_MINT = "2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk";
const NOM_POOL_ID = "949rM1nZto1ZGYP5Mxwrfvwhr5CxRbVTsHaCL9S73pLu";

const SwapComponent = ({ tokenMint, tokenName, tokenSymbol, onClose, isWalletVerified, setIsWalletVerified }) => {
    // Get wallet properties including signMessage
    const { publicKey, connected, signTransaction, signMessage } = useWallet();
    // Remove the local isVerified state
    // const [isVerified, setIsVerified] = useState(false);
    const [error, setError] = useState(null);
    const [walletBalance, setWalletBalance] = useState(0);

    // Existing state
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // const [balance, setBalance] = useState(0); // Removed, redundant with walletBalance
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

    // Wallet verification logic
    // Update the verifyWalletOwnership useCallback (around line 75-95)
    const verifyWalletOwnership = useCallback(async () => {
    if (!connected || !publicKey || !signMessage) {
        setIsWalletVerified(false);
        return;
    }
    
    // Skip if already verified for this wallet
    if (isWalletVerified) {
        return;
    }
    
    try {
        const message = `Verify wallet ownership for Nom App: ${publicKey.toString()} at ${Date.now()}`;
        const encodedMessage = new TextEncoder().encode(message);
        await signMessage(encodedMessage);
        setIsWalletVerified(true);
        toast.success("Wallet verified successfully!");
    } catch (err) {
        console.error("Wallet verification failed:", err);
        setIsWalletVerified(false);
        setError("Wallet verification failed. Please try again.");
        toast.error("Wallet verification failed");
    }
    }, [connected, publicKey, signMessage, setIsWalletVerified, isWalletVerified]); // Add isWalletVerified back

    // Simplified verification effect - remove verificationAttempted state
    useEffect(() => {
        if (connected && publicKey && !isWalletVerified) {
            setError(null);
            verifyWalletOwnership();
        } else if (!connected) {
            setIsWalletVerified(false);
        }
    }, [connected, publicKey, isWalletVerified, verifyWalletOwnership, setIsWalletVerified]); // Add setIsWalletVerified

    // Update balance fetch to use the prop
    useEffect(() => {
        const fetchSolBalance = async () => {
            if (publicKey && connected && isWalletVerified) {
                try {
                    const balanceLamports = await rpcService.getBalance(publicKey);
                    const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
                    setWalletBalance(balanceSol);
                    setError(null);
                } catch (fetchError) {
                    console.error("Failed to fetch SOL balance:", fetchError);
                    setError("Failed to fetch SOL balance.");
                }
            }
        };
        fetchSolBalance();
    }, [publicKey, connected, isWalletVerified]);

    // Update all other references from isVerified to isWalletVerified
    useEffect(() => {
        const checkRequiredToken = async () => {
            if (!publicKey || !connected) { // Check publicKey and connected status
                setHasRequiredToken(false);
                return;
            }
            
            try {
                const requiredTokenMintPk = new PublicKey(NOM_TOKEN_MINT);
                const tokenAccountsResponse = await rpcService.getTokenAccountsByOwner(
                    publicKey, // Use publicKey from useWallet()
                    TOKEN_PROGRAM_ID
                );
                
                if (tokenAccountsResponse.error) {
                    console.error('Error fetching token accounts:', tokenAccountsResponse.error);
                    setHasRequiredToken(false);
                    return;
                }
                
                const accounts = tokenAccountsResponse.value || tokenAccountsResponse.result?.value || [];
                const requiredTokenAccount = accounts.find(account => 
                    account.account.data.parsed?.info?.mint === requiredTokenMintPk.toString()
                );

                if (requiredTokenAccount) {
                    const tokenAmount = Number(requiredTokenAccount.account.data.parsed.info.tokenAmount.uiAmount);
                    if (tokenAmount > 0) {
                        setHasRequiredToken(true);
                        return;
                    }
                }
                setHasRequiredToken(false);
            } catch (error) {
                console.error('Error checking required NOM token:', error);
                setHasRequiredToken(false);
            }
        };

        checkRequiredToken();
    }, [publicKey, connected]); // Add publicKey and connected as dependencies

    const getPoolId = async (mintA, mintB) => {
        if (mintA.toString() === NOM_TOKEN_MINT) {
            return new PublicKey(NOM_POOL_ID);
        }
        return getPdaLaunchpadPoolId(new PublicKey(RAYDIUM_LAUNCHPAD_PROGRAM_ID), mintA, mintB).publicKey;
    };

    const calculateSwap = async (inputAmount) => {
        // ... (rest of calculateSwap, ensure it uses component state and props correctly)
        // Make sure fixedTokenData.mint is valid
        setToAmount(''); 
        if (!fixedTokenData.mint || inputAmount <= 0) {
            console.log("Calculation skipped: Invalid input amount or tokenMint missing");
            return;
        }

        try {
            console.log(`Calculating swap for ${inputAmount} SOL to ${fixedTokenData.mint}`);
            // const raydium = await initSdk(); // Commented out as it's unused
            const mintA = new PublicKey(fixedTokenData.mint);
            const mintB = NATIVE_MINT;
            const inAmount = new BN(Math.floor(inputAmount * LAMPORTS_PER_SOL));
            console.log("Input lamports (amountB):", inAmount.toString());

            const poolId = await getPoolId(mintA, mintB);
            console.log("Pool ID:", poolId.toString());
            const poolInfoResponse = await rpcService.getRpcPoolInfo({ poolId });
            const poolInfo = poolInfoResponse.result;
            console.log("Pool Info:", poolInfo);

            if (!poolInfo || typeof poolInfo.mintDecimalsA !== 'number') {
                 console.error("Invalid poolInfo or mintDecimalsA missing/invalid", poolInfo);
                 toast.error('Could not get valid pool info for this token.');
                 return;
            }
             console.log("Token Decimals (decimalsA):", poolInfo.mintDecimalsA);

            const platformDataResponse = await rpcService.getAccountInfo(poolInfo.platformId);
            const platformData = platformDataResponse.result;
            if (!platformData) {
                console.error("Could not get platform account info");
                toast.error('Could not get platform info for this token.');
                return;
            }
            const platformInfo = PlatformConfig.decode(platformData.data);
            console.log('Platform Info:', platformInfo);

            if (!poolInfo.configInfo) {
                console.error("poolInfo.configInfo is missing", poolInfo);
                toast.error('Pool configuration details are missing.');
                return;
            }

            const res = Curve.buyExactIn({
                poolInfo,
                amountB: inAmount,
                protocolFeeRate: poolInfo.configInfo.tradeFeeRate,
                platformFeeRate: platformInfo.feeRate,
                curveType: poolInfo.configInfo.curveType,
                shareFeeRate: new BN(0),
            });

            if (!res || !res.amountA) {
                 console.error("Calculation result invalid", res);
                 toast.error('Calculation failed.');
                 return;
            }

            const decimals = poolInfo.mintDecimalsA;
            const divisor = new Decimal(10).pow(decimals);
            
            const expectedAmount = new Decimal(res.amountA.toString())
                .div(divisor)
                .toFixed(decimals);
            
            console.log("Calculated expected amount (string):", expectedAmount);

            if (expectedAmount && !isNaN(parseFloat(expectedAmount))) {
                 setToAmount(expectedAmount);
            } else {
                 console.error("Final calculated amount is invalid:", expectedAmount);
                 toast.error('Calculation resulted in an invalid amount.');
                 setToAmount('');
            }

        } catch (error) {
            if (error instanceof TypeError && error.message.includes("reading 'add'")) {
                 console.error('Error calculating swap: Likely an undefined fee rate or issue within Curve.buyExactIn. Check logged values.', error);
            } else {
                console.error('Error calculating swap:', error);
            }
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
            return new BN(Math.floor(parseFloat(customSlippage) * 100));
        }
        return new BN(slippage * 100);
    };

    const handleSwap = async () => {
        if (isLoading || !fromAmount || !publicKey || !signTransaction) { // Use publicKey and signTransaction from useWallet
             toast.error('Wallet not connected or transaction signing is unavailable.');
             console.error("Wallet/swap readiness issue:", {isLoading, fromAmount, publicKey, signTransaction});
             return;
        }
        setIsLoading(true);

        try {
            const raydium = await initSdk();
            raydium.setOwner(publicKey);

            const mintA = new PublicKey(fixedTokenData.mint);
            const mintB = NATIVE_MINT;
            const inAmount = new BN(Math.floor(parseFloat(fromAmount) * LAMPORTS_PER_SOL));
            const slippageBasisPoints = getSlippageBasisPoints();

            const poolId = await getPoolId(mintA, mintB);
            const poolInfoResponse = await rpcService.getRpcPoolInfo({ poolId });
            const poolInfo = poolInfoResponse.result;
            
            if (!poolInfo || !poolInfo.configInfo) {
                 console.error("Failed to get poolInfo or poolInfo.configInfo in handleSwap", poolInfo);
                 toast.error('Could not retrieve pool configuration for swap.');
                 setIsLoading(false);
                 return;
            }

            const platformDataResponse = await rpcService.getAccountInfo(poolInfo.platformId);
            const platformData = platformDataResponse.result;
            if (!platformData) {
                 console.error("Could not get platform account info in handleSwap");
                 toast.error('Could not get platform info for swap.');
                 setIsLoading(false);
                 return;
            }
            const platformInfo = PlatformConfig.decode(platformData.data);
            
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

            if (!transaction) throw new Error("No transaction returned from buyToken");

            const signedTransaction = await signTransaction(transaction); // Use signTransaction from useWallet
            const signature = await rpcService.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: "confirmed"
            });
            
            const confirmationResponse = await rpcService.confirmTransaction(signature, "confirmed");
            if (confirmationResponse.result.value.err) {
                throw new Error(`Transaction failed: ${confirmationResponse.result.value.err}`);
            }
            
            toast.success('Swap successful!');
            if (publicKey) {
                const updatedBalance = await rpcService.getBalance(publicKey);
                // setBalance(updatedBalance / LAMPORTS_PER_SOL); // Replaced with setWalletBalance
                setWalletBalance(updatedBalance / LAMPORTS_PER_SOL);
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
        if (!publicKey || !signTransaction) { // Use publicKey and signTransaction from useWallet
            toast.error('Please connect and verify your wallet first');
            return;
        }
        setIsLoading(true);
        try {
            const inputMint = NATIVE_MINT.toString();
            const outputMint = NOM_TOKEN_MINT;
            const amount = Math.floor(parseFloat(quickBuyAmount) * LAMPORTS_PER_SOL);
            const slippageBps = 100; // 1%
            
            const quoteResponse = await axios.get(
                `https://quote-api.raydium.io/v2/sdk/quote/swap?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&computeUnitPriceMicroLamports=10000`
            );
            
            const { swapTransaction } = quoteResponse.data;
            const transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
            
            const signedTx = await signTransaction(transaction); // Use signTransaction from useWallet
            const signature = await rpcService.sendRawTransaction(signedTx.serialize());
            
            toast.success('NOM token purchase sent! Signature: ' + signature.substring(0,10) + '...');
            // Optionally, wait for confirmation and update balance
            await rpcService.confirmTransaction(signature, "confirmed");
            toast.success('NOM token purchase confirmed!');
            if (publicKey) {
                const updatedBalance = await rpcService.getBalance(publicKey);
                // setBalance(updatedBalance / LAMPORTS_PER_SOL); // Replaced with setWalletBalance
                setWalletBalance(updatedBalance / LAMPORTS_PER_SOL);
                // Re-check NOM token balance
                 const checkRequiredToken = async () => {
                    if (!publicKey || !connected) { 
                        setHasRequiredToken(false);
                        return;
                    }
                    try {
                        const requiredTokenMintPk = new PublicKey(NOM_TOKEN_MINT);
                        const tokenAccountsResponse = await rpcService.getTokenAccountsByOwner(
                            publicKey, 
                            TOKEN_PROGRAM_ID
                        );
                        if (tokenAccountsResponse.error) {
                            setHasRequiredToken(false);
                            return;
                        }
                        const accounts = tokenAccountsResponse.value || tokenAccountsResponse.result?.value || [];
                        const requiredTokenAccount = accounts.find(account => 
                            account.account.data.parsed?.info?.mint === requiredTokenMintPk.toString()
                        );
                        if (requiredTokenAccount) {
                            const tokenAmount = Number(requiredTokenAccount.account.data.parsed.info.tokenAmount.uiAmount);
                            if (tokenAmount > 0) {
                                setHasRequiredToken(true);
                                return;
                            }
                        }
                        setHasRequiredToken(false);
                    } catch (error) {
                        setHasRequiredToken(false);
                    }
                };
                checkRequiredToken();
            }

        } catch (error) {
            console.error('Error buying NOM token:', error.response ? error.response.data : error);
            toast.error(`Failed to buy NOM: ${error.message || 'Unknown error'}`);
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
