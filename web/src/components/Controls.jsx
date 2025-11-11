import React, { useEffect, useMemo, useState } from "react";

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

const SECRET_PASSAGES = {
  Study: "Kitchen",
  Kitchen: "Study",
  Lounge: "Conservatory",
  Conservatory: "Lounge",
};

const isHallway = (locationId) =>
  typeof locationId === "string" &&
  (locationId.startsWith("H") || locationId.startsWith("V"));

const formatLocationLabel = (locationId) => {
  if (!locationId) return "Unknown";
  if (isHallway(locationId)) {
    return `Hallway ${locationId}`;
  }
  return locationId;
};

const Controls = ({
  gameStarted,
  currentPlayer,
  isMyTurn,
  awaitingDisprove,
  refutePrompt,
  legalMoves,
  hand,
  accusationResult,
  solutionRevealed,
  onMove,
  onSuggestion,
  onDisprove,
  onAccusation,
  onChat,
  onPing,
  onEndTurn,
}) => {
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [showAccusationForm, setShowAccusationForm] = useState(false);
  const [showChatForm, setShowChatForm] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

  const currentRoom =
    currentPlayer?.position?.zone === "ROOM" ? currentPlayer.position.id : null;
  const legalMoveOptions = useMemo(
    () => (Array.isArray(legalMoves) ? legalMoves : []),
    [legalMoves]
  );

  const canAct =
    gameStarted && isMyTurn && !awaitingDisprove && !currentPlayer?.eliminated;
  const canMove = canAct && legalMoveOptions.length > 0;
  const canSuggest = canAct && !!currentRoom;
  const canAccuse = canAct && !accusationResult && !solutionRevealed;
  const pendingDisproveForMe =
    awaitingDisprove &&
    refutePrompt &&
    refutePrompt.nextPlayerId === currentPlayer?.id;

  useEffect(() => {
    if (!canMove) {
      setShowMoveForm(false);
    }
    if (!canSuggest) {
      setShowSuggestionForm(false);
    }
    if (!canAccuse) {
      setShowAccusationForm(false);
    }
  }, [canMove, canSuggest, canAccuse]);

  const handleMove = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const destinationId = formData.get("destinationId");
    if (!destinationId) return;
    const to = isHallway(destinationId) ? "HALLWAY" : "ROOM";
    const useSecretPassage =
      currentRoom && SECRET_PASSAGES[currentRoom] === destinationId;
    onMove(to, destinationId, useSecretPassage);
    setShowMoveForm(false);
  };

  const handleSuggestion = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const suspectId = formData.get("suspectId");
    const weaponId = formData.get("weaponId");
    onSuggestion(suspectId, weaponId);
    setShowSuggestionForm(false);
  };

  const handleAccusation = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const suspectId = formData.get("suspectId");
    const weaponId = formData.get("weaponId");
    const roomId = formData.get("roomId");
    onAccusation(suspectId, weaponId, roomId);
    setShowAccusationForm(false);
  };

  const handleDisprove = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const cardId = formData.get("cardId");
    onDisprove(cardId || null);
  };

  const handleChat = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      onChat(chatMessage.trim());
      setChatMessage("");
      setShowChatForm(false);
    }
  };

  const renderAwaitingBanner = () => {
    if (!awaitingDisprove) return null;
    if (pendingDisproveForMe) {
      return (
        <div className="banner warning">
          You must choose a card to disprove the suggestion.
        </div>
      );
    }
    return (
      <div className="banner info">
        Waiting for another player to respond to the suggestion...
      </div>
    );
  };

  const disproveCards = Array.isArray(hand) ? hand : [];

  return (
    <div className="controls">
      <h3>Game Controls</h3>

      {renderAwaitingBanner()}

      {!gameStarted && (
        <div className="banner info">Game not started yet.</div>
      )}

      <div className="basic-controls">
        <button onClick={onPing} className="control-btn ping-btn">
          Ping Server
        </button>

        <button
          onClick={() => setShowChatForm(!showChatForm)}
          className="control-btn chat-btn"
        >
          Send Chat
        </button>

        <button
          onClick={onEndTurn}
          className="control-btn end-turn-btn"
          disabled={!canAct}
          title={canAct ? "End your turn" : "Cannot end turn right now"}
        >
          End Turn
        </button>
      </div>

      {gameStarted && (
        <div className="game-controls">
          <h4>Game Actions</h4>

          <button
            onClick={() => setShowMoveForm(!showMoveForm)}
            className="control-btn move-btn"
            disabled={!canMove}
            title={
              canMove
                ? "Move to one of the legal destinations"
                : "No legal moves available"
            }
          >
            Move
          </button>

          <button
            onClick={() => setShowSuggestionForm(!showSuggestionForm)}
            className="control-btn suggestion-btn"
            disabled={!canSuggest}
            title={
              canSuggest
                ? "Make a suggestion in this room"
                : "You must be in a room on your turn to suggest"
            }
          >
            Make Suggestion
          </button>

          <button
            onClick={() => setShowAccusationForm(!showAccusationForm)}
            className="control-btn accusation-btn"
            disabled={!canAccuse}
            title={
              canAccuse
                ? "Make an accusation"
                : "You already acted or the game has ended"
            }
          >
            Make Accusation
          </button>
        </div>
      )}

      {showMoveForm && (
        <div className="control-form">
          <h4>Move Player</h4>
          {legalMoveOptions.length === 0 ? (
            <p>No legal moves available.</p>
          ) : (
            <form onSubmit={handleMove}>
              <div className="form-group">
                <label>Legal destinations:</label>
                <select name="destinationId" required>
                  <option value="">Select destination</option>
                  {legalMoveOptions.map((locationId) => (
                    <option key={locationId} value={locationId}>
                      {formatLocationLabel(locationId)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="submit">Move</button>
                <button type="button" onClick={() => setShowMoveForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {showSuggestionForm && canSuggest && (
        <div className="control-form">
          <h4>Make Suggestion</h4>
          <form onSubmit={handleSuggestion}>
            <div className="form-group">
              <label>Current Room:</label>
              <input type="text" value={currentRoom || "Unknown"} readOnly />
            </div>
            <div className="form-group">
              <label>Suspect:</label>
              <select name="suspectId" required>
                <option value="">Select suspect</option>
                {SUSPECTS.map((suspect) => (
                  <option key={suspect} value={suspect}>
                    {suspect}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Weapon:</label>
              <select name="weaponId" required>
                <option value="">Select weapon</option>
                {WEAPONS.map((weapon) => (
                  <option key={weapon} value={weapon}>
                    {weapon}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button type="submit">Make Suggestion</button>
              <button type="button" onClick={() => setShowSuggestionForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDisproveForMe && (
        <div className="control-form">
          <h4>Respond to Suggestion</h4>
          <form onSubmit={handleDisprove}>
            <div className="form-group">
              <label>Choose a card to show (optional):</label>
              <select name="cardId">
                <option value="">Pass (no matching card)</option>
                {disproveCards.map((card) => (
                  <option key={card} value={card}>
                    {card}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button type="submit">Respond</button>
            </div>
          </form>
        </div>
      )}

      {showAccusationForm && (
        <div className="control-form">
          <h4>Make Accusation</h4>
          <form onSubmit={handleAccusation}>
            <div className="form-group">
              <label>Suspect:</label>
              <select name="suspectId" required>
                <option value="">Select suspect</option>
                {SUSPECTS.map((suspect) => (
                  <option key={suspect} value={suspect}>
                    {suspect}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Weapon:</label>
              <select name="weaponId" required>
                <option value="">Select weapon</option>
                {WEAPONS.map((weapon) => (
                  <option key={weapon} value={weapon}>
                    {weapon}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Room:</label>
              <select name="roomId" required>
                <option value="">Select room</option>
                {ROOMS.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button type="submit" className="accusation-submit">
                Make Accusation
              </button>
              <button
                type="button"
                onClick={() => setShowAccusationForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {accusationResult && (
        <div
          className={`banner ${
            accusationResult.correct ? "success" : "warning"
          }`}
        >
          {accusationResult.correct
            ? "Your accusation was correct!"
            : "Your accusation was incorrect."}
        </div>
      )}

      {showChatForm && (
        <div className="control-form">
          <h4>Send Chat Message</h4>
          <form onSubmit={handleChat}>
            <div className="form-group">
              <label>Message:</label>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Enter your message"
                maxLength={256}
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit">Send</button>
              <button type="button" onClick={() => setShowChatForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Controls;
