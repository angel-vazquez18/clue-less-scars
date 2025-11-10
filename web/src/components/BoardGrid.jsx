import React from "react";

//grid layout for the clue game board. Rooms have full names, hallways are named based on direction and number: horizontal or vertical
export const board = [
  ["Study", "H1", "Hall", "H2", "Lounge"],
  ["V1", " ", "V2", " ", "V3"],
  ["Library", "H3", "Billiard Room", "H4", "Dining Room"],
  ["V4", " ", "V5", " ", "V6"],
  ["Conservatory", "H5", "Ballroom", "H6", "Kitchen"],
];

//to determine className for CSS
const getClassName = (cell) => {
  if (cell === " ") {
    return "empty-grid";
  }
  if (cell.length < 3 && cell[0] === "H") {
    return "hall-cell";
  }
  if (cell.length < 3 && cell[0] === "V") {
    return "vertical-hall";
  } else {
    return "room-cell";
  }
};

const convertNameForCss = (charName) => {
  return charName.replace(/^[^ ]* /, "").toLowerCase();
};

const cellPositions = {};
board.forEach((row, r) => {
  row.forEach((cell, c) => {
    if (cell.trim()) cellPositions[cell] = { row: r, col: c };
  });
});

const BoardGrid = ({ startingPositions, gameState }) => {
  return (
    <div>
      <strong>Clue Game Board</strong>

      <div className="grid-container">
        <div className="board-grid">
          {board.map((row, rowIndex) =>
            row.map((cell, cellIndex) => (
              <div
                key={`${rowIndex}-${cellIndex}`}
                className={getClassName(cell)}>
                {cell}
              </div>
            ))
          )}
        </div>

        <div className="game-pieces-grid">
          {gameState.players.map((player) => {
            const value = startingPositions[player.characterId];
            const pos = cellPositions[value];
            if (!pos) return null;
            const piece = convertNameForCss(player.characterId);
            console.log("player: ", player, "game state: ", gameState);
            return (
              <div
                key={player.characterId}
                className={`player-piece ${piece}`}
                style={{
                  gridRow: pos.row + 1,
                  gridColumn: pos.col + 1,
                }}>
                {player.characterId[0]}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BoardGrid;
