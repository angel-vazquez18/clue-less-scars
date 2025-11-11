import React, { useMemo } from "react";
import BoardGrid from "./BoardGrid";

const startingPlaces = {
  "Miss Scarlet": "H2",
  "Professor Plum": "V1",
  "Colonel Mustard": "V3",
  "Mrs. Peacock": "V4",
  "Mr. Green": "H5",
  "Mrs. White": "H6",
};

const GameBoard = ({ gameState, gameStarted }) => {
  const positions = useMemo(() => startingPlaces, []);

  if (!gameState) {
    return (
      <div className="game-board">
        <h3>Game Board</h3>
        <div className="board-placeholder">
          <p>Waiting for game state…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-board">
      <h3>Game Board</h3>
      {!gameStarted && (
        <div className="board-overlay">
          <div className="lobby-message">
            <h4>Waiting for Game to Start</h4>
            <p>Players are selecting characters and preparing to start the game.</p>
          </div>
        </div>
      )}
      <div className="board-visual">
        <BoardGrid gameState={gameState} startingPositions={positions} />
      </div>
    </div>
  );
};

export default GameBoard;
