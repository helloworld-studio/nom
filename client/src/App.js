import React, { useState, useEffect, useMemo } from "react";
import "./App.css";
import logo from "./assets/nom.png";
import BananaGang from "./assets/helloworld.png";

import ViewToken from "./components/ViewToken";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Buffer } from 'buffer';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import Settings from './components/Settings';
import { getConnectionConfig } from './utils/connection';

window.Buffer = Buffer;

const LoadingScreen = () => {
    const [progress, setProgress] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    return 0; 
                }
                return prev + 2;
            });
        }, 50);
        
        return () => clearInterval(interval);
    }, []);
    
    return (
        <div className="loading-screen">
            <div className="loading-container">
                <div className="loading-bar">
                    <div 
                        className="loading-progress" 
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="loading-text">Loading Network Observer for Memecoins </div>
            </div>
        </div>
    );
};

const AppContent = () => {
    const [showSettings, setShowSettings] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 2500);
        
        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            {isLoading ? (
                <LoadingScreen />
            ) : (
                <div className="App">
                    <div className="header-container">
                        <img src={logo} alt="nom" className="logo" />
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
                    
                    <ViewToken />
                </div>
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
        </>
    );
};

const App = () => {
    const { rpcUrl } = getConnectionConfig();
    const validRpcUrl = rpcUrl && rpcUrl.startsWith('http') 
        ? rpcUrl 
        : `https://${rpcUrl}`;
    
    const wallets = useMemo(() => [
        new SolflareWalletAdapter(),
    ], []);

    return (
        <ConnectionProvider endpoint={validRpcUrl}>
            <WalletProvider wallets={wallets} autoConnect={true}>
                <WalletModalProvider>
                    <AppContent />
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default App;