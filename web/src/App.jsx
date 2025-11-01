import React, { useState, useEffect } from 'react';
import { connectWebSocket, disconnectWebSocket, sendMessage } from './utils/wsClient';
import GameLobby from './components/GameLobby';
import GameBoard from './components/GameBoard';
import MessageLog from './components/MessageLog';
import Controls from './components/Controls';
import './App.css';

function App() {
  // Connection state
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  
  // Game state
  const [gameId, setGameId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  
  // UI state
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState([]);
  const [showJoinForm, setShowJoinForm] = useState(true);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // WebSocket connection
  useEffect(() => {
    const handleConnect = () => {
      setConnected(true);
      setConnecting(false);
      addMessage('Connected to server', 'system');
    };

    const handleDisconnect = () => {
      setConnected(false);
      setConnecting(false);
      addMessage('Disconnected from server', 'system');
    };

    const handleMessage = (message) => {
      console.log('Received message:', message);
      addMessage(JSON.stringify(message, null, 2), 'received');
      
      // Handle specific message types
      switch (message.type) {
        case 'INFO':
          if (message.payload.gameId) {
            setGameId(message.payload.gameId);
            addMessage(`Joined game: ${message.payload.gameId}`, 'system');
          }
          break;
          
        case 'GAME_STATE':
          setGameState(message.payload);
          setPlayers(message.payload.players || []);
          setCurrentPlayer(message.payload.you);
          setGameStarted(message.payload.turn?.phase === 'move');
          break;
          
        case 'PLAYER_JOINED':
          addMessage(`${message.payload.name} joined the game`, 'player-action');
          break;
          
        case 'PLAYER_LEFT':
          addMessage(`${message.payload.name} left the game`, 'player-left');
          break;
          
        case 'CHAT':
          // Use the fromName provided in the payload, fallback to lookup if not provided
          let fromName = message.payload.fromName;
          if (!fromName) {
            const fromPlayer = players.find(p => p.id === message.payload.from);
            fromName = fromPlayer ? fromPlayer.name : 'Unknown';
          }
          addMessage(`${fromName}: ${message.payload.message}`, 'chat');
          break;
          
        case 'LOBBY_STATE':
          setPlayers(message.payload.players || []);
          // Check if we need to update game state
          if (gameState) {
            setGameState({
              ...gameState,
              players: message.payload.players || []
            });
          }
          break;
          
        case 'CHARACTER_SELECTED':
          addMessage(`${message.payload.characterId} was selected`, 'player-action');
          // Update the player who selected the character
          if (message.payload.playerId === currentPlayer?.id) {
            setCurrentPlayer({
              ...currentPlayer,
              characterId: message.payload.characterId
            });
          }
          // Update in the players list
          setPlayers(prevPlayers => 
            prevPlayers.map(p => 
              p.id === message.payload.playerId 
                ? { ...p, characterId: message.payload.characterId }
                : p
            )
          );
          break;
          
        case 'GAME_STARTED':
          setGameStarted(true);
          addMessage('Game started!', 'system');
          // Update game state to reflect game started
          if (gameState) {
            setGameState({
              ...gameState,
              turn: {
                ...gameState.turn,
                phase: 'move'
              }
            });
          }
          break;
          
        case 'TURN_START':
          // Use playerName if provided, fallback to lookup
          let turnPlayerName = message.payload.playerName;
          if (!turnPlayerName) {
            const turnPlayer = players.find(p => p.id === message.payload.playerId);
            turnPlayerName = turnPlayer ? turnPlayer.name : message.payload.playerId;
          }
          addMessage(`It's ${turnPlayerName}'s turn`, 'turn');
          // Update game state with current turn info
          if (gameState) {
            setGameState({
              ...gameState,
              turn: {
                ...gameState.turn,
                currentPlayerId: message.payload.playerId,
                phase: 'move'
              }
            });
          }
          break;
          
        case 'PLAYER_MOVED':
          addMessage(`Player moved to ${message.payload.to.zone}`, 'player-action');
          // Update player position in game state
          if (gameState && message.payload.playerId) {
            setGameState({
              ...gameState,
              players: gameState.players.map(p =>
                p.id === message.payload.playerId
                  ? { ...p, position: message.payload.to }
                  : p
              )
            });
          }
          break;
          
        case 'SUGGESTION_MADE':
          addMessage(`Suggestion made: ${message.payload.suspectId} with ${message.payload.weaponId}`, 'player-action');
          break;
          
        case 'PROMPT_DISPROVE':
          addMessage(`You are being prompted to disprove a suggestion`, 'player-action');
          break;
          
        case 'DISPROVE_RESULT':
          if (message.payload.disproverId) {
            addMessage('Suggestion was disproved!', 'player-action');
          } else {
            addMessage('No one could disprove the suggestion', 'player-action');
          }
          break;
          
        case 'ACCUSATION_RESOLVED':
          if (message.payload.correct) {
            addMessage('ACCUSATION CORRECT! Game Over!', 'game-over');
          } else {
            addMessage('Accusation was incorrect', 'player-action');
          }
          break;
          
        case 'GAME_OVER':
          addMessage(`Game Over! Winner: ${message.payload.winnerId}`, 'game-over');
          setGameStarted(false);
          break;
          
        case 'ERROR':
          addMessage(`Error: ${message.payload.message}`, 'error');
          setError(message.payload.message);
          break;
          
        case 'YOUR_HAND':
          addMessage(`Your hand: ${JSON.stringify(message.payload.cards)}`, 'hand');
          break;
          
        case 'PONG':
          addMessage('Pong received', 'ping');
          break;
          
        default:
          addMessage(`Unknown message type: ${message.type}`, 'unknown');
      }
    };

    // Connect to WebSocket
    connectWebSocket(handleConnect, handleDisconnect, handleMessage);
    
    return () => {
      disconnectWebSocket();
    };
  }, []);

  const addMessage = (text, type = 'info') => {
    const message = {
      id: Date.now() + Math.random(),
      text,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, message]);
  };

  const handleJoin = (name, gameIdInput) => {
    if (!connected) {
      setError('Not connected to server');
      return;
    }
    
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    
    setPlayerName(name);
    setError('');
    
    const message = {
      type: 'JOIN_GAME',
      gameId: gameIdInput || 'NEW',
      payload: { name: name.trim() },
      ts: new Date().toISOString(),
      version: '1.0'
    };
    
    sendMessage(message);
    setShowJoinForm(false);
  };

  const handleSelectCharacter = (characterId) => {
    const message = {
      type: 'SELECT_CHARACTER',
      gameId,
      payload: { characterId },
      ts: new Date().toISOString(),
      version: '1.0'
    };
    sendMessage(message);
  };

  const handleStartGame = () => {
    const message = {
      type: 'START_GAME',
      gameId,
      payload: {},
      ts: new Date().toISOString(),
      version: '1.0'
    };
    sendMessage(message);
  };

  const handleMove = (to, targetId, useSecretPassage = false) => {
    const message = {
      type: 'REQUEST_MOVE',
      gameId,
      payload: { to, targetId, useSecretPassage },
      ts: new Date().toISOString(),
      version: '1.0'
    };
    sendMessage(message);
  };

  const handleSuggestion = (suspectId, weaponId) => {
    const message = {
      type: 'MAKE_SUGGESTION',
      gameId,
      payload: { suspectId, weaponId },
      ts: new Date().toISOString(),
      version: '1.0'
    };
    sendMessage(message);
  };

  const handleDisprove = (cardId = null) => {
    const message = {
      type: 'RESPOND_DISPROVE',
      gameId,
      payload: { cardId },
      ts: new Date().toISOString(),
      version: '1.0'
    };
    sendMessage(message);
  };

  const handleAccusation = (suspectId, weaponId, roomId) => {
    const message = {
      type: 'MAKE_ACCUSATION',
      gameId,
      payload: { suspectId, weaponId, roomId },
      ts: new Date().toISOString(),
      version: '1.0'
    };
    sendMessage(message);
  };

  const handleChat = (message, to = null) => {
    if (!gameId || !connected) {
      setError('Cannot send chat: not connected to a game');
      return;
    }
    
    const chatMessage = {
      type: 'CHAT',
      gameId,
      payload: { message, to },
      ts: new Date().toISOString(),
      version: '1.0'
    };
    sendMessage(chatMessage);
  };

  const handlePing = () => {
    const message = {
      type: 'PING',
      gameId,
      payload: { seq: Date.now() },
      ts: new Date().toISOString(),
      version: '1.0'
    };
    sendMessage(message);
  };

  const handleReconnect = () => {
    setConnecting(true);
    setConnected(false);
    // WebSocket will reconnect automatically
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Clue-Less Demo</h1>
        <div className="header-info">
          {gameId && (
            <div className="game-id-display">
              <label>Game ID:</label>
              <div className="game-id-container">
                <input 
                  type="text" 
                  value={gameId} 
                  readOnly 
                  className="game-id-input"
                  onClick={(e) => e.target.select()}
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(gameId);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }}
                  className="copy-btn"
                  title="Copy Game ID"
                >
                  {copySuccess ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
          <div className="connection-status">
            <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
            {!connected && (
              <button onClick={handleReconnect} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Reconnect'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {showJoinForm ? (
          <div className="join-form">
            <h2>Join Game</h2>
            <div className="form-group">
              <label>Your Name:</label>
              <input
                type="text"
                placeholder="Enter your name"
                maxLength={32}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Game ID (leave empty for new game):</label>
              <input
                type="text"
                placeholder="Game ID or leave empty"
                onKeyPress={(e) => e.key === 'Enter' && handleJoin(e.target.value, e.target.value)}
              />
            </div>
            <button onClick={() => {
              const nameInput = document.querySelector('input[placeholder="Enter your name"]');
              const gameInput = document.querySelector('input[placeholder="Game ID or leave empty"]');
              handleJoin(nameInput.value, gameInput.value);
            }}>
              Join Game
            </button>
            {error && <div className="error">{error}</div>}
          </div>
        ) : (
          <div className="game-container">
            <div className="game-sidebar">
              <GameLobby 
                players={players}
                currentPlayer={currentPlayer}
                gameStarted={gameStarted}
                onSelectCharacter={handleSelectCharacter}
                onStartGame={handleStartGame}
              />
              
              <Controls
                gameStarted={gameStarted}
                currentPlayer={currentPlayer}
                onMove={handleMove}
                onSuggestion={handleSuggestion}
                onDisprove={handleDisprove}
                onAccusation={handleAccusation}
                onChat={handleChat}
                onPing={handlePing}
              />
            </div>
            
            <div className="game-main">
              <GameBoard 
                gameState={gameState}
                currentPlayer={currentPlayer}
                gameStarted={gameStarted}
              />
              
              <MessageLog messages={messages} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;