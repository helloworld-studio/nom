import { Connection } from '@solana/web3.js';
import { Raydium } from '@raydium-io/raydium-sdk-v2';

export const config = {
    RPC_URL: localStorage.getItem('rpcUrl') || process.env.REACT_APP_RPC_URL,
    API_BASE_URL: process.env.REACT_APP_API_URL || "http://localhost:5000",
};

export const initSdk = async () => {
    const connection = new Connection(config.RPC_URL);
    const raydium = new Raydium({ connection });
    return raydium;
};