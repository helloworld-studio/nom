export const getConnectionConfig = () => {
  const rpcUrl = localStorage.getItem('rpcUrl');
  const wsUrl = localStorage.getItem('wsUrl');
  
  return {
    rpcUrl: rpcUrl || process.env.REACT_APP_DEFAULT_RPC_URL, // fallback to default
    wsUrl: wsUrl || process.env.REACT_APP_DEFAULT_WS_URL, // fallback to default
  };
}; 