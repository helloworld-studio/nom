import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./App.css";
import logo from "./assets/nom.png";
import BananaGang from "./assets/helloworld.png";

import ViewToken from "./components/ViewToken";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Buffer } from 'buffer';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import floppyDisk from "./assets/load.gif"; 
import Settings from './components/Settings';
import { getConnectionConfig } from './utils/connection';

window.Buffer = Buffer;

const detectPhishingAttempt = () => {
  if (window.solana && window.solana._phishing) {
    return true;
  }
  
  const suspiciousDomains = [
    'phantom-wallet',
    'phantom-app',
    'solflare-wallet',
    'solana-wallet'
  ];
  
  const currentDomain = window.location.hostname;
  return suspiciousDomains.some(domain => currentDomain.includes(domain) && !currentDomain.includes('official'));
};

const truncateWalletAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 5)}...${address.slice(-5)}`;
};

const AppContent = ({ showSettings, setShowSettings }) => {
    const { publicKey, connected, signMessage, signAllTransactions } = useWallet();
    const { connection } = useConnection();
    const [error, setError] = useState(null);
    const [isVerified, setIsVerified] = useState(false);
    const [walletBalance, setWalletBalance] = useState(null);

    const verifyWalletOwnership = useCallback(async () => {
        if (!connected || !publicKey || !signMessage) {
            setIsVerified(false);
            return;
        }

        try {
            const message = `Verify wallet ownership for Nom App: ${publicKey.toString()} at ${Date.now()}`;
            const encodedMessage = new TextEncoder().encode(message);
            
             await signMessage(encodedMessage);
            
             setIsVerified(true);
             toast.success("Wallet verified successfully!");
        } catch (err) {
            console.error("Wallet verification failed:", err);
            setIsVerified(false);
            setError("Wallet verification failed. Please try again.");
            toast.error("Wallet verification failed");
        }
    }, [connected, publicKey, signMessage, setIsVerified, setError]);

    useEffect(() => {
        if (detectPhishingAttempt()) {
            setError("WARNING: Possible phishing attempt detected! Please verify you're on the correct website.");
            toast.error("Possible phishing attempt detected!", { autoClose: false });
            return;
        }
        
        console.log('Wallet adapter status:', {
            connected,
            publicKey: publicKey?.toString(),
            hasConnection: !!connection,
            hasSigner: typeof signAllTransactions === 'function',
            hasSignMessage: typeof signMessage === 'function'
        });
        
        if (connected && publicKey) {
            setError(null);
            verifyWalletOwnership();
        } else {
            setIsVerified(false);
        }
    }, [connected, publicKey, connection, signAllTransactions, signMessage, verifyWalletOwnership]);

    useEffect(() => {
        const fetchBalance = async () => {
            if (!connection || !publicKey) {
                console.log("Cannot fetch balance: Connection or publicKey missing.");
                return;
            }

            console.log(`Fetching balance for ${publicKey.toBase58()}`);
            try {
                const balanceLamports = await connection.getBalance(publicKey);
                const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
                console.log(`Balance: ${balanceSol} SOL`);
                setWalletBalance(balanceSol);
                setError(null);
            } catch (fetchError) {
                console.error("Failed to fetch balance:", fetchError);
                setError("Failed to fetch balance.");
            }
        };

        if (connected && isVerified) {
            fetchBalance();
        }
    }, [connection, publicKey, connected, isVerified]);

    return (
        <div className="App">
            {error && <div className="error-message">{error}</div>}

                        <div className="header-container">
                            <img src={logo} alt="nom" className="logo" />
                            <div className="wallet-container">
                                <WalletMultiButton />
                                {publicKey && (
                                    <div className="wallet-info">
                                        <p>{truncateWalletAddress(publicKey.toBase58())}</p>
                                        {isVerified ? (
                                            <span className="verified-badge" title="Wallet verified">✓</span>
                                        ) : (
                                            <button 
                                                className="verify-button" 
                                                onClick={verifyWalletOwnership}
                                                title="Verify wallet ownership"
                                            >
                                                Verify
                                            </button>
                                        )}
                                        {walletBalance !== null && (
                                            <p className="balance">{walletBalance.toFixed(4)} SOL</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <span 
                                className="material-icons settings-icon" 
                                onClick={() => setShowSettings(true)}
                            >
                                settings
                            </span>
                            <a 
                                href="https://github.com/helloworld-studio/nom" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ display: 'block', textAlign: 'center' }}
                            >
                                <img src={BananaGang} alt="github repo" className="banana-gang" />
                            </a>
                        </div>
                   
             

                <ViewToken
                    publicKey={publicKey}
                    connection={connection}
                    connected={connected && isVerified}
                    signAllTransactions={signAllTransactions}
                    showSettings={showSettings}
                    setShowSettings={setShowSettings}
                />
            </div>
       
    );
};

const LoadingScreen = () => {
  const [loadingText, setLoadingText] = useState("Loading");
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingText(prev => {
        if (prev === "Loading...") return "Loading";
        if (prev === "Loading..") return "Loading...";
        if (prev === "Loading.") return "Loading..";
        return "Loading.";
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="loading-screen">
      <div className="loading-box">
        <div className="floppy-container">
          <img src={floppyDisk} alt="Floppy Disk" className="floppy-disk" />
        </div>
        <div className="loading-text">{loadingText}</div>
      </div>
    </div>
  );
};

const App = () => {
    const [showSettings, setShowSettings] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    // Get connection config from utils
    const { rpcUrl } = getConnectionConfig();
    const validRpcUrl = rpcUrl && rpcUrl.startsWith('http') 
    ? rpcUrl 
    : `https://${rpcUrl}`;
    
    // Initialize wallet adapters
    const wallets = useMemo(() => [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ], []);
    
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 2500);
        
        return () => clearTimeout(timer);
    }, []);

    return (
        <ConnectionProvider endpoint={validRpcUrl}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {isLoading ? (
                        <LoadingScreen />
                    ) : (
                        <AppContent 
                            showSettings={showSettings} 
                            setShowSettings={setShowSettings}
                        />
                    )}
                    
                    <ToastContainer
                        position="top-right"
                        autoClose={5000}
                        hideProgressBar={false}
                        newestOnTop={false}
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                        theme="dark"
                    />
                    
                    {showSettings && (
                        <Settings onClose={() => setShowSettings(false)} />
                    )}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default App;