/* eslint-disable no-undef */
import React, { useState, useEffect } from "react";
import "../App.css";
import SwapComponent from './SwapComponent';
import TokenInfo from './TokenInfo';
import BananaGang from "../assets/helloworld.png";
import { config } from '../config';

const ViewToken = ({ 
    showSettings, 
    setShowSettings,
    tokenInfo, 
    publicKey, 
    connection, 
    connected, 
    signAllTransactions 
}) => {
    const [latestTransaction, setLatestTransaction] = useState(null);
    const [showSwap, setShowSwap] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        const fetchLatestTransaction = async () => {
            try {
                console.log('Attempting to fetch latest transaction...');
                
                const apiUrl = 'https://nom-ibs6.onrender.com/api/latest-transaction';
                
                console.log('Fetching from:', apiUrl);
                
                const response = await fetch(apiUrl);
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    console.error('API response not OK:', response.status, response.statusText);
                    return;
                }
                
                const data = await response.json();
                console.log('Data received:', data);
                
                if (data.success) {
                    console.log('Setting latest transaction data');
                    setLatestTransaction(data.data);
                } else {
                    console.log('API returned success: false');
                }
            } catch (error) {
                console.error("Error fetching latest transaction:", error.message);
            }
        };

        // Run immediately once
        fetchLatestTransaction();

        const interval = setInterval(fetchLatestTransaction, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleViewChart = () => {
        if (latestTransaction?.mint) {
            window.open(`https://letsbonk.fun/token/${latestTransaction.mint}`, '_blank');
        }
    };

    const handleTransaction = () => setShowSwap(true);

    return (
        <div className="view-token-container">
            
            <div className="transaction-container">
                {latestTransaction ? (
                    <div className="transaction-details">
                        {latestTransaction.image ? (
                            <img
                                src={latestTransaction.image}
                                alt={`${latestTransaction.name || 'Token'} logo`}
                                className="token-logo"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <div className="token-logo-placeholder">?</div>
                        )}

                        <p>
                            <span className="key">Name:</span>
                            <span className="value">{latestTransaction.name || 'Unknown'}</span>
                            {' '}
                            (<span className="key">Symbol:</span>
                            <span className="value">{latestTransaction.symbol || '???'}</span>)
                        </p>
                        <p>
                            <span className="key">Mint:</span>
                            <a 
                                href={`https://solscan.io/token/${latestTransaction.mint}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="value mint-address"
                            >
                                {latestTransaction.mint}
                            </a>
                        </p>
                        {latestTransaction.creator && (
                            <p>
                                <span className="key">Creator:</span>
                                <a 
                                    href={`https://solscan.io/account/${latestTransaction.creator}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="value creator-address"
                                >
                                    {latestTransaction.creator}
                                </a>
                            </p>
                        )}
                        
                        {latestTransaction.metadata?.website && (
                            <p>
                                <span className="key">Website:</span>
                                <a href={latestTransaction.metadata.website} target="_blank" rel="noopener noreferrer" className="metadata-link">
                                    {latestTransaction.metadata.website}
                                </a>
                            </p>
                        )}
                        {latestTransaction.metadata?.twitter && (
                            <p>
                                <span className="key">Twitter:</span>
                                <a href={latestTransaction.metadata.twitter} target="_blank" rel="noopener noreferrer" className="metadata-link">
                                    {latestTransaction.metadata.twitter}
                                </a>
                            </p>
                        )}
                        {latestTransaction.metadata?.telegram && (
                            <p>
                                <span className="key">Telegram:</span>
                                <a href={latestTransaction.metadata.telegram} target="_blank" rel="noopener noreferrer" className="metadata-link">
                                    {latestTransaction.metadata.telegram}
                                </a>
                            </p>
                        )}
                        <p>
                            <span className="key">Initial Buy:</span>
                            <span className="value2">{latestTransaction.initialBuy?.toLocaleString() || 'N/A'}</span>
                        </p>
                        <p>
                            <span className="key">SOL Amount:</span>
                            <span className="value sol-amount">
                                {latestTransaction.solAmount?.toFixed(6) || 'N/A'} SOL
                            </span>
                        </p>
                        <div className="button-wrapper">
                            <button className="chart-button" onClick={handleViewChart}>View Chart</button>
                            <button
                                className="info-button"
                                onClick={() => setShowInfo(true)}
                            >
                                Info
                            </button>
                            <button
                                className="swap-button"
                                onClick={handleTransaction}
                                disabled={!latestTransaction?.mint || !window.solana?.isPhantom}
                            >
                                Swap
                            </button>
                        </div>
                    </div>
                ) : (
                    <p>Scanning for latest token launches...</p>
                )}
            </div>
            {showSwap && latestTransaction?.mint && (
                <SwapComponent
                    tokenMint={latestTransaction.mint}
                    tokenName={latestTransaction.name || 'Unknown Token'}
                    tokenSymbol={latestTransaction.symbol || '???'}
                    onClose={() => setShowSwap(false)}
                    signAllTransactions={signAllTransactions}
                />
            )}
            {showInfo && (
                <TokenInfo
                    onClose={() => setShowInfo(false)}
                    info={{
                        top10: latestTransaction?.top10HoldersPct,
                        dev: latestTransaction?.devHoldersPct,
                        snipers: latestTransaction?.snipersHoldersPct,
                        insiders: latestTransaction?.insidersPct,
                        bundlers: latestTransaction?.bundlersPct,
                        lpBurned: latestTransaction?.lpBurnedPct ?? "N/A"
                    }}
                />
            )}
            <a 
                href="https://github.com/helloworld-studio" 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ display: 'block', textAlign: 'center' }}
            >
                <img src={BananaGang} alt="Banana Gang github" className="banana-gang" />
            </a>
        </div>
    );
};

export default ViewToken;