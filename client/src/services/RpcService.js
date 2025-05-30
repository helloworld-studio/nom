import axios from 'axios';
import { config } from '../config';

class RpcService {
  constructor() {
    this.apiBaseUrl = config.API_BASE_URL || '';
    this.rpcEndpoint = `${this.apiBaseUrl}/api/rpc`;
  }

  async makeRpcRequest(method, params = []) {
    try {
      const response = await axios.post(this.rpcEndpoint, {
        method,
        params
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      return response.data;
    } catch (error) {
      console.error(`RPC request failed: ${error.message}`);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  // Convenience methods for common RPC calls
  async getBalance(publicKey) {
    const result = await this.makeRpcRequest('getBalance', [publicKey.toString()]);
    return result.result?.value || 0;
  }

  async getTokenAccountsByOwner(ownerAddress, programId) {
    return this.makeRpcRequest('getTokenAccountsByOwner', [
      ownerAddress.toString(),
      { programId: programId.toString() },
      { encoding: 'jsonParsed' }
    ]);
  }

  async getParsedTokenAccountsByOwner(ownerAddress, programId) {
    return this.makeRpcRequest('getParsedTokenAccountsByOwner', [
      ownerAddress.toString(),
      { programId: programId.toString() },
      { encoding: 'jsonParsed' }
    ]);
  }

  async getTokenSupply(mintAddress) {
    return this.makeRpcRequest('getTokenSupply', [mintAddress.toString()]);
  }

  async sendTransaction(serializedTransaction, options = {}) {
    return this.makeRpcRequest('sendTransaction', [
      serializedTransaction,
      options
    ]);
  }
}

// Create a singleton instance
const rpcService = new RpcService();

export default rpcService;
