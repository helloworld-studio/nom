import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSpring, animated } from '@react-spring/web';
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
    setLoading(true);
    axios.get(`${config.API_BASE_URL}/api/latest-transaction/analytics`)
      .then(res => {
        console.log("Analytics API response:", res.data);
        if (res.data.success) {
          setAnalytics(res.data.data);
        } else {
          setError(res.data.error || "Failed to load analytics");
        }
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="token-info-container">
      <animated.div 
        className="token-info-box" 
        style={slideAnimation}
      >
        <h2 className="token-info-title">Token Analytics</h2>
        {loading ? (
          <p className="text-arcade">Loading analytics...</p>
        ) : error ? (
          <p className="text-arcade">Error: {error}</p>
        ) : (
          <>
            <div className="info-cards-grid">
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
                    🛡️ RUG CHECK
                  </a>
                  <a 
                    href={`https://gmgn.ai/sol/token/solscan_${analytics.mintAddress}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="gmgn-button"
                  >
                    📊 GMGN ANALYTICS
                  </a>
                </>
              )}
              <button className="close-button" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </animated.div>
    </div>
  );
};

export default TokenInfo;
