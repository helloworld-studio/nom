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

class SecureConnection extends Connection {
    constructor(apiBaseUrl) {
        super('https://api.mainnet-beta.solana.com');
        this.apiBaseUrl = apiBaseUrl || '';
    }

    async _rpcRequest(method, args) {
        const endpoint = `${this.apiBaseUrl}/api/rpc`;
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    method,
                    params: args
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'RPC request failed');
            }
            
            const responseData = await response.json();
            return responseData;
        } catch (error) {
            console.error(`RPC request failed: ${error.message}`);
            throw error;
        }
    }
}

export const initSdk = async () => {
    const connection = new SecureConnection(config.API_BASE_URL);
    const raydium = new Raydium({ connection });
    return raydium;
};