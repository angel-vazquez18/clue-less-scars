const { makeEnv } = require('../schema/envelope');
const { broadcast, sendToPlayer } = require('../utils/send');
const { resolveGameAndPlayer, playerHasCard, isCardRelevantToSuggestion, ensureActiveTurn } = require('../state/games');
const { promptNextDisprover, concludeNoRefutation } = require('./suggestion');
const { broadcastTurnState } = require('./turn');
const T = require('../schema/types');

function handleRespondDisprove(ws, env) {
  const { gameId, payload, requestId } = env;
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
      message: 'Game is not active'
    }, requestId));
  }

  const pending = game.pendingSuggestion;
  if (!pending) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NO_PENDING_SUGGESTION',
      message: 'There is no suggestion awaiting disproval'
    }, requestId));
  }

  const expectedPlayerId = pending.order[pending.index];
  if (player.id !== expectedPlayerId) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NOT_EXPECTED_PLAYER',
      message: 'You are not the current player asked to disprove'
    }, requestId));
  }

  const { cardId = null } = payload || {};

  if (cardId) {
    if (!playerHasCard(player, cardId)) {
      return safe(ws, makeEnv(T.ERROR, gameId, {
        code: 'CARD_NOT_OWNED',
        message: 'You cannot reveal a card you do not possess'
      }, requestId));
    }

    if (!isCardRelevantToSuggestion(cardId, pending)) {
      return safe(ws, makeEnv(T.ERROR, gameId, {
        code: 'INVALID_CARD_CHOICE',
        message: 'Selected card does not match the suggestion'
      }, requestId));
    }

    // Reveal privately to suggester
    sendToPlayer(game, pending.suggesterId, T.DISPROVE_RESULT, { 
      disproverId: player.id,
      cardId,
      resolved: true
    });

    // Notify all players without revealing the card
    broadcast(game, makeEnv(T.DISPROVE_RESULT, gameId, { 
      disproverId: player.id,
      resolved: true
    }));

    game.pendingSuggestion = null;
    const { playerId: activeId, turnState } = ensureActiveTurn(game);
    if (activeId) {
      broadcastTurnState(game, activeId, turnState, 'SUGGESTION_REFUTED');
    }
    return;
  }

  // Player cannot disprove; move to next
  pending.index += 1;

  if (pending.index >= pending.order.length) {
    concludeNoRefutation(game);
    return;
  }

  // Broadcast updated game state so all clients have the correct pendingSuggestion with updated index
  const { playerId: activeId, turnState } = ensureActiveTurn(game);
  if (activeId) {
    broadcastTurnState(game, activeId, turnState, 'DISPROVE_PASSED');
  }

  promptNextDisprover(game);
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleRespondDisprove };
