import React, { useState } from "react";

const SUSPECTS = [
  "Miss Scarlet",
  "Colonel Mustard",
  "Mrs. White",
  "Mr. Green",
  "Mrs. Peacock",
  "Professor Plum",
];

const WEAPONS = [
  "Candlestick",
  "Knife",
  "Lead Pipe",
  "Revolver",
  "Rope",
  "Wrench",
];

const ROOMS = [
  "Kitchen",
  "Ballroom",
  "Conservatory",
  "Dining Room",
  "Billiard Room",
  "Library",
  "Lounge",
  "Hall",
  "Study",
];

const stripPrefix = (value) =>
  typeof value === "string" ? value.replace(/^[^:]+:/, "") : value;

const getCardCategory = (card) => {
  const name = stripPrefix(card);
  if (SUSPECTS.includes(name)) return "SUSPECT";
  if (WEAPONS.includes(name)) return "WEAPON";
  if (ROOMS.includes(name)) return "ROOM";
  return "UNKNOWN";
};

const getCardDescription = (card) => {
  const category = getCardCategory(card);
  const name = stripPrefix(card);
  switch (category) {
    case "SUSPECT":
      return `${name} (suspect)`;
    case "WEAPON":
      return `${name} (weapon)`;
    case "ROOM":
      return `${name} (room)`;
    default:
      return name;
  }
};

const formatPosition = (position, gameStarted) => {
  if (!position) {
    return gameStarted ? "Not placed" : "Lobby";
  }
  if (typeof position === "string") {
    return position;
  }
  const { zone, id, secret } = position;
  const parts = [];
  if (id) parts.push(id);
  else if (zone) parts.push(zone);
  if (secret) parts.push("(Secret Passage)");
  return parts.length > 0 ? parts.join(" ") : "Unknown";
};

const InfoPanel = ({
  gameState,
  currentPlayer,
  gameStarted,
  isMyTurn,
  awaitingDisprove,
  refutePrompt,
  hand,
  solution,
  accusationResult,
  onPlayAgain,
}) => {
  const [handFilter, setHandFilter] = useState("ALL");
  const [selectedCard, setSelectedCard] = useState(null);

  if (!gameState) return null;

  const currentTurnPlayerId = gameState.turn?.currentPlayerId;
  const currentTurnPlayer = gameState.players?.find(
    (p) => p.id === currentTurnPlayerId
  );
  const currentTurnName =
    currentTurnPlayer?.name || currentTurnPlayerId || "None";
  const suggestion = gameState.pendingSuggestion || refutePrompt || null;
  const awaitingMe =
    awaitingDisprove && suggestion?.nextPlayerId === currentPlayer?.id;

  const renderTurnBanner = () => {
    if (!gameStarted) return null;
    if (isMyTurn) {
      return <div className="banner success">It’s your turn!</div>;
    }
    if (awaitingMe) {
      return (
        <div className="banner warning">
          Select a card to disprove the suggestion.
        </div>
      );
    }
    if (awaitingDisprove) {
      return (
        <div className="banner info">
          Waiting for the next player to respond to the suggestion…
        </div>
      );
    }
    return null;
  };

  const renderAccusationBanner = () => {
    if (!accusationResult) return null;
    return (
      <div
        className={`banner ${
          accusationResult.correct ? "success" : "warning"
        }`}
      >
        {accusationResult.correct
          ? "Your accusation was correct!"
          : "Your accusation was incorrect."}
      </div>
    );
  };

  const renderSuggestionInfo = () => {
    if (!suggestion) return null;
    return (
      <div className="panel-section">
        <h4>Current Suggestion</h4>
        <p>
          <strong>Suspect:</strong> {suggestion.suspectId}
        </p>
        <p>
          <strong>Weapon:</strong> {suggestion.weaponId}
        </p>
        <p>
          <strong>Room:</strong>{" "}
          {suggestion.roomId || currentPlayer?.position?.id || "Unknown"}
        </p>
      </div>
    );
  };

  const renderGameInfo = () => (
    <div className="panel-section">
      <h4>Game Information</h4>
      <div className="info-grid">
        <div className="info-item">
          <strong>Phase:</strong> {gameState.turn?.phase || "Lobby"}
        </div>
        <div className="info-item">
          <strong>Current Turn:</strong> {currentTurnName}
        </div>
        <div className="info-item">
          <strong>Moves Available:</strong>{" "}
          {gameState.turn?.movementAllowance != null
            ? gameState.turn.movementAllowance
            : "—"}
        </div>
        <div className="info-item">
          <strong>Moves Remaining:</strong>{" "}
          {gameState.turn?.movesRemaining != null
            ? gameState.turn.movesRemaining
            : "—"}
        </div>
        <div className="info-item">
          <strong>Legal Moves:</strong>{" "}
          {gameState.turn?.legalMoves
            ? gameState.turn.legalMoves.length
            : 0}
        </div>
        <div className="info-item">
          <strong>Turn Order:</strong>{" "}
          {gameState.turn?.order?.length || 0} players
        </div>
      </div>
    </div>
  );

  const renderCurrentPlayerInfo = () => {
    if (!currentPlayer) return null;
    return (
      <div className="panel-section">
        <h4>Your Information</h4>
        <div className="player-details">
          <div>
            <strong>Name:</strong> {currentPlayer.name}
          </div>
          <div>
            <strong>Character:</strong>{" "}
            {currentPlayer.characterId || "Not selected"}
          </div>
          <div>
            <strong>Status:</strong>{" "}
            {currentPlayer.eliminated ? "Eliminated" : "Active"}
          </div>
          <div>
            <strong>Position:</strong>{" "}
            {formatPosition(currentPlayer.position, gameStarted)}
          </div>
        </div>
      </div>
    );
  };

  const renderHand = () => {
    if (!Array.isArray(hand)) return null;

    const filteredHand =
      handFilter === "ALL"
        ? hand
        : hand.filter((card) => getCardCategory(card) === handFilter);

    const handleFilterChange = (filter) => {
      setHandFilter(filter);
      setSelectedCard(null);
    };

    if (hand.length === 0) {
      return (
        <div className="panel-section hand-panel">
          <h4>Your Cards</h4>
          <p>You have no cards.</p>
        </div>
      );
    }

    return (
      <div
        className="panel-section hand-panel"
        aria-label="Your hand of cards"
      >
        <div className="hand-header">
          <h4>Your Cards</h4>
          <div
            className="hand-filters"
            role="radiogroup"
            aria-label="Filter cards by type"
          >
            {["ALL", "SUSPECT", "WEAPON", "ROOM"].map((filter) => (
              <button
                key={filter}
                type="button"
                className={`hand-filter-btn${
                  handFilter === filter ? " hand-filter-btn--active" : ""
                }`}
                onClick={() => handleFilterChange(filter)}
                aria-pressed={handFilter === filter}
              >
                {filter === "ALL"
                  ? "All"
                  : filter.charAt(0) + filter.slice(1).toLowerCase() + "s"}
              </button>
            ))}
          </div>
        </div>

        <div className="hand-cards" role="list">
          {filteredHand.map((card) => {
            const category = getCardCategory(card);
            const name = stripPrefix(card);
            const isSelected = selectedCard === card;
            return (
              <button
                key={card}
                type="button"
                className={`hand-card hand-card--${category.toLowerCase()}${
                  isSelected ? " hand-card--selected" : ""
                }`}
                onClick={() => setSelectedCard(card)}
                onMouseEnter={() => setSelectedCard(card)}
                role="listitem"
                aria-label={getCardDescription(card)}
                title={getCardDescription(card)}
              >
                <span className="hand-card-name">{name}</span>
                <span className="hand-card-category">
                  {category === "UNKNOWN" ? "Card" : category.toLowerCase()}
                </span>
              </button>
            );
          })}
        </div>

        {selectedCard && (
          <div className="hand-card-details" aria-live="polite">
            <strong>Selected card:</strong> {getCardDescription(selectedCard)}
          </div>
        )}
      </div>
    );
  };

  const renderSolution = () => {
    if (!solution) return null;
    return (
      <div className="panel-section solution-panel">
        <h4>Solution Revealed</h4>
        <ul>
          <li>Suspect: {stripPrefix(solution.suspectId)}</li>
          <li>Weapon: {stripPrefix(solution.weaponId)}</li>
          <li>Room: {stripPrefix(solution.roomId)}</li>
        </ul>
        <button onClick={onPlayAgain} className="play-again-btn">
          Play Again
        </button>
      </div>
    );
  };

  const renderReference = () => (
    <div className="panel-section game-reference">
      <h4>Reference</h4>
      <div className="reference-sections">
        <div className="reference-section">
          <h5>Suspects</h5>
          <div className="reference-list">
            {SUSPECTS.map((suspect) => (
              <span key={suspect} className="reference-item">
                {suspect}
              </span>
            ))}
          </div>
        </div>
        <div className="reference-section">
          <h5>Weapons</h5>
          <div className="reference-list">
            {WEAPONS.map((weapon) => (
              <span key={weapon} className="reference-item">
                {weapon}
              </span>
            ))}
          </div>
        </div>
        <div className="reference-section">
          <h5>Rooms</h5>
          <div className="reference-list">
            {ROOMS.map((room) => (
              <span key={room} className="reference-item">
                {room}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="info-panel">
      {renderTurnBanner()}
      {renderAccusationBanner()}
      {renderSuggestionInfo()}
      {renderGameInfo()}
      {renderCurrentPlayerInfo()}
      {renderHand()}
      {renderSolution()}
      {renderReference()}
    </div>
  );
};

export default InfoPanel;

