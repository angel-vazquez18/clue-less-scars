import React, { useState } from 'react';

const CHARACTERS = [
  'Miss Scarlet', 'Colonel Mustard', 'Mrs. White', 
  'Mr. Green', 'Mrs. Peacock', 'Professor Plum'
];

const GameLobby = ({ 
  players, 
  currentPlayer, 
  gameStarted, 
  leaderId,
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

  const isLeader = leaderId && currentPlayer && currentPlayer.id === leaderId;
  const leaderName = players.find(p => p.id === leaderId)?.name || null;
  const lobbyReady = players.length >= 4 && !gameStarted;
  const allCharactersSelected = players.length > 0 && players.every(p => !!p.characterId);
  const canStartGame = lobbyReady && allCharactersSelected && isLeader;
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
        <div className="info-item">
          <strong>Leader:</strong> {leaderName || 'TBD'}
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
              <div
                key={player.id || index}
                className={`player-item ${player.eliminated ? 'eliminated' : ''}`}
              >
                <div className="player-name">{player.name}</div>
                {player.isLeader && (
                  <span className="leader-badge">Leader</span>
                )}
                <div className="player-character">
                  {player.characterId || 'No character'}
                </div>
                {player.position && (
                  <div className="player-position">
                    {player.position.zone}: {player.position.id || 'Unknown'}
                  </div>
                )}
                <div className="player-status">
                  {player.eliminated ? 'Eliminated' : 'Active'}
                </div>
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
      {lobbyReady && isCurrentPlayer && (
        isLeader ? (
          <div className="start-game">
            <button 
              onClick={onStartGame}
              className="start-game-btn"
              disabled={!canStartGame}
              title={
                canStartGame
                  ? 'Start the game'
                  : 'All players must select characters before starting'
              }
            >
              Start Game
            </button>
            {!allCharactersSelected && (
              <p className="hint">Waiting for all players to select characters…</p>
            )}
          </div>
        ) : (
          <div className="waiting-leader">
            <p>Waiting for the lobby leader to start the game...</p>
            {!allCharactersSelected && (
              <p className="hint">All players must select characters first.</p>
            )}
          </div>
        )
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
