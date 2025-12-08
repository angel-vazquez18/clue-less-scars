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
  const [seenCards, setSeenCards] = useState([]);
  const [revealedCards, setRevealedCards] = useState([]); // Local log of cards revealed to this player
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [awaitingDisprove, setAwaitingDisprove] = useState(false);
  const [refutePrompt, setRefutePrompt] = useState(null);
  const [accusationResult, setAccusationResult] = useState(null);
  const [revealedSolution, setRevealedSolution] = useState(null);
  const [showMessageLog, setShowMessageLog] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [readMessageIds, setReadMessageIds] = useState(new Set());

  // Helper to remove prefixes from card ids (e.g., suspect:scarlet -> scarlet)
  const stripPrefix = (value) =>
    typeof value === 'string' ? value.replace(/^[^:]+:/, '') : value;

  useEffect(() => {
    const baseTitle = 'Clue-less (Target)';
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
          if (message.payload.message) {
            // Check if it's an auto-advance message
            if (message.payload.message.includes('ran out of moves') || 
                message.payload.message.includes('turn ended automatically')) {
              addMessage(message.payload.message, 'turn-auto');
            } else {
              addMessage(message.payload.message, 'info');
            }
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
            // Store the full pendingSuggestion structure which includes order and index
            // This matches what the server uses to determine the current disprover
            const pending = message.payload.pendingSuggestion;
            setRefutePrompt(pending);
            // Only set awaitingDisprove to true if this player is actually expected to disprove
            // Check using the same logic as the server: pending.order[pending.index]
            // Use message.payload.you.id instead of currentPlayer?.id because state updates are async
            const myPlayerId = message.payload.you?.id;
            if (pending.order && typeof pending.index === 'number' && myPlayerId) {
              const expectedPlayerId = pending.order[pending.index];
              setAwaitingDisprove(expectedPlayerId === myPlayerId);
            } else {
              // Fallback: if structure doesn't match, don't assume it's for this player
              setAwaitingDisprove(false);
            }
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
          const {
            playerId: activeId,
            playerName,
            hasMoved,
            mustSuggest,
            autoAdvanced,
            reason,
            legalMoves
          } = message.payload;
          const turnPlayerName = playerName || players.find(p => p.id === activeId)?.name || activeId;
          
          // Build turn text
          let turnText = '';
          if (mustSuggest) {
            turnText = ' (must make suggestion)';
          } else if (hasMoved) {
            turnText = ' (already moved)';
          }
          
          // Show more prominent message if turn auto-advanced
          if (autoAdvanced || reason === 'TURN_AUTO_ADVANCED') {
            addMessage(`🔄 Turn automatically advanced to ${turnPlayerName}${turnText}`, 'turn-auto');
          } else {
            addMessage(`It's ${turnPlayerName}'s turn${turnText}`, 'turn');
          }
          
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
                hasMoved: hasMoved ?? prev.turn?.hasMoved ?? false,
                mustSuggest: mustSuggest ?? prev.turn?.mustSuggest ?? false,
                legalMoves: Array.isArray(legalMoves)
                  ? legalMoves
                  : prev.turn?.legalMoves || []
              }
            };
          });
          break;
        }
          
        case 'PLAYER_MOVED': {
          const { playerId, to, mustSuggest, legalMoves } = message.payload;
          addMessage(
            `Player moved to ${to.zone} ${to.id || ''}`.trim(),
            'player-action'
          );
          if (playerId) {
            setGameState(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map(p =>
                  p.id === playerId ? { ...p, position: to } : p
                ),
                turn: {
                  ...prev.turn,
                  hasMoved: true,
                  mustSuggest: mustSuggest ?? prev.turn?.mustSuggest ?? false,
                  legalMoves:
                    Array.isArray(legalMoves) && legalMoves.length > 0
                      ? legalMoves
                      : prev.turn?.legalMoves || []
                }
              };
            });
            setPlayers(prev =>
              prev.map(p =>
                p.id === playerId ? { ...p, position: to } : p
              )
            );
            setCurrentPlayer(prev =>
              prev && prev.id === playerId ? { ...prev, position: to } : prev
            );
          }
          break;
        }
          
        case 'SUGGESTION_MADE': {
          const { suspectId, weaponId, by, byName } = message.payload;
          // Use byName from server if available, otherwise try to find from players state
          const suggester = byName || players.find(p => p.id === by)?.name || gameState?.players?.find(p => p.id === by)?.name || by;
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
          const { suggestion, nextPlayerId, order, index } = message.payload;
          const isForMe = nextPlayerId === currentPlayer?.id;
          const nextPlayerName =
            players.find((p) => p.id === nextPlayerId)?.name || 
            gameState?.players?.find((p) => p.id === nextPlayerId)?.name || 
            'next player';
          
          // Helper function to strip prefixes from card IDs
          const stripPrefix = (value) => {
            if (typeof value !== 'string') return value;
            return value.replace(/^[^:]+:/, '');
          };
          
          const suspectName = stripPrefix(suggestion.suspectId);
          const weaponName = stripPrefix(suggestion.weaponId);
          const roomName = stripPrefix(suggestion.roomId);
          
          const prompt = isForMe
            ? `You must disprove the suggestion: ${suspectName} with ${weaponName} in ${roomName}. Show a matching card or pass.`
            : `Waiting for ${nextPlayerName} to disprove the suggestion: ${suspectName} with ${weaponName} in ${roomName}`;
          addMessage(prompt, 'player-action');
          // Store the full structure including order and index to match server's check
          const fullRefutePrompt = {
            ...suggestion,
            nextPlayerId,
            order: order || [],
            index: typeof index === 'number' ? index : 0
          };
          setRefutePrompt(fullRefutePrompt);
          // Only set awaitingDisprove to true if this message is actually for this player
          setAwaitingDisprove(isForMe);
          setGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              pendingSuggestion: fullRefutePrompt
            };
          });
          break;
        }

        case 'CARD_REVEAL':
          // Private message only to suggester - store in revealed cards log
          const { revealingPlayer, revealingPlayerCharacter, card, cardId: revealedCardId } = message.payload;
          const revealEntry = {
            player: revealingPlayer,
            character: revealingPlayerCharacter,
            card: card,
            cardId: revealedCardId,
            timestamp: new Date().toISOString()
          };
          
          setRevealedCards((prev) => [...prev, revealEntry]);
          
          // Add message notification
          const characterInfo = revealingPlayerCharacter ? ` (${revealingPlayerCharacter})` : '';
          addMessage(
            `${revealingPlayer}${characterInfo} revealed: ${card}`,
            'card-reveal'
          );
          
          // Also add to seenCards for reference tracking
          if (revealedCardId) {
            setSeenCards((prev) =>
              prev.includes(revealedCardId)
                ? prev
                : [...prev, revealedCardId]
            );
          }
          break;

        case 'DISPROVE_RESULT':
          // Check if this is the private message to suggester (with cardId) or public broadcast
          if (message.payload.disproverId) {
            // If this is a public broadcast (no cardId), show generic message
            if (!message.payload.cardId) {
              addMessage(
                'Suggestion was disproved!',
                'player-action'
              );
            }
            // If cardId is present, it means we already received CARD_REVEAL above
            // So we don't need to show the card again here
          } else {
            addMessage(
              'No one could disprove the suggestion',
              'player-action'
            );
          }
          setAwaitingDisprove(false);
          setRefutePrompt(null);
          setGameState((prev) =>
            prev ? { ...prev, pendingSuggestion: null } : prev
          );
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
          const cards = Array.isArray(message.payload.cards)
            ? message.payload.cards
            : [];
          setHandCards(cards);
          // Reset seen cards when receiving a fresh hand (e.g., new game)
          setSeenCards([]);
          addMessage(
            `Your hand contains ${cards.length} card${
              cards.length === 1 ? '' : 's'
            }.`,
            'hand'
          );
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
    // If popup is open, mark new message as read immediately
    if (showMessageLog) {
      setReadMessageIds(prev => new Set([...prev, message.id]));
    }
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

  const toggleMessageLog = () => {
    setShowMessageLog((prev) => {
      const newValue = !prev;
      // Mark all messages as read when opening the popup
      if (newValue) {
        setReadMessageIds(new Set(messages.map(m => m.id)));
      }
      return newValue;
    });
  };
  const toggleShortcuts = () => setShowShortcuts((prev) => !prev);

  // Handle keyboard shortcuts globally
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = event.target;
      const isInputFocused = target.tagName === 'INPUT' || 
                            target.tagName === 'TEXTAREA' || 
                            target.isContentEditable;
      
      // Handle shortcuts popup toggle (works even when not your turn)
      if (!isInputFocused && (event.key === '?' || event.key === 'h' || event.key === 'H')) {
        if (event.shiftKey && event.key === '?') {
          setShowShortcuts(prev => !prev);
          event.preventDefault();
          return;
        }
        if (event.key.toLowerCase() === 'h' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          setShowShortcuts(prev => !prev);
          event.preventDefault();
          return;
        }
      }
      
      // Close shortcuts popup with Escape
      if (event.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
          event.preventDefault();
        }
        if (showMessageLog) {
          // Mark all messages as read when closing with Escape
          setReadMessageIds(new Set(messages.map(m => m.id)));
          setShowMessageLog(false);
          event.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showShortcuts, showMessageLog]);

  // Mark all messages as read when popup opens
  useEffect(() => {
    if (showMessageLog) {
      setReadMessageIds(new Set(messages.map(m => m.id)));
    }
  }, [showMessageLog, messages]);

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
          <button
            className="header-shortcuts-btn"
            onClick={toggleShortcuts}
            title="Show keyboard shortcuts (Shift+? or H)"
            aria-label="Toggle keyboard shortcuts">
            ⌨️ Shortcuts
          </button>
          <button
            className="header-messages-btn"
            onClick={toggleMessageLog}
            title="Open message log and chat"
            aria-label="Toggle message log">
            💬 Messages {(() => {
              const unreadCount = messages.filter(m => !readMessageIds.has(m.id)).length;
              return unreadCount > 0 && <span className="message-count-badge">{unreadCount}</span>;
            })()}
          </button>
        </div>
      </header>
      
      {showShortcuts && (
        <>
          <div className="shortcuts-backdrop" onClick={() => setShowShortcuts(false)}></div>
          <div className="shortcuts-popup" role="dialog" aria-labelledby="shortcuts-title" aria-modal="true">
            <div className="shortcuts-header">
              <h4 id="shortcuts-title">Keyboard Shortcuts</h4>
              <button
                className="shortcuts-close"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts">
                ×
              </button>
            </div>
            <div className="shortcuts-content">
              <div className="shortcut-group">
                <h5>Game Actions (Your Turn Only)</h5>
                <div className="shortcut-item">
                  <kbd>M</kbd>
                  <span>Move</span>
                </div>
                <div className="shortcut-item">
                  <kbd>S</kbd>
                  <span>Make Suggestion</span>
                </div>
                <div className="shortcut-item">
                  <kbd>A</kbd>
                  <span>Make Accusation</span>
                </div>
                <div className="shortcut-item">
                  <kbd>E</kbd>
                  <span>End Turn</span>
                </div>
              </div>
              <div className="shortcut-group">
                <h5>General</h5>
                <div className="shortcut-item">
                  <span className="kbd-combo">
                    <kbd>Shift</kbd> + <kbd>?</kbd>
                  </span>
                  <span>or</span>
                  <kbd>H</kbd>
                  <span>Show/Hide Shortcuts</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Esc</kbd>
                  <span>Close Shortcuts / Cancel Forms</span>
                </div>
              </div>
              <div className="shortcuts-note">
                <p>💡 Shortcuts are disabled when typing in input fields or when forms are open.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {showMessageLog && (
        <>
          <div className="shortcuts-backdrop" onClick={() => {
            // Mark all messages as read when closing
            setReadMessageIds(new Set(messages.map(m => m.id)));
            setShowMessageLog(false);
          }}></div>
          <div className="message-log-popup" role="dialog" aria-labelledby="message-log-title" aria-modal="true">
            <div className="shortcuts-header">
              <h4 id="message-log-title">Messages & Chat</h4>
              <button
                className="shortcuts-close"
                onClick={() => {
                  // Mark all messages as read when closing
                  setReadMessageIds(new Set(messages.map(m => m.id)));
                  setShowMessageLog(false);
                }}
                aria-label="Close message log">
                ×
              </button>
            </div>
            <div className="message-log-popup-content">
              <MessageLog messages={messages} />
              <div className="message-log-actions">
                <button 
                  onClick={handlePing} 
                  className="control-btn ping-btn"
                  style={{ marginBottom: '0.5rem' }}
                >
                  Ping Server
                </button>
              </div>
              <div className="message-log-chat-form">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.target.querySelector('input[type="text"]');
                    if (input && input.value.trim()) {
                      handleChat(input.value.trim());
                      input.value = '';
                    }
                  }}
                >
                  <input
                    type="text"
                    placeholder="Type a message..."
                    maxLength={200}
                    autoComplete="off"
                  />
                  <button type="submit" className="chat-send-btn">
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      <main className="app-main" role="main">
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
          <div className="game-layout">
            {/* Left Sidebar - Fixed width, always visible */}
            <aside className="left-sidebar">
              <div className="sidebar-content">
                {/* Game Controls */}
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
                onEndTurn={handleEndTurn}
                  onReconnect={handleReconnect}
                />
                {/* Player Cards (Hand) and Reference Information */}
                <InfoPanel
                  gameState={gameState}
                  currentPlayer={currentPlayer}
                  gameStarted={gameStarted}
                  isMyTurn={isMyTurn}
                  awaitingDisprove={awaitingDisprove}
                  refutePrompt={refutePrompt}
                  hand={gameStarted ? handCards : []}
                  knownCards={seenCards}
                  revealedCards={revealedCards}
                  solution={revealedSolution}
                  accusationResult={accusationResult}
                  onPlayAgain={handlePlayAgain}
                  showOnlyHand={true}
                />
              </div>
            </aside>

            {/* Center Panel - Gameboard (flex-grow, centered) */}
            <main className="board-section">
              <GameBoard 
                gameState={gameState}
                gameStarted={gameStarted}
                players={players}
              />
            </main>

            {/* Right Sidebar - Fixed width, always visible */}
            <aside className="right-sidebar">
              <div className="sidebar-content">
                {/* Game Lobby (full version when game not started) */}
                {!gameStarted && (
                  <GameLobby 
                    players={players}
                    currentPlayer={currentPlayer}
                    gameStarted={gameStarted}
                    leaderId={leaderId}
                    onSelectCharacter={handleSelectCharacter}
                    onStartGame={handleStartGame}
                    showOnlyCharacterSelection={false}
                  />
                )}
                {/* Info Panel (game state, turn info, etc.) - without hand and reference */}
                <InfoPanel
                  gameState={gameState}
                  currentPlayer={currentPlayer}
                  gameStarted={gameStarted}
                  isMyTurn={isMyTurn}
                  awaitingDisprove={awaitingDisprove}
                  refutePrompt={refutePrompt}
                  hand={handCards}
                  knownCards={seenCards}
                  revealedCards={revealedCards}
                  solution={revealedSolution}
                  accusationResult={accusationResult}
                  onPlayAgain={handlePlayAgain}
                  hideHandAndReference={true}
                />
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Disprove Overlay - visible to all players while a suggestion is pending */}
      {refutePrompt && (() => {
        const order = refutePrompt.order || [];
        const idx = typeof refutePrompt.index === 'number' ? refutePrompt.index : 0;
        const targetId = order[idx];
        const targetName =
          players.find((p) => p.id === targetId)?.name ||
          gameState?.players?.find((p) => p.id === targetId)?.name ||
          targetId ||
          'Next player';
        const isMe = targetId === currentPlayer?.id;
        
        // Find matching cards in hand
        const normalizeCardKey = (value) => {
          if (typeof value !== 'string') return '';
          return value.replace(/^[^:]+:/, '').toLowerCase().trim();
        };
        
        const matchingCards = (() => {
          if (!Array.isArray(handCards) || !refutePrompt) return [];
          const { suspectId, weaponId, roomId } = refutePrompt;
          const wanted = new Set(
            [suspectId, weaponId, roomId]
              .filter(Boolean)
              .map((v) => normalizeCardKey(v))
          );
          return handCards.filter((card) => wanted.has(normalizeCardKey(card)));
        })();
        
        const canDisprove = matchingCards.length > 0;
        
        return (
          <>
            <div className="disprove-backdrop"></div>
            <div className="disprove-overlay" role="dialog" aria-modal="true">
              <div className="disprove-header">
                <h4>Suggestion Pending</h4>
              </div>
              <div className="disprove-body">
                <p className="disprove-line">
                  <strong>Suspect:</strong> {stripPrefix(refutePrompt.suspectId)}
                </p>
                <p className="disprove-line">
                  <strong>Weapon:</strong> {stripPrefix(refutePrompt.weaponId)}
                </p>
                <p className="disprove-line">
                  <strong>Room:</strong> {stripPrefix(refutePrompt.roomId)}
                </p>
                <p className="disprove-line emphasised">
                  {isMe
                    ? 'Your turn to disprove the suggestion'
                    : `Waiting for ${targetName} to disprove...`}
                </p>
                
                {/* Card selection form for the player who needs to disprove */}
                {isMe && (
                  <form 
                    className="disprove-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      const cardId = formData.get("cardId");
                      
                      // If player can disprove, they must select a card
                      if (canDisprove && (!cardId || cardId.trim() === "")) {
                        return;
                      }
                      
                      // Send null if no card selected (pass)
                      const finalCardId = (cardId && cardId.trim() !== "") ? cardId : null;
                      handleDisprove(finalCardId);
                    }}
                  >
                    {canDisprove ? (
                      <div className="disprove-form-group">
                        <label htmlFor="disprove-card-select-overlay">
                          Choose a card to show to disprove this suggestion:
                        </label>
                        <select
                          id="disprove-card-select-overlay"
                          name="cardId"
                          required
                          className="disprove-select"
                        >
                          <option value="">Select a matching card</option>
                          {matchingCards.map((card) => (
                            <option key={card} value={card}>
                              {stripPrefix(card)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <p className="disprove-help-text">
                        You do not have any cards that can disprove this suggestion.
                        Click "Pass" to continue.
                      </p>
                    )}
                    <div className="disprove-form-actions">
                      <button type="submit" className="disprove-submit-btn">
                        {canDisprove ? "Show Card" : "Pass"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

export default App;
