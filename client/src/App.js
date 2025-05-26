import React, { useState, useEffect, useMemo } from "react";
import "./App.css";
import logo from "./assets/nom.png";
import ViewToken from "./components/ViewToken";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Buffer } from 'buffer';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import { config } from './config';
import floppyDisk from "./assets/load.gif"; 
import Settings from './components/Settings';

window.Buffer = Buffer;

const truncateWalletAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 5)}...${address.slice(-5)}`;
};

const AppContent = ({ showSettings, setShowSettings }) => {
    const { publicKey, connected, signAllTransactions } = useWallet();
    const { connection } = useConnection();
    const [error, setError] = useState(null);

    useEffect(() => {
        console.log('Wallet adapter status:', {
            connected,
            publicKey: publicKey?.toString(),
            hasConnection: !!connection,
            hasSigner: typeof signAllTransactions === 'function'
        });
        if (connected && publicKey) {
             setError(null);
        }
    }, [connected, publicKey, connection, signAllTransactions]);

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
                setError(null);
            } catch (fetchError) {
                console.error("Failed to fetch balance:", fetchError);
                setError("Failed to fetch balance.");
            }
        };

        if (connected) {
            fetchBalance();
        }
    }, [connection, publicKey, connected]);

    return (
        <div className="App">
            {error && <div className="error-message">{error}</div>}

            <div className="module-container">
                <div className="app-header">
                    <div className="logo-settings-container">
                        <img src={logo} alt="nom" className="logo" />
                        <span 
                            className="material-icons settings-icon" 
                            onClick={() => setShowSettings(true)}
                        >
                            settings
                        </span>
                    </div>
                    <div className="wallet-container">
                    <WalletMultiButton />
                    {publicKey && (
                        <div className="wallet-data">
                            <p>Connected: {truncateWalletAddress(publicKey.toBase58())}</p>
                        </div>
                    )}
                </div>
                </div>

                <ViewToken
                    publicKey={publicKey}
                    connection={connection}
                    connected={connected}
                    signAllTransactions={signAllTransactions}
                    showSettings={showSettings}
                    setShowSettings={setShowSettings}
                />
            </div>
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
    const endpoint = config.RPC_URL;
    const [isLoading, setIsLoading] = useState(true);
    const wallets = useMemo(() => [], []);
    
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 2500);
        
        return () => clearTimeout(timer);
    }, []);

    if (!endpoint) {
        console.error("Solana endpoint not configured. Please check your environment variables or config.js.");
        return <div>Error: Solana RPC endpoint not configured.</div>;
    }
    if (!endpoint.startsWith("http")) {
        console.error("Invalid Solana endpoint. Must start with 'http:' or 'https:'. Endpoint:", endpoint);
        return <div>Error: Invalid Solana RPC endpoint configured.</div>;
    }

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {isLoading ? (
                        <LoadingScreen />
                    ) : (
                        <AppContent showSettings={showSettings} setShowSettings={setShowSettings} />
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