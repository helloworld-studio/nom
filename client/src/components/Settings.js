import React, { useState, useEffect } from 'react';
import '../App.css';

const Settings = ({ onClose }) => {
  const [rpcUrl, setRpcUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasCustomRpc, setHasCustomRpc] = useState(false);

  useEffect(() => {
    const customRpc = localStorage.getItem('rpcUrl');
    setHasCustomRpc(!!customRpc);
    setRpcUrl('');
  }, []);

  const handleSave = () => {
    if (rpcUrl && rpcUrl.trim()) {
      localStorage.setItem('rpcUrl', rpcUrl.trim());
      setHasCustomRpc(true);
      setSaved(true);
      setRpcUrl(''); 
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('rpcUrl');
    setHasCustomRpc(false);
    setRpcUrl('');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
              {hasCustomRpc && (
                <div className="custom-rpc-status">
                  ✅ Custom RPC URL is set
                </div>
              )}
            </div>
            <div className="info-card-label">Solana RPC URL</div>
          </div>
        </div>
        
        <div className="swap-buttons">
          <button className="swap-button" onClick={handleSave}>
            Save
          </button>
          {hasCustomRpc && (
            <button className="swap-button cancel-button" onClick={handleClear}>
              Clear Custom RPC
            </button>
          )}
          <button className="swap-button cancel-button" onClick={onClose}>
            Close
          </button>
        </div>
        
        {saved && <div className="saved-message">Settings saved!</div>}
      </div>
    </div>
  );
};

export default Settings;
