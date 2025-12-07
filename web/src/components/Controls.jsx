import React, { useEffect, useMemo, useRef, useState } from "react";

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

const suspectNameToId = (name) => {
  switch (name) {
    case "Miss Scarlet":
      return "suspect:scarlet";
    case "Colonel Mustard":
      return "suspect:mustard";
    case "Mrs. White":
      return "suspect:white";
    case "Mr. Green":
      return "suspect:green";
    case "Mrs. Peacock":
      return "suspect:peacock";
    case "Professor Plum":
      return "suspect:plum";
    default:
      return name;
  }
};

const weaponNameToId = (name) => {
  switch (name) {
    case "Candlestick":
      return "weapon:candlestick";
    case "Knife":
      return "weapon:knife";
    case "Lead Pipe":
      return "weapon:leadpipe";
    case "Revolver":
      return "weapon:revolver";
    case "Rope":
      return "weapon:rope";
    case "Wrench":
      return "weapon:wrench";
    default:
      return name;
  }
};

const roomNameToId = (name) => {
  switch (name) {
    case "Kitchen":
      return "room:kitchen";
    case "Ballroom":
      return "room:ballroom";
    case "Conservatory":
      return "room:conservatory";
    case "Dining Room":
      return "room:dining";
    case "Billiard Room":
      return "room:billiard";
    case "Library":
      return "room:library";
    case "Lounge":
      return "room:lounge";
    case "Hall":
      return "room:hall";
    case "Study":
      return "room:study";
    default:
      return name;
  }
};


const SECRET_PASSAGES = {
  Study: "Kitchen",
  Kitchen: "Study",
  Lounge: "Conservatory",
  Conservatory: "Lounge",
};

const stripPrefix = (value) =>
  typeof value === "string" ? value.replace(/^[^:]+:/, "") : value;

const normalizeCardKey = (value) =>
  typeof value === "string"
    ? stripPrefix(value).toLowerCase().trim()
    : "";

const isHallway = (locationId) =>
  typeof locationId === "string" &&
  (/^H\d/.test(locationId) || /^V\d/.test(locationId));

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

  const primaryActionRef = useRef(null);
  const disproveSelectRef = useRef(null);

  const matchingDisproveCards = useMemo(() => {
    if (!Array.isArray(hand) || !refutePrompt) return [];

    const { suspectId, weaponId, roomId } = refutePrompt;

    // Normalize suggestion ids and compare to normalized hand card ids
    const wanted = new Set(
      [suspectId, weaponId, roomId]
        .filter(Boolean)
        .map((v) => normalizeCardKey(v))
    );

    return hand.filter((card) => wanted.has(normalizeCardKey(card)));
  }, [hand, refutePrompt]);

  const canDisprove = matchingDisproveCards.length > 0;

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

  useEffect(() => {
    if (canAct && isMyTurn && primaryActionRef.current) {
      primaryActionRef.current.focus();
    }
  }, [canAct, isMyTurn]);

  useEffect(() => {
    if (pendingDisproveForMe && disproveSelectRef.current) {
      disproveSelectRef.current.focus();
    }
  }, [pendingDisproveForMe]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!canAct || !isMyTurn) return;
      if (event.defaultPrevented) return;

      const key = event.key.toLowerCase();
      switch (key) {
        case "m":
          if (canMove) {
            setShowMoveForm(true);
            event.preventDefault();
          }
          break;
        case "s":
          if (canSuggest) {
            setShowSuggestionForm(true);
            event.preventDefault();
          }
          break;
        case "a":
          if (canAccuse) {
            setShowAccusationForm(true);
            event.preventDefault();
          }
          break;
        case "e":
          onEndTurn();
          event.preventDefault();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canAct, canMove, canSuggest, canAccuse, isMyTurn, onEndTurn]);

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
    const suspectName = formData.get("suspectId");
    const weaponName = formData.get("weaponId");
    const suspectId = suspectName ? suspectNameToId(suspectName) : null;
    const weaponId = weaponName ? weaponNameToId(weaponName) : null;
    onSuggestion(suspectId, weaponId);
    setShowSuggestionForm(false);
  };

  const handleAccusation = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const suspectName = formData.get("suspectId");
    const weaponName = formData.get("weaponId");
    const roomName = formData.get("roomId");
    const suspectId = suspectName ? suspectNameToId(suspectName) : null;
    const weaponId = weaponName ? weaponNameToId(weaponName) : null;
    const roomId = roomName ? roomNameToId(roomName) : null;
    onAccusation(suspectId, weaponId, roomId);
    setShowAccusationForm(false);
  };

  const handleDisprove = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const cardId = formData.get("cardId");

    if (canDisprove && !cardId) {
      // You must choose a card if you have one that can disprove
      return;
    }

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

  return (
    <div className="controls">
      <h3>Game Controls</h3>

      {renderAwaitingBanner()}

      {!gameStarted && <div className="banner info">Game not started yet.</div>}

      <div className="basic-controls">
        <button onClick={onPing} className="control-btn ping-btn">
          Ping Server
        </button>

        <button
          onClick={() => setShowChatForm(!showChatForm)}
          className="control-btn chat-btn">
          Send Chat
        </button>

        <button
          onClick={onEndTurn}
          className="control-btn end-turn-btn"
          disabled={!canAct}
          title={canAct ? "End your turn" : "Cannot end turn right now"}>
          End Turn
        </button>
      </div>

      {gameStarted && (
        <div className="game-controls">
          <h4>Game Actions</h4>

          <button
            ref={primaryActionRef}
            onClick={() => setShowMoveForm(!showMoveForm)}
            className="control-btn move-btn"
            disabled={!canMove}
            title={
              canMove
                ? "Move to one of the legal destinations"
                : "No legal moves available"
            }>
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
            }>
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
            }>
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
                  {console.log("legalMoveOptions: ", legalMoveOptions)}
                  {!isHallway(legalMoveOptions[0])
                    ? legalMoveOptions.slice(0, 2).map((locationId) => (
                        <option key={locationId} value={locationId}>
                          {formatLocationLabel(locationId)}
                        </option>
                      ))
                    : legalMoveOptions
                        .splice(0, legalMoveOptions.length / 2)
                        .map((locationId) => (
                          <option key={locationId} value={locationId}>
                            {formatLocationLabel(locationId)}
                          </option>
                        ))}
                  {console.log(
                    "does not start wtih hallway: ",
                    !isHallway(legalMoveOptions[0]),
                    "first move option: ",
                    legalMoveOptions[0]
                  )}
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
              <button
                type="button"
                onClick={() => setShowSuggestionForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDisproveForMe && (
        <div
          className="control-form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disprove-title"
        >
          <h4 id="disprove-title">Respond to Suggestion</h4>
          {refutePrompt && (
            <p className="form-help-text">
              The suggestion you are responding to is{" "}
              <strong>{stripPrefix(refutePrompt.suspectId)}</strong> with{" "}
              <strong>{stripPrefix(refutePrompt.weaponId)}</strong> in{" "}
              <strong>{stripPrefix(refutePrompt.roomId)}</strong>.
            </p>
          )}
          <form onSubmit={handleDisprove}>
            {canDisprove ? (
              <div className="form-group">
                <label htmlFor="disprove-card-select">
                  Choose a card to show to disprove this suggestion:
                </label>
                <select
                  id="disprove-card-select"
                  name="cardId"
                  ref={disproveSelectRef}
                  required
                >
                  <option value="">Select a matching card</option>
                  {matchingDisproveCards.map((card) => (
                    <option key={card} value={card}>
                      {stripPrefix(card)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="form-help-text">
                You do not have any cards that can disprove this suggestion.
                Submit to pass.
              </p>
            )}
            <div className="form-actions">
              <button type="submit">
                {canDisprove ? "Show Card" : "Pass"}
              </button>
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
                onClick={() => setShowAccusationForm(false)}>
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
          }`}>
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
