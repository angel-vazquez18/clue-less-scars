import React, { useMemo } from "react";
import ClueLessBoard, { sampleBoardConfig } from "./ClueLessBoard";

const GameBoard = ({ 
  gameState, 
  gameStarted,
  players = [],
}) => {
  const boardConfig = gameState?.board?.config || sampleBoardConfig;
  const positions = useMemo(
    () => ({ ...(boardConfig?.startingPositions || {}) }),
    [boardConfig?.startingPositions]
  );

  if (!gameState) {
    return (
      <div className="game-board">
        <div className="board-placeholder">
          <p>Waiting for game state…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-board">
      {!gameStarted && (
        <div className="board-overlay">
          <div className="lobby-message">
            <h4>Waiting for Game to Start</h4>
            {players.length < 4 ? (
              <>
                <p>Waiting for more players to join...</p>
                <p>Need at least 4 players to start (max 6)</p>
              </>
            ) : (
              <p>Players are selecting characters and preparing to start the game.</p>
            )}
          </div>
        </div>
      )}
      <div className="board-visual">
        <ClueLessBoard
          boardConfig={boardConfig}
          gameState={gameState}
          startingPositions={positions}
        />
      </div>
    </div>
  );
};

export default GameBoard;
