const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { 
  resolveGameAndPlayer,
  getCurrentPlayer,
  ensureTurnMoveState,
  updateLegalMoves,
  rollDice
} = require('../state/games');
const { broadcastTurnState } = require('./turn');
const T = require('../schema/types');

function handleRollDice(ws, env) {
  const { gameId, requestId } = env;
  const { game, player } = resolveGameAndPlayer(ws, gameId);

  if (!game || !player) {
    return safe(ws, makeEnv(T.ERROR, gameId || 'NA', {
      code: 'NOT_JOINED',
      message: 'You must JOIN_GAME first'
    }, requestId));
  }

  if (!game.started || game.ended) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'GAME_NOT_ACTIVE',
      message: 'Game is not currently active'
    }, requestId));
  }

  if (player.eliminated) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'PLAYER_ELIMINATED',
      message: 'Eliminated players cannot act'
    }, requestId));
  }

  const currentPlayerId = getCurrentPlayer(game);
  if (player.id !== currentPlayerId) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NOT_YOUR_TURN',
      message: 'Only the active player may roll dice'
    }, requestId));
  }

  // Ensure turn state exists (but don't auto-roll)
  if (!game.turnState || game.turnState.playerId !== currentPlayerId) {
    // Initialize turn state without dice roll
    game.turnState = {
      playerId: currentPlayerId,
      diceRoll: null,
      movementAllowance: null,
      movesRemaining: null,
      secretPassageUsed: false,
      legalMoves: [],
    };
  }

  // Only allow rolling if dice hasn't been rolled yet
  if (game.turnState.diceRoll != null) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'DICE_ALREADY_ROLLED',
      message: 'Dice has already been rolled for this turn'
    }, requestId));
  }

  // Roll the dice (2d6)
  const diceRoll = rollDice();
  game.turnState.diceRoll = diceRoll;
  game.turnState.movementAllowance = diceRoll;
  game.turnState.movesRemaining = diceRoll;

  // Update legal moves now that we have movement allowance
  updateLegalMoves(game);

  // Broadcast the updated turn state
  broadcastTurnState(game, currentPlayerId, game.turnState, 'DICE_ROLLED');

  // Send success response
  safe(ws, makeEnv(T.INFO, gameId, {
    message: `Dice rolled: ${diceRoll} (${diceRoll} moves available)`
  }, requestId));
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); }
}

module.exports = { handleRollDice };

