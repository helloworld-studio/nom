import { Connection } from '@solana/web3.js';
import { Raydium } from '@raydium-io/raydium-sdk-v2';

const runtimeConfig = window.RUNTIME_CONFIG || {};

console.log('Runtime config:', runtimeConfig);

const getApiBaseUrl = () => {
    if (runtimeConfig.API_URL) return runtimeConfig.API_URL;
    
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
    
    if (window.location.origin) return '';
    
    return "http://localhost:5000";
};

export const config = {
    RPC_URL: localStorage.getItem('rpcUrl') || process.env.REACT_APP_RPC_URL,
    API_BASE_URL: getApiBaseUrl(),
};

console.log('App config:', {
    API_BASE_URL: config.API_BASE_URL || '(using relative URLs)',
    RPC_URL: config.RPC_URL ? '(set)' : '(not set)'
});

export const initSdk = async () => {
    const connection = new Connection(config.RPC_URL);
    const raydium = new Raydium({ connection });
    return raydium;
};