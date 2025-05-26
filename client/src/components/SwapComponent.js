import React, { useState, useEffect } from 'react';
import { TxVersion, Curve, PlatformConfig, getPdaLaunchpadPoolId } from '@raydium-io/raydium-sdk-v2';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import { toast } from 'react-toastify';
import { config } from '../config';
import { initSdk } from '../config';
import axios from 'axios';
import { VersionedTransaction } from '@solana/web3.js';
import rpcService from '../services/RpcService';

const RAYDIUM_LAUNCHPAD_PROGRAM_ID = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";

const NOM_TOKEN_MINT = "2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk";
const NOM_POOL_ID = "949rM1nZto1ZGYP5Mxwrfvwhr5CxRbVTsHaCL9S73pLu";

const SwapComponent = ({ tokenMint, tokenName, tokenSymbol, onClose, signAllTransactions }) => {
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

    useEffect(() => {
        const checkRequiredToken = async () => {
            if (!window.solana?.publicKey) return;
            
            try {
                const requiredTokenMint = new PublicKey('2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk');
                
                const tokenAccountsResponse = await rpcService.getParsedTokenAccountsByOwner(
                    window.solana.publicKey,
                    TOKEN_PROGRAM_ID
                );

                const tokenAccounts = tokenAccountsResponse.result;
                
                const requiredToken = tokenAccounts.value.find(account => 
                    account.account.data.parsed.info.mint === requiredTokenMint.toString()
                );

                if (requiredToken) {
                    const tokenAmount = Number(requiredToken.account.data.parsed.info.tokenAmount.amount);
                    if (tokenAmount > 0) {
                        setHasRequiredToken(true);
                        return;
                    }
                }
                
                console.log('Required token not found or amount is 0');
                setHasRequiredToken(false);

            } catch (error) {
                console.error('Error checking required token:', error);
                setHasRequiredToken(false);
            }
        };

        checkRequiredToken();
    }, []);

    useEffect(() => {
        const fetchBalance = async () => {
            if (window.solana?.publicKey) {
                const balance = await rpcService.getBalance(window.solana.publicKey);
                setBalance(balance / LAMPORTS_PER_SOL);
            }
        };
        fetchBalance();
    }, []);

    const getPoolId = async (raydium, mintA, mintB) => {
        // Special case for NOM token
        if (mintA.toString() === NOM_TOKEN_MINT) {
            console.log("Using hardcoded pool ID for NOM token");
            return new PublicKey(NOM_POOL_ID);
        }
        
        return getPdaLaunchpadPoolId(new PublicKey(RAYDIUM_LAUNCHPAD_PROGRAM_ID), mintA, mintB).publicKey;
    };

    const calculateSwap = async (inputAmount) => {
        setToAmount(''); 
        if (!fixedTokenData.mint || inputAmount <= 0) {
            console.log("Calculation skipped: Invalid input amount or tokenMint missing");
            return;
        }

        try {
            console.log(`Calculating swap for ${inputAmount} SOL to ${fixedTokenData.mint}`);
            const raydium = await initSdk();
            const mintA = new PublicKey(fixedTokenData.mint);
            const mintB = NATIVE_MINT;
            const inAmount = new BN(Math.floor(inputAmount * LAMPORTS_PER_SOL));
            console.log("Input lamports (amountB):", inAmount.toString());

            const poolId = await getPoolId(raydium, mintA, mintB);
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

            // Now check configInfo
            if (!poolInfo.configInfo) {
                console.error("poolInfo.configInfo is missing", poolInfo);
                toast.error('Pool configuration details are missing.');
                return;
            }

            console.log("Using for calculation - protocolFeeRate:", poolInfo.configInfo.tradeFeeRate);
            console.log("Using for calculation - platformFeeRate:", platformInfo.feeRate);
            console.log("Using for calculation - curveType:", poolInfo.configInfo.curveType);


            const res = Curve.buyExactIn({
                poolInfo,
                amountB: inAmount,
                protocolFeeRate: poolInfo.configInfo.tradeFeeRate,
                platformFeeRate: platformInfo.feeRate,
                curveType: poolInfo.configInfo.curveType,
                shareFeeRate: new BN(0),
            });
            console.log("Calculation Result (res):", res);
            console.log("Raw output amount (amountA):", res.amountA.toString());


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
        if (isLoading || !fromAmount || !window.solana?.publicKey || typeof window.solana.signAllTransactions !== 'function') {
             toast.error('Wallet not connected or signAllTransactions method is missing.');
             console.error("Wallet connection issue:", window.solana);
             return;
        }
        setIsLoading(true);

        try {
            const wallet = {
                publicKey: window.solana.publicKey,
                signTransaction: window.solana.signTransaction.bind(window.solana),
                signAllTransactions: window.solana.signAllTransactions.bind(window.solana)
            };
            
            const raydium = await initSdk();
            
            raydium.setOwner(wallet.publicKey);

            const mintA = new PublicKey(fixedTokenData.mint);
            const mintB = NATIVE_MINT;
            const inAmount = new BN(Math.floor(parseFloat(fromAmount) * LAMPORTS_PER_SOL));
            
            const slippageBasisPoints = getSlippageBasisPoints();
            console.log(`Using slippage: ${slippageBasisPoints.toString()} basis points (${slippage === 'custom' ? customSlippage : slippage}%)`);

            const poolId = await getPoolId(raydium, mintA, mintB);
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

            console.log("Getting transaction from buyToken...");
            
            // eslint-disable-next-line no-unused-vars
            const { transaction, extInfo } = await raydium.launchpad.buyToken({
                programId: new PublicKey(RAYDIUM_LAUNCHPAD_PROGRAM_ID),
                mintA,
                slippage: slippageBasisPoints,
                txVersion: TxVersion.V0,
                buyAmount: inAmount,
                configInfo: poolInfo.configInfo,
                platformFeeRate: platformInfo.feeRate,
                skipPreflight: false,
            });

            if (!transaction) {
                throw new Error("No transaction returned from buyToken");
            }
            console.log("Transaction received:", transaction);

            console.log("Signing transaction...");
            const signedTransaction = await window.solana.signTransaction(transaction);
            console.log("Transaction signed successfully");

            const signature = await rpcService.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: "confirmed"
            });
            console.log("Transaction sent with signature:", signature);

            console.log("Waiting for confirmation...");
            const confirmationResponse = await rpcService.confirmTransaction(signature, "confirmed");
            const confirmation = confirmationResponse.result;
            
            if (confirmation.value.err) {
                throw new Error(`Transaction failed during confirmation: ${confirmation.value.err}`);
            }
            
            console.log("Transaction confirmed:", signature);

            toast.success('Swap successful!');
            if (window.solana?.publicKey) {
                const updatedBalance = await rpcService.getBalance(window.solana.publicKey);
                setBalance(updatedBalance / LAMPORTS_PER_SOL);
            }
            onClose();
        } catch (error) {
            console.error('Swap error:', error);
            if (error.message.includes('sign') || error.message.includes('Transaction')) {
                 toast.error(`Swap failed: ${error.message}. Please ensure the transaction is approved in your wallet.`);
            } else {
                 toast.error(error.message || 'Failed to complete swap');
            }
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
        if (!window.solana?.publicKey) {
            toast.error('Please connect your wallet first');
            return;
        }

        setIsLoading(true);
        try {
            // NOM token details
            const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
            const outputMint = '2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk'; // NOM
            const amount = Math.floor(parseFloat(quickBuyAmount) * LAMPORTS_PER_SOL); // Convert to lamports
            const slippageBps = 100; // 1%
            const txVersion = 'V0';
            
            console.log('Getting swap quote...');
            
            const quoteResponse = await axios.get(
                `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=${txVersion}`
            );
            
            console.log('Quote received:', quoteResponse.data);
            
            const txResponse = await axios.post('https://transaction-v1.raydium.io/transaction/swap-base-in', {
                computeUnitPriceMicroLamports: '100', // Fixed priority fee
                swapResponse: quoteResponse.data,
                txVersion,
                wallet: window.solana.publicKey.toString(),
                wrapSol: true, // Since input is SOL
                unwrapSol: false, // Output is NOM
                // Input account is not needed for SOL
                // Output account will default to ATA
            });
            
            console.log('Transaction received:', txResponse.data);
            
            const txBuffer = Buffer.from(txResponse.data.data[0].transaction, 'base64');
            const transaction = VersionedTransaction.deserialize(txBuffer);
            
            console.log('Signing transaction...');
            const signedTx = await window.solana.signTransaction(transaction);
            
            console.log('Sending transaction...');
            const signature = await rpcService.sendRawTransaction(signedTx.serialize());
            
            console.log('Transaction sent:', signature);
            toast.success('NOM token purchase sent!');
            
        } catch (error) {
            console.error('Error buying NOM token:', error);
            toast.error(`Failed to buy NOM: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

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
                                <span className="currency-symbol">◎</span> 
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
