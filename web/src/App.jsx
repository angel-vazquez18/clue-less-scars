import React, { useState, useEffect } from 'react';
import { connectWebSocket, disconnectWebSocket, sendMessage } from './utils/wsClient';
import GameLobby from './components/GameLobby';
import GameBoard from './components/GameBoard';
import InfoPanel from './components/InfoPanel';
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
  const [leaderId, setLeaderId] = useState(null);
  
  // UI state
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState([]);
  const [showJoinForm, setShowJoinForm] = useState(true);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [handCards, setHandCards] = useState([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [awaitingDisprove, setAwaitingDisprove] = useState(false);
  const [refutePrompt, setRefutePrompt] = useState(null);
  const [accusationResult, setAccusationResult] = useState(null);
  const [revealedSolution, setRevealedSolution] = useState(null);
  const [showLog, setShowLog] = useState(true);

  useEffect(() => {
    const baseTitle = 'Clue-less (Minimal)';
    if (currentPlayer?.name) {
      document.title = `${baseTitle} - ${currentPlayer.name}`;
    } else if (gameId) {
      document.title = `${baseTitle} - Joined`;
    } else {
      document.title = `${baseTitle} - Game Creation`;
    }
  }, [currentPlayer?.name, gameId]);

  useEffect(() => {
    const myId = currentPlayer?.id;
    const activeId = gameState?.turn?.currentPlayerId;
    setIsMyTurn(!!myId && !!activeId && myId === activeId);
  }, [currentPlayer?.id, gameState?.turn?.currentPlayerId]);

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
      setLeaderId(null);
      addMessage('Disconnected from server', 'system');
    };

    const handleMessage = (message) => {
      console.log('Received message:', message);
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
          setLeaderId(message.payload.leaderId || null);
          if (message.payload.solution) {
            setRevealedSolution(message.payload.solution);
          }
          if (message.payload.pendingSuggestion) {
            setRefutePrompt(message.payload.pendingSuggestion);
            setAwaitingDisprove(true);
          } else {
            setAwaitingDisprove(false);
            setRefutePrompt(null);
          }
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
          setLeaderId(message.payload.leaderId || null);
          // Check if we need to update game state
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              players: message.payload.players || prev.players,
              leaderId: message.payload.leaderId ?? prev.leaderId
            };
          });
          break;
          
        case 'CHARACTER_SELECTED':
          addMessage(`${message.payload.characterId} was selected`, 'player-action');
          // Update the player who selected the character
          setCurrentPlayer(prev => {
            if (!prev || prev.id !== message.payload.playerId) return prev;
            return {
              ...prev,
              characterId: message.payload.characterId
            };
          });
          // Update in the players list
          setPlayers(prevPlayers => 
            prevPlayers.map(p => 
              p.id === message.payload.playerId 
                ? { ...p, characterId: message.payload.characterId }
                : p
            )
          );
          // Update game state players
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              players: (prev.players || []).map(p =>
                p.id === message.payload.playerId
                  ? { ...p, characterId: message.payload.characterId }
                  : p
              )
            };
          });
          break;
          
        case 'GAME_STARTED':
          setGameStarted(true);
          addMessage('Game started!', 'system');
          setRevealedSolution(null);
          setAccusationResult(null);
          // Update game state to reflect game started
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              turn: {
                ...prev.turn,
                phase: 'move'
              }
            };
          });
          break;
          
        case 'TURN_START': {
          const { playerId: activeId, playerName, diceTotal, movesRemaining } = message.payload;
          const turnPlayerName = playerName || players.find(p => p.id === activeId)?.name || activeId;
          const diceText = diceTotal != null ? ` (dice: ${diceTotal}, remaining: ${movesRemaining ?? '?'})` : '';
          addMessage(`It's ${turnPlayerName}'s turn${diceText}`, 'turn');
          setAwaitingDisprove(false);
          setRefutePrompt(null);
          if (activeId === currentPlayer?.id) {
            setAccusationResult(null);
          }
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              turn: {
                ...prev.turn,
                currentPlayerId: activeId,
                phase: 'move',
                diceTotal: diceTotal ?? prev.turn?.diceTotal ?? null,
                movesRemaining: movesRemaining ?? prev.turn?.movesRemaining ?? null,
                legalMoves: Array.isArray(message.payload.legalMoves)
                  ? message.payload.legalMoves
                  : prev.turn?.legalMoves || []
              }
            };
          });
          break;
        }
          
        case 'PLAYER_MOVED':
          addMessage(`Player moved to ${message.payload.to.zone} ${message.payload.to.id || ''}`.trim(), 'player-action');
          if (message.payload.playerId) {
            setGameState(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map(p =>
                  p.id === message.payload.playerId
                    ? { ...p, position: message.payload.to }
                    : p
                ),
                turn: {
                  ...prev.turn,
                  movesRemaining: message.payload.movesRemaining ?? prev.turn?.movesRemaining ?? null,
                  diceTotal: message.payload.diceTotal ?? prev.turn?.diceTotal ?? null,
                  legalMoves: Array.isArray(message.payload.legalMoves)
                    ? message.payload.legalMoves
                    : prev.turn?.legalMoves || []
                }
              };
            });
            setPlayers(prev =>
              prev.map(p =>
                p.id === message.payload.playerId
                  ? { ...p, position: message.payload.to }
                  : p
              )
            );
          }
          break;
          
        case 'SUGGESTION_MADE': {
          const { suspectId, weaponId, by } = message.payload;
          const suggester = players.find(p => p.id === by)?.name || by;
          addMessage(`${suggester} suggested ${suspectId} with ${weaponId}`, 'player-action');
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              pendingSuggestion: {
                by,
                suspectId,
                weaponId,
                roomId: message.payload.roomId
              }
            };
          });
          break;
        }

        case 'PROMPT_DISPROVE': {
          const { suggestion, nextPlayerId } = message.payload;
          const prompt = nextPlayerId === currentPlayer?.id
            ? 'You are being prompted to disprove a suggestion'
            : 'Waiting for the next player to disprove';
          addMessage(prompt, 'player-action');
          setRefutePrompt({ ...suggestion, nextPlayerId });
          setAwaitingDisprove(true);
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              pendingSuggestion: {
                ...suggestion,
                nextPlayerId
              }
            };
          });
          break;
        }

        case 'DISPROVE_RESULT':
          if (message.payload.disproverId) {
            const personalCard = message.payload.cardId ? ` (card shown: ${message.payload.cardId})` : '';
            addMessage(`Suggestion was disproved${personalCard}!`, 'player-action');
          } else {
            addMessage('No one could disprove the suggestion', 'player-action');
          }
          setAwaitingDisprove(false);
          setRefutePrompt(null);
          setGameState(prev => prev ? { ...prev, pendingSuggestion: null } : prev);
          break;
          
        case 'ACCUSATION_RESOLVED': {
          if (message.payload.correct) {
            addMessage('ACCUSATION CORRECT! Game Over!', 'game-over');
          } else {
            addMessage('Accusation was incorrect', 'player-action');
            if (message.payload.eliminatedPlayerId) {
              const eliminated = players.find(p => p.id === message.payload.eliminatedPlayerId);
              const eliminatedName = eliminated ? eliminated.name : message.payload.eliminatedPlayerId;
              addMessage(`${eliminatedName} has been eliminated from the game.`, 'player-action');
            }
          }
          if (message.payload.by === currentPlayer?.id) {
            setAccusationResult({
              correct: message.payload.correct,
              by: message.payload.by
            });
          } else {
            setAccusationResult(null);
          }
          setAwaitingDisprove(false);
          setRefutePrompt(null);
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              pendingSuggestion: null,
              players: message.payload.eliminatedPlayerId
                ? prev.players.map(p =>
                    p.id === message.payload.eliminatedPlayerId
                      ? { ...p, eliminated: true }
                      : p
                  )
                : prev.players
            };
          });
          if (message.payload.eliminatedPlayerId) {
            setPlayers(prev =>
              prev.map(p =>
                p.id === message.payload.eliminatedPlayerId
                  ? { ...p, eliminated: true }
                  : p
              )
            );
          }
          break;
        }
          
        case 'GAME_OVER':
          addMessage(`Game Over! Winner: ${message.payload.winnerId}`, 'game-over');
          setGameStarted(false);
          setAwaitingDisprove(false);
          setRefutePrompt(null);
          setAccusationResult(null);
          if (message.payload.solution) {
            setRevealedSolution(message.payload.solution);
          }
          setGameState(prev => prev ? { ...prev, pendingSuggestion: null } : prev);
          break;
          
        case 'ERROR':
          addMessage(`Error: ${message.payload.message}`, 'error');
          setError(message.payload.message);
          break;
          
        case 'YOUR_HAND': {
          const cards = Array.isArray(message.payload.cards) ? message.payload.cards : [];
          setHandCards(cards);
          addMessage(`Your hand contains ${cards.length} card${cards.length === 1 ? '' : 's'}.`, 'hand');
          break;
        }
          
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

  const handleEndTurn = () => {
    const message = {
      type: 'END_TURN',
      gameId,
      payload: {},
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

  const handlePlayAgain = () => {
    window.location.reload();
  };

  const toggleLog = () => setShowLog((prev) => !prev);

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
                leaderId={leaderId}
                onSelectCharacter={handleSelectCharacter}
                onStartGame={handleStartGame}
              />
              
              <Controls
                gameStarted={gameStarted}
                currentPlayer={currentPlayer}
                isMyTurn={isMyTurn}
                awaitingDisprove={awaitingDisprove}
                refutePrompt={refutePrompt}
                legalMoves={gameState?.turn?.legalMoves || []}
                hand={handCards}
                accusationResult={accusationResult}
                solutionRevealed={!!revealedSolution}
                onMove={handleMove}
                onSuggestion={handleSuggestion}
                onDisprove={handleDisprove}
                onAccusation={handleAccusation}
                onChat={handleChat}
                onPing={handlePing}
                onEndTurn={handleEndTurn}
              />
            </div>
            
            <div className="game-main">
              <div className="board-section">
                <GameBoard 
                  gameState={gameState}
                  gameStarted={gameStarted}
                />
              </div>
              <div className="info-section">
                <InfoPanel
                  gameState={gameState}
                  currentPlayer={currentPlayer}
                  gameStarted={gameStarted}
                  isMyTurn={isMyTurn}
                  awaitingDisprove={awaitingDisprove}
                  refutePrompt={refutePrompt}
                  hand={handCards}
                  solution={revealedSolution}
                  accusationResult={accusationResult}
                  onPlayAgain={handlePlayAgain}
                />
                <div className="log-toggle">
                  <button onClick={toggleLog} className="control-btn log-btn">
                    {showLog ? 'Hide' : 'Show'} Message Log
                  </button>
                </div>
                {showLog && <MessageLog messages={messages} />}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;