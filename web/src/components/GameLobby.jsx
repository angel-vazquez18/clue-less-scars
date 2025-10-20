import React, { useState } from 'react';

const CHARACTERS = [
  'Miss Scarlet', 'Colonel Mustard', 'Mrs. White', 
  'Mr. Green', 'Mrs. Peacock', 'Professor Plum'
];

const GameLobby = ({ 
  players, 
  currentPlayer, 
  gameStarted, 
  onSelectCharacter, 
  onStartGame 
}) => {
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);

  const handleCharacterSelect = (characterId) => {
    // Don't allow selecting the same character you already have
    if (currentPlayer.characterId === characterId) {
      console.log('Already selected this character');
      return;
    }
    setSelectedCharacter(characterId);
    onSelectCharacter(characterId);
    setShowCharacterSelect(false);
  };

  const canStartGame = players.length >= 4 && !gameStarted;
  const isCurrentPlayer = currentPlayer && currentPlayer.id;

  // Debug logging
  console.log('GameLobby - currentPlayer:', currentPlayer);
  console.log('GameLobby - gameStarted:', gameStarted);
  console.log('GameLobby - Character selection always visible in lobby:', !gameStarted && currentPlayer);

  return (
    <div className="game-lobby">
      <h3>Game Lobby</h3>
      
      {/* Game Info */}
      <div className="game-info">
        <div className="info-item">
          <strong>Players:</strong> {players.length}
        </div>
        <div className="info-item">
          <strong>Status:</strong> {gameStarted ? 'In Progress' : 'Waiting'}
        </div>
        {currentPlayer && (
          <div className="info-item">
            <strong>You:</strong> {currentPlayer.name}
          </div>
        )}
      </div>

      {/* Players List */}
      <div className="players-list">
        <h4>Players ({players.length})</h4>
        {players.length === 0 ? (
          <p className="no-players">No players yet</p>
        ) : (
          <div className="players">
            {players.map((player, index) => (
              <div key={player.id || index} className="player-item">
                <div className="player-name">{player.name}</div>
                <div className="player-character">
                  {player.characterId || 'No character'}
                </div>
                {player.position && (
                  <div className="player-position">
                    {player.position.zone}: {player.position.id || 'Unknown'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Character Selection */}
      {!gameStarted && currentPlayer && (
        <div className="character-selection">
          <h4>
            {currentPlayer.characterId 
              ? `Your Character: ${currentPlayer.characterId}` 
              : 'Select Character'}
          </h4>
          {!showCharacterSelect ? (
            <button 
              onClick={() => setShowCharacterSelect(true)}
              className="select-character-btn"
            >
              {currentPlayer.characterId ? 'Change Character' : 'Choose Character'}
            </button>
          ) : (
            <div className="character-options">
              {CHARACTERS.map(character => {
                // Find who has this character
                const takenByPlayer = players.find(p => p.characterId === character);
                const isTakenByOther = takenByPlayer && takenByPlayer.id !== currentPlayer.id;
                const isCurrentlySelected = currentPlayer.characterId === character;
                
                return (
                  <button
                    key={character}
                    onClick={() => handleCharacterSelect(character)}
                    disabled={isTakenByOther || isCurrentlySelected}
                    className={`character-option ${isTakenByOther ? 'taken' : ''} ${isCurrentlySelected ? 'selected' : ''}`}
                  >
                    <div className="character-name">{character}</div>
                    {isTakenByOther && (
                      <span className="taken-indicator">Taken by {takenByPlayer.name}</span>
                    )}
                    {isCurrentlySelected && (
                      <span className="selected-indicator">✓ Your Current Choice</span>
                    )}
                  </button>
                );
              })}
              <button 
                onClick={() => setShowCharacterSelect(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Start Game Button */}
      {canStartGame && isCurrentPlayer && (
        <div className="start-game">
          <button 
            onClick={onStartGame}
            className="start-game-btn"
          >
            Start Game
          </button>
        </div>
      )}

      {/* Game Status */}
      {gameStarted && (
        <div className="game-status">
          <h4>Game in Progress</h4>
          <p>All players have characters and the game has started!</p>
        </div>
      )}

      {/* Waiting for Players */}
      {!gameStarted && players.length < 4 && (
        <div className="waiting-players">
          <p>Waiting for more players to join...</p>
          <p>Need at least 4 players to start (max 6)</p>
        </div>
      )}

      {/* Game Full */}
      {players.length >= 6 && (
        <div className="game-full">
          <p>Game is full (6/6 players)</p>
          <p>Maximum players reached</p>
        </div>
      )}
    </div>
  );
};

export default GameLobby;
