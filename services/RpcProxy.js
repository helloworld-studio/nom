const axios = require('axios');
require('dotenv').config();

class RpcProxy {
  constructor() {
    this.rpcUrl = process.env.RPC_URL;
    if (!this.rpcUrl) {
      console.error("RPC_URL environment variable is not set");
      throw new Error("RPC_URL environment variable is not set");
    }
  }

  async makeRpcRequest(method, params) {
    const startTime = Date.now();
    
    try {
      // Enhanced logging for getAccountInfo
      if (method === 'getAccountInfo') {
        console.log('\n🔍 [RpcProxy] === getAccountInfo DEBUG START ===');
        console.log('🔍 [RpcProxy] Timestamp:', new Date().toISOString());
        console.log('🔍 [RpcProxy] Method:', method);
        console.log('🔍 [RpcProxy] Raw params:', JSON.stringify(params, null, 2));
        console.log('🔍 [RpcProxy] RPC URL:', this.rpcUrl);
        
        if (params && params[0]) {
          console.log('🔍 [RpcProxy] Account PublicKey:', params[0]);
          console.log('🔍 [RpcProxy] Encoding options:', params[1] || 'none specified');
        }
      }
      
      const requestBody = {
        jsonrpc: '2.0',
        id: Date.now(), // Use timestamp as unique ID
        method,
        params
      };
      
      if (method === 'getAccountInfo') {
        console.log('🔍 [RpcProxy] Full request body:', JSON.stringify(requestBody, null, 2));
        console.log('🔍 [RpcProxy] Making HTTP request...');
      }
      
      const response = await axios.post(
        this.rpcUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      // Add this transformation logic directly before returning the response.data
      if (method === 'getAccountInfo' && response.data.result && response.data.result.value) {
        const base64Data = response.data.result.value.data[0];
        // Convert base64 string to Uint8Array directly
        response.data.result.value.data = new Uint8Array(Buffer.from(base64Data, 'base64'));
        console.log('🔧 [RpcProxy] Transformed getAccountInfo data to Uint8Array for frontend');
      }

      const duration = Date.now() - startTime;
      
      if (method === 'getAccountInfo') {
        console.log('🔍 [RpcProxy] Request completed in:', duration + 'ms');
        console.log('🔍 [RpcProxy] HTTP Status:', response.status);
        console.log('🔍 [RpcProxy] Response headers:', JSON.stringify(response.headers, null, 2));
        console.log('🔍 [RpcProxy] Raw response data:', JSON.stringify(response.data, null, 2));
        
        // Detailed analysis of the response
        if (response.data) {
          console.log('🔍 [RpcProxy] Response analysis:');
          console.log('  - Has jsonrpc:', !!response.data.jsonrpc);
          console.log('  - Has id:', !!response.data.id);
          console.log('  - Has result:', !!response.data.result);
          console.log('  - Has error:', !!response.data.error);
          
          if (response.data.error) {
            console.log('❌ [RpcProxy] RPC Error:', JSON.stringify(response.data.error, null, 2));
          }
          
          if (response.data.result !== undefined) {
            console.log('🔍 [RpcProxy] Result analysis:');
            console.log('  - Result type:', typeof response.data.result);
            console.log('  - Result is null:', response.data.result === null);
            
            if (response.data.result && typeof response.data.result === 'object') {
              console.log('  - Result keys:', Object.keys(response.data.result));
              
              if (response.data.result.value !== undefined) {
                console.log('  - Has value field:', !!response.data.result.value);
                console.log('  - Value is null:', response.data.result.value === null);
                
                if (response.data.result.value) {
                  console.log('  - Value keys:', Object.keys(response.data.result.value));
                  
                  if (response.data.result.value.data) {
                    console.log('  - Data type:', typeof response.data.result.value.data);
                    console.log('  - Data length:', response.data.result.value.data.length || 'no length');
                    console.log('  - First 100 chars of data:', JSON.stringify(response.data.result.value.data).substring(0, 100));
                  }
                  
                  if (response.data.result.value.owner) {
                    console.log('  - Owner:', response.data.result.value.owner);
                  }
                  
                  if (response.data.result.value.executable !== undefined) {
                    console.log('  - Executable:', response.data.result.value.executable);
                  }
                }
              }
            }
          }
        }
        
        console.log('🔍 [RpcProxy] === getAccountInfo DEBUG END ===\n');
      }
      
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (method === 'getAccountInfo') {
        console.log('\n❌ [RpcProxy] === getAccountInfo ERROR DEBUG START ===');
        console.log('❌ [RpcProxy] Request failed after:', duration + 'ms');
        console.log('❌ [RpcProxy] Error type:', error.constructor.name);
        console.log('❌ [RpcProxy] Error message:', error.message);
        
        if (error.response) {
          console.log('❌ [RpcProxy] HTTP Error Status:', error.response.status);
          console.log('❌ [RpcProxy] HTTP Error Headers:', JSON.stringify(error.response.headers, null, 2));
          console.log('❌ [RpcProxy] HTTP Error Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
          console.log('❌ [RpcProxy] No response received');
          console.log('❌ [RpcProxy] Request config:', JSON.stringify(error.config, null, 2));
        } else {
          console.log('❌ [RpcProxy] Request setup error');
        }
        
        console.log('❌ [RpcProxy] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.log('❌ [RpcProxy] === getAccountInfo ERROR DEBUG END ===\n');
      }
      
      console.error(`RPC request failed: ${error.message}`);
      throw new Error(`RPC request failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

module.exports = RpcProxy;
