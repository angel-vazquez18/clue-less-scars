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

//board ajacency list - to help determine possible move directions, if needed
const boardObj = {
  Study: ["H1", "V1", "Kitchen"],
  H1: ["Study", "Hall"],
  Hall: ["H1", "H2", "V2"],
  H2: ["Hall", "Lounge"],
  Lounge: ["H2", "V3", "Conservatory"],
  V1: ["Study", "Library"],
  V2: ["Hall", "Billiard Room"],
  V3: ["Lounge", "Dining Room"],
  Library: ["V1", "H3", "V4"],
  H3: ["Library", "Billiard Room"],
  "Billiard Room": ["H3", "H4", "V2", "V5"],
  H4: ["Billiard Room", "Dining Room"],
  "Dining Room": ["V3", "V6", "H4"],
  V4: ["Library", "Conservatory"],
  V5: ["Billiard Room", "Ballroom"],
  V6: ["Dining Room", "Kitchen"],
  Conservatory: ["V4", "H5", "Lounge"],
  H5: ["Conservatory", "Ballroom"],
  Ballroom: ["H5", "H6", "V5"],
  H6: ["Ballroom", "Kitchen"],
  Kitchen: ["H6", "V6", "Study"],
};

const Controls = ({
  gameStarted,
  currentPlayer,
  onMove,
  onSuggestion,
  onDisprove,
  onAccusation,
  onChat,
  onPing,
}) => {
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [showAccusationForm, setShowAccusationForm] = useState(false);
  const [showDisproveForm, setShowDisproveForm] = useState(false);
  const [showChatForm, setShowChatForm] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

  const handleMove = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const to = formData.get("moveTo");
    const targetId = formData.get("targetId");
    const useSecretPassage = formData.get("useSecretPassage") === "on";

    onMove(to, targetId, useSecretPassage);
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
    setShowDisproveForm(false);
  };

  const handleChat = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      onChat(chatMessage.trim());
      setChatMessage("");
      setShowChatForm(false);
    }
  };

  const handlePing = () => {
    onPing();
  };

  return (
    <div className="controls">
      <h3>Game Controls</h3>

      {/* Basic Controls */}
      <div className="basic-controls">
        <button onClick={handlePing} className="control-btn ping-btn">
          Ping Server
        </button>

        <button
          onClick={() => setShowChatForm(!showChatForm)}
          className="control-btn chat-btn">
          Send Chat
        </button>
      </div>

      {/* Game Controls (only when game started) */}
      {gameStarted && (
        <div className="game-controls">
          <h4>Game Actions</h4>

          <button
            onClick={() => setShowMoveForm(!showMoveForm)}
            className="control-btn move-btn">
            Move
          </button>

          <button
            onClick={() => setShowSuggestionForm(!showSuggestionForm)}
            className="control-btn suggestion-btn">
            Make Suggestion
          </button>

          <button
            onClick={() => setShowDisproveForm(!showDisproveForm)}
            className="control-btn disprove-btn">
            Respond to Suggestion
          </button>

          <button
            onClick={() => setShowAccusationForm(!showAccusationForm)}
            className="control-btn accusation-btn">
            Make Accusation
          </button>
        </div>
      )}

      {/* Move Form */}
      {showMoveForm && (
        <div className="control-form">
          <h4>Move Player</h4>
          <form onSubmit={handleMove}>
            <div className="form-group">
              <label>Move to:</label>
              <select name="moveTo" required>
                //todo: move options based on gamestate plater location
                {console.log(currentPlayer)}
                <option value="">Select destination</option>
                <option value="HALLWAY">Hallway</option>
                <option value="ROOM">Room</option>
              </select>
            </div>
            <div className="form-group">
              <label>Target ID (room name or hallway):</label>
              <input
                type="text"
                name="targetId"
                placeholder="e.g., Kitchen, Hallway-1"
              />
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" name="useSecretPassage" />
                Use Secret Passage
              </label>
            </div>
            <div className="form-actions">
              <button type="submit">Move</button>
              <button type="button" onClick={() => setShowMoveForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Suggestion Form */}
      {showSuggestionForm && (
        <div className="control-form">
          <h4>Make Suggestion</h4>
          <form onSubmit={handleSuggestion}>
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

      {/* Disprove Form */}
      {showDisproveForm && (
        <div className="control-form">
          <h4>Respond to Suggestion</h4>
          <form onSubmit={handleDisprove}>
            <div className="form-group">
              <label>Card to show (optional):</label>
              <input
                type="text"
                name="cardId"
                placeholder="Enter card ID or leave empty to pass"
              />
            </div>
            <div className="form-actions">
              <button type="submit">Respond</button>
              <button type="button" onClick={() => setShowDisproveForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accusation Form */}
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

      {/* Chat Form */}
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

      {/* Game Status */}
      {!gameStarted && (
        <div className="game-status">
          <p>
            Game not started yet. Wait for all players to join and select
            characters.
          </p>
        </div>
      )}
    </div>
  );
};

export default Controls;
