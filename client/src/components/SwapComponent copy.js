import React, { useState, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { PublicKey, LAMPORTS_PER_SOL, VersionedTransaction, Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token'; 
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { toast } from 'react-toastify';
import axios from 'axios';
import rpcService from '../services/RpcService';
import { TxVersion, Curve, PlatformConfig, getPdaLaunchpadPoolId } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import { initSdk } from '../config';

const RAYDIUM_LAUNCHPAD_PROGRAM_ID = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const NOM_TOKEN_MINT = "2MDr15dTn6km3NWusFcnZyhq3vWpYDg7vWprghpzbonk";
const NOM_POOL_ID = "949rM1nZto1ZGYP5Mxwrfvwhr5CxRbVTsHaCL9S73pLu";

const connection = new Connection(process.env.REACT_APP_RPC_URL || 'https://api.mainnet-beta.solana.com');

const SwapComponent = ({ tokenMint, tokenName, tokenSymbol, onClose, isWalletVerified, setIsWalletVerified }) => {
    const { publicKey, connected, signTransaction, signAllTransactions } = useWallet();
    
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

    const [shareFeeRate, setShareFeeRate] = useState(new BN(0));

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
        if (connected && publicKey) {
            console.log('✅ Wallet connected, setting as verified');
            setIsWalletVerified(true);
            setError(null);
        } else if (!connected) {
            setIsWalletVerified(false);
        }
    }, [connected, publicKey, setIsWalletVerified]);

    useEffect(() => {
        const checkRequiredToken = async () => {
            if (!publicKey) return;
            
            try {
                const requiredTokenMint = new PublicKey(NOM_TOKEN_MINT);
                
                const tokenAccountsResponse = await rpcService.getParsedTokenAccountsByOwner(
                    publicKey,
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
    }, [publicKey]);

    useEffect(() => {
        const fetchBalance = async () => {
            if (publicKey) {
                const balance = await rpcService.getBalance(publicKey);
                setWalletBalance(balance / LAMPORTS_PER_SOL);
            }
        };
        fetchBalance();
    }, [publicKey]);

    const getPoolId = async (raydium, mintA, mintB) => {
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
        if (isLoading || !fromAmount || !publicKey || !signTransaction) {
            toast.error('Wallet not connected or transaction signing not available.');
            return;
        }
        setIsLoading(true);

        try {
            const wallet = {
                publicKey: publicKey,
                signTransaction: signTransaction,
                signAllTransactions: signAllTransactions
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
                return;
            }

            const platformDataResponse = await rpcService.getAccountInfo(poolInfo.platformId);
            const platformData = platformDataResponse.result;
            if (!platformData) {
                console.error("Could not get platform account info in handleSwap");
                toast.error('Could not get platform info for swap.');
                return;
            }
            const platformInfo = PlatformConfig.decode(platformData.data);

            console.log("Getting transaction from buyToken...");
            
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

            if (!transaction) {
                throw new Error("No transaction returned from buyToken");
            }
            console.log("Transaction received:", transaction);

            console.log("Signing transaction...");
            const signedTransaction = await signTransaction(transaction);
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
            if (publicKey) {
                const updatedBalance = await rpcService.getBalance(publicKey);
                setWalletBalance(updatedBalance / LAMPORTS_PER_SOL);
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

    const buyNomToken = async () => {
        if (!publicKey) {
            toast.error('Please connect your wallet first');
            return;
        }

        setIsLoading(true);
        try {
            const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
            const outputMint = NOM_TOKEN_MINT;
            const amount = Math.floor(parseFloat(quickBuyAmount) * LAMPORTS_PER_SOL);
            const slippageBps = 100; // 1%
            const txVersion = 'V0';
            
            console.log('Getting swap quote...');
            
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
            
            // Check for NOM token after a delay
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
            
        } catch (error) {
            console.error('Error buying NOM token:', error);
            toast.error(`Failed to buy NOM: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper functions
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

    if (!connected) {
        return (
            <div className="swap-container">
                <animated.div className="swap-box" style={slideAnimation}>
                    <p>Please connect your wallet to use the swap feature.</p>
                    <WalletMultiButton />
                    {error && <p className="error-message">{error}</p>}
                    <button className="close-button" onClick={onClose}>Close</button>
                </animated.div>
            </div>
        );
    }

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
                                        $NOM ({truncateAddress(NOM_TOKEN_MINT)})
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
                                disabled={isLoading}
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
                            disabled={isLoading || !fromAmount || !toAmount || parseFloat(toAmount) <= 0}
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
