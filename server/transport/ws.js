const WebSocket = require('ws');
const { routeMessage } = require('../handlers/router');
const { makeEnv } = require('../schema/envelope');
const { safeSend, broadcast } = require('../utils/send');
const { games, publicPlayers, advanceTurn, ensureActiveTurn, evaluateGameStatus } = require('../state/games');
const { broadcastTurnState } = require('../handlers/turn');
const T = require('../schema/types');

function createWSS(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer });

  wss.on('connection', (ws) => {
    console.log('[ws] client connected');
    safeSend(ws, makeEnv('INFO', 'NA', { message: 'Welcome to Clue-Less skeletal!' }));

    ws.on('message', (raw) => {
      const txt = raw.toString();
      routeMessage(ws, txt);
    });

    ws.on('close', () => {
      console.log('[ws] client disconnected');
      // On close, remove player from game
      for (const g of Object.values(games)) {
        for (const pId in g.players) {
          const p = g.players[pId];
          if (p.ws === ws) {
            const playerName = p.name;
            const playerId = p.id;
            
            const removedWasCurrent = g.currentPlayerId === playerId;
            
            // Remove from players list
            delete g.players[pId];
            
            // Remove from turn order
            const turnIndex = g.turnOrder.indexOf(playerId);
            if (turnIndex !== -1) {
              g.turnOrder.splice(turnIndex, 1);
              if (g.turnIndex >= g.turnOrder.length) {
                g.turnIndex = g.turnOrder.length - 1;
              }
              if (g.turnIndex < 0) g.turnIndex = -1;
            }

            // Reassign leader if necessary
            if (g.leaderId === playerId) {
              g.leaderId = g.turnOrder.length > 0 ? g.turnOrder[0] : null;
              if (g.leaderId) {
                const newLeader = g.players[g.leaderId];
                console.log(`[${g.gameId}] New lobby leader: ${newLeader?.name || g.leaderId}`);
              }
            }
            
            console.log(`[${g.gameId}] Player removed: ${playerName} (${playerId})`);
            
            // Notify remaining players
            broadcast(g, makeEnv(T.PLAYER_LEFT, g.gameId, { 
              playerId,
              name: playerName,
              message: `${playerName} left the game` 
            }));
            broadcast(g, makeEnv(T.LOBBY_STATE, g.gameId, { 
              players: publicPlayers(g),
              leaderId: g.leaderId
            }));

            if (g.started && !g.ended) {
              const status = evaluateGameStatus(g);
              if (status.ended) {
                g.started = false;
                g.ended = true;
                g.winnerId = status.winnerId;
                g.turnState = null;
                g.currentPlayerId = null;
                broadcast(g, makeEnv(T.GAME_OVER, g.gameId, {
                  winnerId: status.winnerId,
                  solution: g.solution,
                  reason: status.reason
                }));
              } else if (removedWasCurrent) {
                const { playerId: nextPlayerId, turnState } = advanceTurn(g);
                if (nextPlayerId) {
                  broadcastTurnState(g, nextPlayerId, turnState, 'PLAYER_DISCONNECTED');
                }
              } else {
                const { playerId: activeId, turnState } = ensureActiveTurn(g);
                if (activeId) {
                  broadcastTurnState(g, activeId, turnState, 'PLAYER_DISCONNECTED');
                }
              }
            }
            
            // If game is empty, optionally clean it up
            if (Object.keys(g.players).length === 0) {
              console.log(`[${g.gameId}] Game is now empty`);
            }
          }
        }
      }
    });
  });

  return wss;
}

module.exports = { createWSS };
