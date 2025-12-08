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

const SUSPECT_ID_MAP = {
  "Miss Scarlet": "scarlet",
  "Colonel Mustard": "mustard",
  "Mrs. White": "white",
  "Mr. Green": "green",
  "Mrs. Peacock": "peacock",
  "Professor Plum": "plum",
};

const WEAPON_ID_MAP = {
  Candlestick: "candlestick",
  Knife: "knife",
  "Lead Pipe": "leadpipe",
  Revolver: "revolver",
  Rope: "rope",
  Wrench: "wrench",
};

const ROOM_ID_MAP = {
  Kitchen: "kitchen",
  Ballroom: "ballroom",
  Conservatory: "conservatory",
  "Dining Room": "dining",
  "Billiard Room": "billiard",
  Library: "library",
  Lounge: "lounge",
  Hall: "hall",
  Study: "study",
};



const stripPrefix = (value) =>
  typeof value === "string" ? value.replace(/^[^:]+:/, "") : value;

const getCardCategory = (card) => {
  if (typeof card === "string") {
    if (card.startsWith("suspect:")) return "SUSPECT";
    if (card.startsWith("weapon:")) return "WEAPON";
    if (card.startsWith("room:")) return "ROOM";
  }

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
    // Before game starts, players are in lobby
    // After game starts, positions should be assigned but show waiting if not set yet
    return gameStarted ? "Starting position..." : "Lobby";
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
  knownCards,
  revealedCards = [],
  solution,
  accusationResult,
  onPlayAgain,
  showOnlyHand = false,
  hideHandAndReference = false,
}) => {
  const [handFilter, setHandFilter] = useState("ALL");
  const [selectedCard, setSelectedCard] = useState(null);
  const [referenceFilter, setReferenceFilter] = useState("ALL");

  if (!gameState) return null;

  const combinedKnown = new Set([
    ...(Array.isArray(hand) ? hand : []),
    ...(Array.isArray(knownCards) ? knownCards : []),
  ]);

  const hasCardInHand = (category, displayName) => {
    if (!combinedKnown.size) return false;

    let idSuffix;
    let prefix;

    switch (category) {
      case "SUSPECT":
        idSuffix = SUSPECT_ID_MAP[displayName];
        prefix = "suspect";
        break;
      case "WEAPON":
        idSuffix = WEAPON_ID_MAP[displayName];
        prefix = "weapon";
        break;
      case "ROOM":
        idSuffix = ROOM_ID_MAP[displayName];
        prefix = "room";
        break;
      default:
        return false;
    }

    if (!idSuffix) return false;
    const fullId = `${prefix}:${idSuffix}`;
    return combinedKnown.has(fullId);
  };


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


  const renderGameAndPlayerInfo = () => (
    <div className="panel-section">
      <h4>Game & Player Information</h4>
      <div className="info-grid">
        {/* Game State */}
        <div className="info-item">
          <strong>Phase:</strong> {gameState.turn?.phase || "Lobby"}
        </div>
        <div className="info-item">
          <strong>Current Turn:</strong> {currentTurnName}
        </div>
        {gameState.turn?.mustSuggest && (
          <div className="info-item warning">
            <strong>⚠️ Must Suggest:</strong> You must make a suggestion after your move.
          </div>
        )}
        {gameState.turn?.hasMoved && (
          <div className="info-item">
            <strong>Status:</strong> Already moved this turn
          </div>
        )}
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
        
        {/* Player Information */}
        {currentPlayer && (
          <>
            <div className="info-item info-divider">
              <strong>Your Info</strong>
            </div>
            <div className="info-item">
              <strong>Name:</strong> {currentPlayer.name}
            </div>
            <div className="info-item">
              <strong>Character:</strong>{" "}
              {currentPlayer.characterId || "Not selected"}
            </div>
            <div className="info-item">
              <strong>Status:</strong>{" "}
              {currentPlayer.eliminated ? "Eliminated" : "Active"}
            </div>
            <div className="info-item">
              <strong>Position:</strong>{" "}
              {formatPosition(currentPlayer.position, gameStarted)}
            </div>
          </>
        )}
      </div>
    </div>
  );

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

  const renderRevealedCards = () => {
    if (!gameStarted || !Array.isArray(revealedCards) || revealedCards.length === 0) {
      return null;
    }

    const formatTimestamp = (timestamp) => {
      try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return '';
      }
    };

    return (
      <div className="panel-section revealed-cards-section">
        <h4>Revealed Cards Log</h4>
        <div className="revealed-cards-list" role="list">
          {revealedCards.map((entry, index) => (
            <div key={index} className="revealed-card-entry" role="listitem">
              <div className="revealed-card-header">
                <span className="revealed-card-player">
                  {entry.player}
                  {entry.character && <span className="revealed-card-character"> ({entry.character})</span>}
                </span>
                {entry.timestamp && (
                  <span className="revealed-card-time">{formatTimestamp(entry.timestamp)}</span>
                )}
              </div>
              <div className="revealed-card-name">
                {getCardDescription(entry.cardId || entry.card)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderReference = () => {
    const handleReferenceFilterChange = (filter) => {
      setReferenceFilter(filter);
    };

    const getReferenceItems = () => {
      switch (referenceFilter) {
        case "SUSPECT":
          return SUSPECTS.map(item => ({ name: item, category: "SUSPECT" }));
        case "WEAPON":
          return WEAPONS.map(item => ({ name: item, category: "WEAPON" }));
        case "ROOM":
          return ROOMS.map(item => ({ name: item, category: "ROOM" }));
        default:
          return [
            ...SUSPECTS.map(item => ({ name: item, category: "SUSPECT" })),
            ...WEAPONS.map(item => ({ name: item, category: "WEAPON" })),
            ...ROOMS.map(item => ({ name: item, category: "ROOM" }))
          ];
      }
    };

    const filteredItems = getReferenceItems();

    return (
      <div className="panel-section hand-panel reference-panel">
        <div className="hand-header">
          <h4>Reference</h4>
          <div
            className="hand-filters"
            role="radiogroup"
            aria-label="Filter reference by type"
          >
            {["ALL", "SUSPECT", "WEAPON", "ROOM"].map((filter) => (
              <button
                key={filter}
                type="button"
                className={`hand-filter-btn${
                  referenceFilter === filter ? " hand-filter-btn--active" : ""
                }`}
                onClick={() => handleReferenceFilterChange(filter)}
                aria-pressed={referenceFilter === filter}
              >
                {filter === "ALL"
                  ? "All"
                  : filter.charAt(0) + filter.slice(1).toLowerCase() + "s"}
              </button>
            ))}
          </div>
        </div>

        <div className="hand-cards reference-cards" role="list">
          {filteredItems.map((item) => {
            const inHand = hasCardInHand(item.category, item.name);
            return (
              <button
                key={`${item.category}-${item.name}`}
                type="button"
                className={`hand-card hand-card--${item.category.toLowerCase()}${
                  inHand ? " hand-card--in-hand" : ""
                }`}
                role="listitem"
                aria-label={item.name}
                title={item.name}
              >
                <span className="hand-card-name">{item.name}</span>
                <span className="hand-card-category">
                  {item.category.toLowerCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // If only showing hand, render just hand, reference, and revealed cards
  if (showOnlyHand) {
    return (
      <div className="info-panel">
        {renderHand()}
        {renderRevealedCards()}
        {renderReference()}
      </div>
    );
  }

  // If hiding hand and reference, exclude them from the panel but show revealed cards
  if (hideHandAndReference) {
    return (
      <div className="info-panel">
        {renderTurnBanner()}
        {renderAccusationBanner()}
        {renderSuggestionInfo()}
        {renderGameAndPlayerInfo()}
        {renderRevealedCards()}
        {renderSolution()}
      </div>
    );
  }

  return (
    <div className="info-panel">
      {renderTurnBanner()}
      {renderAccusationBanner()}
      {renderSuggestionInfo()}
      {renderGameAndPlayerInfo()}
      {renderHand()}
      {renderRevealedCards()}
      {renderSolution()}
      {renderReference()}
    </div>
  );
};

export default InfoPanel;