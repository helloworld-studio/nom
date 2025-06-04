import { Connection } from '@solana/web3.js';
import { Raydium } from '@raydium-io/raydium-sdk-v2';

const runtimeConfig = window.RUNTIME_CONFIG || {};

const getApiBaseUrl = () => {
    if (runtimeConfig.API_URL) return runtimeConfig.API_URL;
    
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
    
    // For production on Render.com
    if (window.location.hostname.includes('render.com')) {
        return '';
    }
    
    // For local development
    if (window.location.origin.includes('localhost')) {
        return 'http://localhost:5000';
    }
    
    // Default fallback
    return "http://localhost:5000";
};

export const config = {
    API_BASE_URL: getApiBaseUrl(),
};

export const initSdk = async () => {
    const connection = new Connection(process.env.REACT_APP_RPC_URL);
    const raydium = new Raydium({ connection });
    return raydium;
};