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
    try {
      const response = await axios.post(
        this.rpcUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method,
          params
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      return response.data;
    } catch (error) {
      console.error(`RPC request failed: ${error.message}`);
      throw new Error(`RPC request failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

module.exports = RpcProxy;
