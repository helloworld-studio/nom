import React, { useState, useEffect } from 'react';
import '../App.css';
import { config } from '../config';

const Settings = ({ onClose }) => {
  const [rpcUrl, setRpcUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedRpcUrl = localStorage.getItem('rpcUrl');
    if (savedRpcUrl) {
      setRpcUrl(savedRpcUrl);
    } else {
      setRpcUrl(config.RPC_URL || '');
    }
  }, []);

  const handleSave = () => {
    if (rpcUrl) {
      localStorage.setItem('rpcUrl', rpcUrl);
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="swap-container">
      <div className="swap-box">
        <h2 className="token-info-title">Settings</h2>
        
        <div className="transaction-details">
          <div className="info-card">
            <div className="info-card-icon">🔌</div>
            <div className="info-card-value">
              <input
                type="text"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                placeholder="Enter your Solana RPC URL"
                className="settings-input"
              />
            </div>
            <div className="info-card-label">Solana RPC URL</div>
          </div>

          {saved && (
            <div className="info-card" style={{ color: "#3ecf8e" }}>
              <div className="info-card-icon">✅</div>
              <div className="info-card-value">Settings Saved!</div>
              <div className="info-card-label">Refresh page to apply changes</div>
            </div>
          )}
        </div>
        
        <div className="button-container">
          <button className="close-button" onClick={handleSave}>
            Save
          </button>
          <button className="close-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
