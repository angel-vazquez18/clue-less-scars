let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 1000;

export function connectWebSocket(onConnect, onDisconnect, onMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }

  if (ws) {
    ws.close();
  }

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    reconnectAttempts = 0;
    onConnect();
  };

  ws.onclose = (event) => {
    console.log('WebSocket disconnected:', event.code, event.reason);
    onDisconnect();
    
    // Attempt to reconnect if not manually closed
    if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
      setTimeout(() => {
        reconnectAttempts++;
        console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
        connectWebSocket(onConnect, onDisconnect, onMessage);
      }, reconnectDelay * reconnectAttempts);
    }
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Received WebSocket message:', message);
      onMessage(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      console.error('Raw message:', event.data);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

export function disconnectWebSocket() {
  if (ws) {
    ws.close(1000, 'Manual disconnect');
    ws = null;
  }
}

export function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      const messageStr = JSON.stringify(message);
      console.log('Sending WebSocket message:', message);
      ws.send(messageStr);
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  } else {
    console.error('WebSocket not connected. State:', ws?.readyState);
    return false;
  }
}

export function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN;
}

export function getConnectionState() {
  if (!ws) return 'DISCONNECTED';
  
  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return 'CONNECTING';
    case WebSocket.OPEN:
      return 'CONNECTED';
    case WebSocket.CLOSING:
      return 'CLOSING';
    case WebSocket.CLOSED:
      return 'DISCONNECTED';
    default:
      return 'UNKNOWN';
  }
}
