/* eslint-disable no-undef */
import React, { useState, useEffect } from "react";
import "../App.css";
import axios from "axios";
import SwapComponent from './SwapComponent';
import TokenInfo from './TokenInfo';
import { config } from '../config';
import SUMMA from '../assets/sus.png';

const ViewToken = ({ 
  
    signAllTransactions 
}) => {
    const [latestTransaction, setLatestTransaction] = useState(null);
    const [showSwap, setShowSwap] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        const fetchLatestTransaction = async () => {
            try {
                const response = await axios.get(`${config.API_BASE_URL}/api/latest-transaction`);
                if (response.data.success) {
                    setLatestTransaction(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching latest transaction:", error);
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
                        <div className="token-header-container">
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
                                <img
                                    src={SUMMA}
                                    alt="Token logo placeholder"
                                    className="token-logo"
                                />
                            )}
                           
                        </div>
                        <div className="token-info">
                                <h2 className="token-name">{latestTransaction.name || 'Unknown'}</h2>
                                <p className="token-symbol">{latestTransaction.symbol || '???'}</p>
                            </div>
                        <div className="transaction-info-container">
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
                        <div className="transaction-row">
                            <p>
                                <span className="key">Initial Buy:</span>
                                <span className="value2">{latestTransaction.initialBuy?.toLocaleString() || ' N/A'}</span>
                            </p>
                            <p>
                                <span className="key">Sol Amount:</span>
                                <span className="value sol-amount">
                                    {latestTransaction.solAmount?.toFixed(6) || 'N/A'} SOL
                                </span>
                            </p>
                        </div>
                        </div>
                        <div className="button-wrapper">
                            <button className="button" onClick={handleViewChart}>View Chart</button>
                            <button
                                className="button"
                                onClick={() => setShowInfo(true)}
                            >
                                Info
                            </button>
                            <button
                                className="button"
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
           
        </div>
    );
};

export default ViewToken;