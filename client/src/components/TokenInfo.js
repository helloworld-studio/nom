import React, { useEffect, useState } from "react";
import "../App.css"; 
import { config } from '../config';

const infoCards = [
  {
    key: "top10HoldersPct",
    label: "Top 10 H.",
    icon: "👤",
    valueKey: "top10HoldersPct",
    color: "green"
  },
  {
    key: "devHoldersPct",
    label: "Dev H.",
    icon: "👨‍🍳",
    valueKey: "devHoldersPct",
    color: "green"
  },
  {
    key: "snipersHoldersPct",
    label: "Snipers H.",
    icon: "🎯",
    valueKey: "snipersHoldersPct",
    color: "green"
  },
  {
    key: "insidersPct",
    label: "Insiders",
    icon: "👻",
    valueKey: "insidersPct",
    color: "red"
  },
  {
    key: "bundlersPct",
    label: "Bundlers",
    icon: "🧑‍🤝‍🧑",
    valueKey: "bundlersPct",
    color: "red"
  },
  {
    key: "bondingCurveProgress",
    label: "Bonding Curve",
    icon: "📈",
    valueKey: "bondingCurve",
    color: "green"
  }
];

const TokenInfo = ({ onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    
    const fetchAnalytics = async () => {
      try {
        console.log('Fetching analytics data...');
        
        // Use hardcoded URL temporarily to verify connection
        const apiUrl = 'https://nom-ibs6.onrender.com/api/latest-transaction/analytics';
        
        console.log('Fetching from:', apiUrl);
        
        const response = await fetch(apiUrl);
        console.log('Analytics response status:', response.status);
        
        if (!response.ok) {
          console.error('API response not OK:', response.status, response.statusText);
          setError(`API error: ${response.status} ${response.statusText}`);
          return;
        }
        
        const data = await response.json();
        console.log('Analytics data received:', data);
        
        if (data.success) {
          console.log('Setting analytics data');
          setAnalytics(data.data);
        } else {
          setError(data.error || "Failed to load analytics");
        }
      } catch (err) {
        console.error('Error fetching analytics:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, []);

  return (
    <div className="swap-container">
      <div className="swap-box">
        <h2 className="token-info-title">Token Info</h2>
        {loading ? (
          <p className="text-arcade">Loading analytics...</p>
        ) : error ? (
          <p className="text-arcade">Error: {error}</p>
        ) : (
          <>
            <div className="transaction-details">
              {infoCards.map(card => (
                <div
                  key={card.key}
                  className="info-card"
                  style={{
                    color: card.color === "green" ? "#3ecf8e" : "#ff5e5e"
                  }}
                >
                  <div className="info-card-icon">{card.icon}</div>
                  <div className="info-card-value">
                    {card.valueKey === "bondingCurve" 
                      ? `${analytics?.bondingCurveProgress || "0.00"}%`
                      : `${analytics?.[card.valueKey] ?? "N/A"}${typeof analytics?.[card.valueKey] === "number" ? "%" : ""}`
                    }
                  </div>
                  <div className="info-card-label">{card.label}</div>
                </div>
              ))}
            </div>
            
            <div className="button-container">
              {analytics.mintAddress && (
                <>
                  <a 
                    href={`https://rugcheck.xyz/tokens/${analytics.mintAddress}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="rugcheck-button"
                  >
                    RUG CHECK
                  </a>
                  <a 
                    href={`https://gmgn.ai/sol/token/solscan_${analytics.mintAddress}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="gmgn-button"
                  >
                    GMGN
                  </a>
                </>
              )}
              <button className="close-button" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TokenInfo;
