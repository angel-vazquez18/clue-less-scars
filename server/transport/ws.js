const WebSocket = require('ws');
const { routeMessage } = require('../handlers/router');
const { makeEnv } = require('../schema/envelope');
const { safeSend, broadcast } = require('../utils/send');
const { games } = require('../state/games');
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
            
            // Remove from players list
            delete g.players[pId];
            
            // Remove from turn order
            const turnIndex = g.turnOrder.indexOf(playerId);
            if (turnIndex !== -1) {
              g.turnOrder.splice(turnIndex, 1);
            }
            
            console.log(`[${g.gameId}] Player removed: ${playerName} (${playerId})`);
            
            // Notify remaining players
            const { publicPlayers } = require('../state/games');
            broadcast(g, makeEnv(T.PLAYER_LEFT, g.gameId, { 
              playerId,
              name: playerName,
              message: `${playerName} left the game` 
            }));
            broadcast(g, makeEnv(T.LOBBY_STATE, g.gameId, { 
              players: publicPlayers(g) 
            }));
            
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
