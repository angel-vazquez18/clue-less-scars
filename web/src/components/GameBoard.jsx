import React, { useState } from "react";
import BoardGrid from "./BoardGrid";

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

const startingPlaces = {
  scarlet: "H2",
  plum: "V1",
  mustard: "V3",
  peacock: "V4",
  green: "H5",
  white: "H6",
};

const GameBoard = ({ gameState, currentPlayer, gameStarted }) => {
  if (!gameState) {
    return (
      <div className="game-board">
        <h3>Game Board</h3>
        <div className="board-placeholder">
          <p>Waiting for game state...</p>
        </div>
      </div>
    );
  }

  const [positions, setPositions] = useState(startingPlaces);

  const movePiece = (playerId, newPosition) => {
    setPosition((prevPosition) => ({
      ...prevPosition,
      [playerId]: newPosition,
    }));
  };

  const renderPlayerPositions = () => {
    if (!gameState.players || gameState.players.length === 0) {
      return <p>No players on board</p>;
    }

    return (
      <div className="player-positions">
        <h4>Player Positions</h4>
        {gameState.players.map((player, index) => (
          <div key={player.id || index} className="player-position">
            <strong>{player.name}:</strong>{" "}
            {player.characterId || "No character"}
            {player.position && (
              <span className="position-detail">
                {" "}
                at {player.position.zone} {player.position.id || ""}
                {player.position.secret && " (Secret Passage)"}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderGameInfo = () => {
    // Find current player name
    const currentTurnPlayerId = gameState.turn?.currentPlayerId;
    const currentTurnPlayer = gameState.players?.find(
      (p) => p.id === currentTurnPlayerId
    );
    const currentTurnName = currentTurnPlayer
      ? currentTurnPlayer.name
      : currentTurnPlayerId || "None";

    return (
      <div className="game-info">
        <h4>Game Information</h4>
        <div className="info-grid">
          <div className="info-item">
            <strong>Phase:</strong> {gameState.turn?.phase || "Lobby"}
          </div>
          <div className="info-item">
            <strong>Current Turn:</strong> {currentTurnName}
          </div>
          <div className="info-item">
            <strong>Turn Order:</strong> {gameState.turn?.order?.length || 0}{" "}
            players
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentPlayerInfo = () => {
    if (!currentPlayer) return null;

    return (
      <div className="current-player-info">
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
            <strong>Position:</strong>{" "}
            {currentPlayer.position
              ? `${currentPlayer.position.zone} ${
                  currentPlayer.position.id || ""
                }`
              : "Not on board"}
          </div>
        </div>
      </div>
    );
  };

  const changeRefItemColor = (e) => {
    const refItem = e.target;
    if (refItem.style.backgroundColor === "rgb(224, 224, 224)") {
      refItem.style.backgroundColor = "rgb(148, 21, 21)";
      refItem.style.color = "rgb(224, 224, 224)";
    } else if (refItem.style.backgroundColor === "rgb(148, 21, 21)") {
      refItem.style.backgroundColor = "rgb(41, 159, 41)";
    } else {
      refItem.style.backgroundColor = "rgb(224, 224, 224)";
      refItem.style.color = "rgb(85, 85, 85)";
    }
  };

  return (
    <div className="game-board">
      <h3>Game Board</h3>

      {!gameStarted ? (
        <div className="lobby-view">
          <div className="lobby-message">
            <h4>Waiting for Game to Start</h4>
            <p>
              Players are selecting characters and preparing to start the game.
            </p>
            <p>
              Once the game starts, you'll see the board and player positions
              here.
            </p>
          </div>
          {renderCurrentPlayerInfo()}
        </div>
      ) : (
        <div className="game-view">
          {renderGameInfo()}
          {renderCurrentPlayerInfo()}
          <div
            className="grid-container"
            style={{ position: "relative", width: "fit-content" }}>
            <BoardGrid gameState={gameState} startingPositions={positions} />
          </div>
          {renderPlayerPositions()}
        </div>
      )}

      {/* Game Reference */}
      <div className="game-reference">
        <h4>Game Reference</h4>
        <div className="reference-sections">
          <div className="reference-section">
            <h5>Suspects</h5>
            <div className="reference-list">
              {SUSPECTS.map((suspect) => (
                <span
                  key={suspect}
                  className="reference-item"
                  onClick={changeRefItemColor}
                  style={{ backgroundColor: "rgb(224, 224, 224)" }}>
                  {suspect}
                </span>
              ))}
            </div>
          </div>
          <div className="reference-section">
            <h5>Weapons</h5>
            <div className="reference-list">
              {WEAPONS.map((weapon) => (
                <span
                  key={weapon}
                  className="reference-item"
                  onClick={changeRefItemColor}
                  style={{ backgroundColor: "rgb(224, 224, 224)" }}>
                  {weapon}
                </span>
              ))}
            </div>
          </div>
          <div className="reference-section">
            <h5>Rooms</h5>
            <div className="reference-list">
              {ROOMS.map((room) => (
                <span
                  key={room}
                  className="reference-item"
                  onClick={changeRefItemColor}
                  style={{ backgroundColor: "rgb(224, 224, 224)" }}>
                  {room}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
