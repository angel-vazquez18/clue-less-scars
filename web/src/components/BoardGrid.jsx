import React from "react";

//grid layout for the clue game board. Rooms have full names, hallways are named based on direction and number: horizontal or vertical
export const board = [
  ["Study", "H1", "Hall", "H2", "Lounge"],
  ["V1", " ", "V2", " ", "V3"],
  ["Library", "H3", "Billiard Room", "H4", "Dining Room"],
  ["V4", " ", "V5", " ", "V6"],
  ["Conservatory", "H5", "Ballroom", "H6", "Kitchen"],
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

const cellPositions = {};
board.forEach((row, r) => {
  row.forEach((cell, c) => {
    if (cell.trim()) cellPositions[cell] = { row: r, col: c };
  });
});

const BoardGrid = ({ startingPositions }) => {
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
          {Object.entries(startingPositions).map(([id, start]) => {
            const pos = cellPositions[start];
            if (!pos) return null;
            console.log(
              "rendering player: ",
              id,
              pos,
              "From playerGamePieces: ",
              `Player ${id} is in ${start}`,
              "cellPositions from playergamepieces: ",
              cellPositions,
              pos.row + 1,
              pos.col + 1
            );
            return (
              <div
                key={id}
                className={`player-piece ${id}`}
                style={{
                  gridRow: pos.row + 1,
                  gridColumn: pos.col + 1,
                }}>
                {id[0]}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BoardGrid;
