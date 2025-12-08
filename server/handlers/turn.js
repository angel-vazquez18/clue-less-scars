const { makeEnv } = require('../schema/envelope');
const { broadcast, safeSend } = require('../utils/send');
const { publicPlayers } = require('../state/games');
const T = require('../schema/types');

function buildTurnPayload(game, currentPlayerId, turnState, reason) {
  const turn = {
    currentPlayerId,
    phase: game.started ? 'move' : 'lobby',
    order: game.turnOrder,
    movementAllowance: turnState?.movementAllowance ?? null,
    movesRemaining: turnState?.movesRemaining ?? null,
    diceRoll: turnState?.diceRoll ?? null,
    legalMoves: turnState?.legalMoves ?? []
  };
  if (reason) {
    turn.reason = reason;
  }

  return {
    board: game.board,
    players: publicPlayers(game),
    turn,
    leaderId: game.leaderId,
    pendingSuggestion: game.pendingSuggestion || null
  };
}

function broadcastTurnState(game, currentPlayerId, turnState, reason) {
  if (!game) return;

  const sharedPayload = buildTurnPayload(game, currentPlayerId, turnState, reason);

  Object.values(game.players).forEach(player => {
    if (!player || !player.ws) return;
    const personal = {
      ...sharedPayload,
      you: {
        id: player.id,
        name: player.name,
        characterId: player.characterId,
        isLeader: player.id === game.leaderId,
        eliminated: !!player.eliminated
      }
    };
    safeSend(player.ws, makeEnv(T.GAME_STATE, game.gameId, personal));
  });

  if (!currentPlayerId) return;

  const currentPlayer = game.players[currentPlayerId];
  const payload = {
    playerId: currentPlayerId,
    playerName: currentPlayer?.name || 'Unknown',
    movementAllowance: turnState?.movementAllowance ?? null,
    movesRemaining: turnState?.movesRemaining ?? null,
    diceRoll: turnState?.diceRoll ?? null,
    legalMoves: turnState?.legalMoves ?? [],
    autoAdvanced: reason === 'TURN_AUTO_ADVANCED'
  };
  if (reason) {
    payload.reason = reason;
  }

  broadcast(game, makeEnv(T.TURN_START, game.gameId, payload));
}

module.exports = { broadcastTurnState };

