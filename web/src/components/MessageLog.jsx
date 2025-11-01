import React, { useEffect, useRef } from 'react';

const MessageLog = ({ messages }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getMessageTypeClass = (type) => {
    switch (type) {
      case 'system':
        return 'message-system';
      case 'player-action':
        return 'message-player-action';
      case 'turn':
        return 'message-turn';
      case 'game-over':
        return 'message-game-over';
      case 'error':
        return 'message-error';
      case 'hand':
        return 'message-hand';
      case 'ping':
        return 'message-ping';
      case 'received':
        return 'message-received';
      case 'unknown':
        return 'message-unknown';
      default:
        return 'message-info';
    }
  };

  const formatMessage = (message) => {
    // Try to parse as JSON for better formatting
    try {
      const parsed = JSON.parse(message.text);
      return {
        ...message,
        formatted: JSON.stringify(parsed, null, 2)
      };
    } catch {
      return {
        ...message,
        formatted: message.text
      };
    }
  };

  const formatTimestamp = (timestamp) => {
    return timestamp;
  };

  return (
    <div className="message-log">
      <div className="message-log-header">
        <h4>Message Log</h4>
        <div className="message-count">
          {messages.length} messages
        </div>
      </div>
      
      <div className="message-list">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Connect to the server to see real-time updates.</p>
          </div>
        ) : (
          messages.map((message) => {
            const formattedMessage = formatMessage(message);
            return (
              <div 
                key={message.id} 
                className={`message-item ${getMessageTypeClass(message.type)}`}
              >
                <div className="message-header">
                  <span className="message-type">{message.type}</span>
                  <span className="message-timestamp">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                <div className="message-content">
                  <pre className="message-text">
                    {formattedMessage.formatted}
                  </pre>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageLog;
