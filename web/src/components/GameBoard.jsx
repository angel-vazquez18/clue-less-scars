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
  "Miss Scarlet": "H2",
  "Professor Plum": "V1",
  "Colonel Mustard": "V3",
  "Mrs. Peacock": "V4",
  "Mr. Green": "H5",
  "Mrs. White": "H6",
};

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
            {currentPlayer["position"]?.length < 3
              ? "Hallway"
              : currentPlayer.position}
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
