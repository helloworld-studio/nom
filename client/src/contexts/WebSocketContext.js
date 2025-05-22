import React, { createContext, useContext, useRef, useState, useCallback } from "react";

const WebSocketContext = createContext();
const DEFAULT_COMMITMENT = 'confirmed';

export const WebSocketProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const ws = useRef(null);
    const subscriptionIds = useRef(new Set());

    const subscribeToAccount = useCallback((accountAddress) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            const subscribeMessage = {
                jsonrpc: "2.0",
                id: 1,
                method: "accountSubscribe",
                params: [
                    accountAddress,
                    { encoding: "jsonParsed", commitment: DEFAULT_COMMITMENT }
                ]
            };
            ws.current.send(JSON.stringify(subscribeMessage));
            subscriptionIds.current.add(accountAddress);
        } else {
            console.error("WebSocket is not connected");
        }
    }, []);

    const connect = useCallback(() => {
        if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
            const wsUrl = process.env.REACT_APP_QUICKNODE_WS_URL;
            if (!wsUrl) {
                throw new Error("WebSocket URL not configured");
            }

            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => {
                console.log("WebSocket connected");
                setIsConnected(true);

                // Resubscribe to any previous subscriptions
                subscriptionIds.current.forEach(accountId => {
                    subscribeToAccount(accountId);
                });
            };

            ws.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    setMessages((prevMessages) => [...prevMessages, message]);
                } catch (error) {
                    console.error("Failed to parse WebSocket message:", error);
                }
            };

            ws.current.onclose = () => {
                console.log("WebSocket disconnected");
                setIsConnected(false);
                subscriptionIds.current.clear();
            };

            ws.current.onerror = (error) => {
                console.error("WebSocket error:", error);
                setIsConnected(false);
            };
        }
    }, [subscribeToAccount]);

    const disconnect = useCallback(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            // Unsubscribe from all accounts
            subscriptionIds.current.forEach(accountId => {
                const unsubscribeMessage = {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "accountUnsubscribe",
                    params: [accountId]
                };
                ws.current.send(JSON.stringify(unsubscribeMessage));
            });
            
            ws.current.close();
            subscriptionIds.current.clear();
        }
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (ws.current) {
                disconnect();
            }
        };
    }, [disconnect]);

    return (
        <WebSocketContext.Provider
            value={{ 
                isConnected, 
                messages, 
                connect, 
                disconnect, 
                subscribeToAccount,
                clearMessages
            }}
        >
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error("useWebSocket must be used within a WebSocketProvider");
    }
    return context;
};
