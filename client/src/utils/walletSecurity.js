import { toast } from 'react-toastify';

export const detectPhishingAttempt = () => {
  if (window.solana && window.solana._phishing) {
    return true;
  }
  
  const suspiciousDomains = [
    'phantom-wallet',
    'phantom-app',
    'solflare-wallet',
    'solana-wallet',
    'phantom-login',
    'solana-login'
  ];
  
  const currentDomain = window.location.hostname;
  
  if (suspiciousDomains.some(domain => currentDomain.includes(domain) && !currentDomain.includes('official'))) {
    return true;
  }
  
  if (window.solana) {
    try {
      const connectString = window.solana.connect.toString();
      if (!connectString.includes('native code') && !connectString.includes('[object Function]')) {
        return true;
      }
    } catch (e) {
      console.warn("Could not inspect wallet provider methods", e);
      return true;
    }
  }
  
  return false;
};

export const verifyWalletOwnership = async (wallet, onSuccess, onError) => {
  const { publicKey, signMessage } = wallet;
  
  if (!publicKey || !signMessage) {
    onError && onError(new Error("Wallet doesn't support message signing"));
    return false;
  }

  try {
    const timestamp = Date.now();
    const message = `Verify wallet ownership for Nom App: ${publicKey.toString()} at ${timestamp}`;
    const encodedMessage = new TextEncoder().encode(message);
    
    const signature = await signMessage(encodedMessage);
    
    localStorage.setItem('wallet_verified', 'true');
    localStorage.setItem('wallet_verified_at', timestamp.toString());
    localStorage.setItem('wallet_verified_pubkey', publicKey.toString());
    
    onSuccess && onSuccess(signature);
    return true;
  } catch (err) {
    console.error("Wallet verification failed:", err);
    onError && onError(err);
    return false;
  }
};

export const isWalletVerified = (publicKey, maxAgeMs = 24 * 60 * 60 * 1000) => {
  if (!publicKey) return false;
  
  const verified = localStorage.getItem('wallet_verified') === 'true';
  const verifiedAt = parseInt(localStorage.getItem('wallet_verified_at') || '0', 10);
  const verifiedPubkey = localStorage.getItem('wallet_verified_pubkey');
  
  const isExpired = Date.now() - verifiedAt > maxAgeMs;
  const isSameWallet = verifiedPubkey === publicKey.toString();
  
  return verified && !isExpired && isSameWallet;
};

export const clearWalletVerification = () => {
  localStorage.removeItem('wallet_verified');
  localStorage.removeItem('wallet_verified_at');
  localStorage.removeItem('wallet_verified_pubkey');
};

export const secureConnect = async (wallet) => {
  if (detectPhishingAttempt()) {
    toast.error("WARNING: Possible phishing attempt detected! Please verify you're on the correct website.", {
      autoClose: false,
      closeOnClick: false,
      draggable: false
    });
    return false;
  }
  
  try {
    if (!wallet.connected) {
      await wallet.connect();
    }
    
    if (isWalletVerified(wallet.publicKey)) {
      return true;
    }
    
    const verified = await verifyWalletOwnership(
      wallet,
      () => toast.success("Wallet verified successfully!"),
      () => toast.error("Wallet verification failed")
    );
    
    return verified;
  } catch (error) {
    console.error("Secure connect failed:", error);
    toast.error("Failed to connect wallet securely");
    return false;
  }
};