export const getConnectionConfig = () => {
  const rpcUrl = localStorage.getItem('rpcUrl');
  const wsUrl = localStorage.getItem('wsUrl');
  
  return {
    rpcUrl: rpcUrl || process.env.REACT_APP_API_URL || 'http://localhost:5000',
    wsUrl: wsUrl || process.env.REACT_APP_DEFAULT_WS_URL,
  };
};