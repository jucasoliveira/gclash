import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function CharacterSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedMode, setSelectedMode] = useState('standard');
  const [showTournamentOptions, setShowTournamentOptions] = useState(false);
  const [tournamentName, setTournamentName] = useState('');
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [tournamentStatus, setTournamentStatus] = useState(null);

  const classes = [
    { id: 'clerk', name: 'Clerk', color: 'blue', health: 80, speed: 15, description: 'Magic user with speed and agility' },
    { id: 'warrior', name: 'Warrior', color: 'red', health: 120, speed: 8, description: 'Tank with heavy armor and strength' },
    { id: 'ranger', name: 'Ranger', color: 'green', health: 100, speed: 12, description: 'Balanced fighter with ranged attacks' },
  ];

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('guildClashUser');
    if (!userData) {
      navigate('/');
    }

    // Check if mode was passed from lobby
    if (location.state && location.state.mode) {
      handleModeSelect(location.state.mode);
    }
  }, [navigate, location]);

  useEffect(() => {
    // Show tournament options if tournament mode is selected
    setShowTournamentOptions(selectedMode === 'tournament');

    // If tournament mode is selected, fetch available tournaments
    if (selectedMode === 'tournament') {
      // This would be replaced with an actual API call
      setAvailableTournaments([
        { id: 't1', name: 'Tournament 1', players: 5, status: 'WAITING' },
        { id: 't2', name: 'Tournament 2', players: 12, status: 'WAITING' },
      ]);
    }
  }, [selectedMode]);

  const handleClassSelect = (classId) => {
    setSelectedClass(classId);
  };

  const handleModeSelect = (mode) => {
    // Reset tournament status when changing modes
    if (mode !== 'tournament') {
      setTournamentStatus(null);
    }
    
    setSelectedMode(mode);
  };

  const handleCreateTournament = () => {
    if (!tournamentName.trim()) {
      alert('Please enter a tournament name');
      return;
    }

    // This would be replaced with an actual API call
    setTournamentStatus({
      id: 'new-tournament',
      name: tournamentName,
      players: 1,
      status: 'WAITING',
      isCreator: true
    });
  };

  const handleJoinTournament = (tournamentId) => {
    // This would be replaced with an actual API call
    const tournament = availableTournaments.find(t => t.id === tournamentId);
    if (tournament) {
      setTournamentStatus({
        ...tournament,
        players: tournament.players + 1,
        isCreator: false
      });
    }
  };

  const handleStartGame = () => {
    if (!selectedClass) {
      alert('Please select a character class');
      return;
    }

    // Convert UI mode names to game engine mode names
    let gameMode = selectedMode;
    if (selectedMode === 'battle-royale') {
      gameMode = 'battleRoyale';
    }

    console.log(`Starting game with mode: ${gameMode}, class: ${selectedClass}`);

    // Navigate to game with selected class and mode
    navigate('/game', { 
      state: { 
        characterClass: selectedClass,
        gameMode: gameMode,
        tournament: tournamentStatus
      } 
    });
  };

  // Get mode description based on selected mode
  const getModeDescription = () => {
    switch(selectedMode) {
      case 'tournament':
        return 'Compete in a 16-player tournament bracket. Win your matches to advance to the finals.';
      case 'battle-royale':
        return 'Enter a massive 40-player battle royale. Be the last warrior standing to win.';
      default:
        return 'Standard 1v1 match against an opponent of similar skill level.';
    }
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ 
      backgroundColor: '#1a2e35',
      backgroundImage: 'url(https://images.unsplash.com/photo-1511512578047-dfb367046420?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)',
      backgroundBlendMode: 'overlay',
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <header style={{ 
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#e8d7b9',
        borderBottom: '2px solid rgba(139, 58, 58, 0.4)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Parchment texture overlay */}
        <div style={{ 
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-rYPTnW7311wD7QpxwJN46o1aBmZYlm.png)',
          opacity: 0.2,
          mixBlendMode: 'overlay',
          pointerEvents: 'none'
        }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b3a3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#8b3a3a' }}>GUILD CLASH</span>
        </div>
        
        <button 
          onClick={() => navigate('/lobby')}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#8b3a3a', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 'bold'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7"/>
            <path d="M19 12H5"/>
          </svg>
          Back to Lobby
        </button>
      </header>
      
      <main style={{ 
        flex: 1, 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '1rem',
        width: '100%'
      }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#e8d7b9', marginBottom: '0.5rem' }}>Choose Your Character</h1>
          <p style={{ color: 'rgba(232, 215, 185, 0.7)' }}>Select a class and game mode to begin</p>
        </div>

        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Game Mode Selection */}
          <div style={{ 
            backgroundColor: 'rgba(232, 215, 185, 0.9)',
            border: '2px solid rgba(139, 58, 58, 0.4)',
            borderRadius: '0.25rem',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Parchment texture overlay */}
            <div style={{ 
              position: 'absolute',
              inset: 0,
              backgroundImage: 'url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-rYPTnW7311wD7QpxwJN46o1aBmZYlm.png)',
              opacity: 0.2,
              mixBlendMode: 'overlay',
              pointerEvents: 'none'
            }}></div>
            
            <div style={{ 
              background: 'linear-gradient(to right, rgba(139, 58, 58, 0.2), transparent)',
              padding: '1.25rem 1.25rem 0.5rem',
              position: 'relative'
            }}>
              <div style={{ color: '#8b3a3a', fontSize: '1.25rem', fontWeight: 'bold' }}>
                Game Mode
              </div>
            </div>
            
            <div style={{ padding: '1rem', position: 'relative' }}>
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <button 
                  onClick={() => handleModeSelect('standard')}
                  style={{ 
                    padding: '0.75rem',
                    backgroundColor: selectedMode === 'standard' ? '#8b3a3a' : 'rgba(139, 58, 58, 0.1)',
                    color: selectedMode === 'standard' ? '#e8d7b9' : '#5a3e2a',
                    border: '1px solid rgba(139, 58, 58, 0.3)',
                    borderRadius: '0.25rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  Standard Match
                </button>
                <button 
                  onClick={() => handleModeSelect('tournament')}
                  style={{ 
                    padding: '0.75rem',
                    backgroundColor: selectedMode === 'tournament' ? '#8b3a3a' : 'rgba(139, 58, 58, 0.1)',
                    color: selectedMode === 'tournament' ? '#e8d7b9' : '#5a3e2a',
                    border: '1px solid rgba(139, 58, 58, 0.3)',
                    borderRadius: '0.25rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  Tournament
                </button>
                <button 
                  onClick={() => handleModeSelect('battle-royale')}
                  style={{ 
                    padding: '0.75rem',
                    backgroundColor: selectedMode === 'battle-royale' ? '#8b3a3a' : 'rgba(139, 58, 58, 0.1)',
                    color: selectedMode === 'battle-royale' ? '#e8d7b9' : '#5a3e2a',
                    border: '1px solid rgba(139, 58, 58, 0.3)',
                    borderRadius: '0.25rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  Battle Royale
                </button>
              </div>
              
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                padding: '0.75rem',
                borderRadius: '0.25rem',
                marginTop: '1rem',
                color: '#5a3e2a',
                border: '1px solid rgba(139, 58, 58, 0.1)'
              }}>
                {getModeDescription()}
              </div>
            </div>
          </div>
          
          {/* Character Class Selection */}
          <div style={{ 
            backgroundColor: 'rgba(232, 215, 185, 0.9)',
            border: '2px solid rgba(139, 58, 58, 0.4)',
            borderRadius: '0.25rem',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Parchment texture overlay */}
            <div style={{ 
              position: 'absolute',
              inset: 0,
              backgroundImage: 'url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-rYPTnW7311wD7QpxwJN46o1aBmZYlm.png)',
              opacity: 0.2,
              mixBlendMode: 'overlay',
              pointerEvents: 'none'
            }}></div>
            
            <div style={{ 
              background: 'linear-gradient(to right, rgba(139, 58, 58, 0.2), transparent)',
              padding: '1.25rem 1.25rem 0.5rem',
              position: 'relative'
            }}>
              <div style={{ color: '#8b3a3a', fontSize: '1.25rem', fontWeight: 'bold' }}>
                Character Class
              </div>
            </div>
            
            <div style={{ padding: '1rem', position: 'relative' }}>
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {classes.map(characterClass => (
                  <button 
                    key={characterClass.id}
                    onClick={() => handleClassSelect(characterClass.id)}
                    style={{ 
                      padding: '0.75rem',
                      backgroundColor: selectedClass === characterClass.id 
                        ? characterClass.color === 'blue' ? '#4a69bd' 
                        : characterClass.color === 'red' ? '#8b3a3a'
                        : '#2e7d32'
                        : 'rgba(139, 58, 58, 0.1)',
                      color: selectedClass === characterClass.id ? '#e8d7b9' : '#5a3e2a',
                      border: '1px solid rgba(139, 58, 58, 0.3)',
                      borderRadius: '0.25rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{characterClass.name}</span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      opacity: 0.8
                    }}>
                      <span>HP: {characterClass.health}</span>
                      <span>SPD: {characterClass.speed}</span>
                    </div>
                  </button>
                ))}
              </div>
              
              {selectedClass && (
                <div style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  padding: '0.75rem',
                  borderRadius: '0.25rem',
                  marginTop: '1rem',
                  color: '#5a3e2a',
                  border: '1px solid rgba(139, 58, 58, 0.1)'
                }}>
                  {classes.find(c => c.id === selectedClass)?.description}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Tournament Options */}
        {showTournamentOptions && (
          <div style={{ 
            backgroundColor: 'rgba(232, 215, 185, 0.9)',
            border: '2px solid rgba(139, 58, 58, 0.4)',
            borderRadius: '0.25rem',
            overflow: 'hidden',
            position: 'relative',
            marginBottom: '2rem'
          }}>
            {/* Parchment texture overlay */}
            <div style={{ 
              position: 'absolute',
              inset: 0,
              backgroundImage: 'url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-rYPTnW7311wD7QpxwJN46o1aBmZYlm.png)',
              opacity: 0.2,
              mixBlendMode: 'overlay',
              pointerEvents: 'none'
            }}></div>
            
            <div style={{ 
              background: 'linear-gradient(to right, rgba(139, 58, 58, 0.2), transparent)',
              padding: '1.25rem 1.25rem 0.5rem',
              position: 'relative'
            }}>
              <div style={{ color: '#8b3a3a', fontSize: '1.25rem', fontWeight: 'bold' }}>
                Tournament Options
              </div>
              <div style={{ color: '#5a3e2a', fontSize: '0.875rem' }}>
                Create or join a tournament with up to 16 players
              </div>
            </div>
            
            <div style={{ padding: '1rem', position: 'relative' }}>
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem'
              }}>
                <div>
                  <h4 style={{ color: '#5a3e2a', marginBottom: '0.5rem' }}>Create New Tournament</h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      value={tournamentName}
                      onChange={(e) => setTournamentName(e.target.value)}
                      placeholder="Tournament Name"
                      style={{ 
                        flex: 1,
                        padding: '0.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.5)',
                        border: '1px solid rgba(139, 58, 58, 0.3)',
                        borderRadius: '0.25rem',
                        color: '#5a3e2a'
                      }}
                    />
                    <button 
                      onClick={handleCreateTournament}
                      style={{ 
                        padding: '0.5rem 1rem',
                        backgroundColor: '#8b3a3a',
                        border: 'none',
                        borderRadius: '0.25rem',
                        color: '#e8d7b9',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Create
                    </button>
                  </div>
                </div>
                
                <div>
                  <h4 style={{ color: '#5a3e2a', marginBottom: '0.5rem' }}>Available Tournaments</h4>
                  <div style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    border: '1px solid rgba(139, 58, 58, 0.3)',
                    borderRadius: '0.25rem',
                    padding: '0.5rem',
                    maxHeight: '150px',
                    overflowY: 'auto'
                  }}>
                    {availableTournaments.length > 0 ? (
                      availableTournaments.map(tournament => (
                        <div key={tournament.id} style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem',
                          borderBottom: '1px solid rgba(139, 58, 58, 0.1)'
                        }}>
                          <div>
                            <div style={{ color: '#5a3e2a', fontWeight: 'bold' }}>{tournament.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#8b3a3a' }}>
                              Players: {tournament.players}/16
                            </div>
                          </div>
                          <button 
                            onClick={() => handleJoinTournament(tournament.id)}
                            style={{ 
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#8b3a3a',
                              border: 'none',
                              borderRadius: '0.25rem',
                              color: '#e8d7b9',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            Join
                          </button>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '0.5rem', color: '#8b3a3a', fontStyle: 'italic' }}>
                        No tournaments available
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {tournamentStatus && (
                <div style={{ 
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  borderRadius: '0.25rem',
                  border: '1px solid rgba(139, 58, 58, 0.3)'
                }}>
                  <h4 style={{ color: '#8b3a3a', marginBottom: '0.5rem' }}>Tournament Status</h4>
                  <div style={{ color: '#5a3e2a' }}>Name: <strong>{tournamentStatus.name}</strong></div>
                  <div style={{ color: '#5a3e2a' }}>Players: <strong>{tournamentStatus.players}/16</strong></div>
                  <div style={{ color: '#5a3e2a' }}>Status: <strong>{tournamentStatus.status}</strong></div>
                  {tournamentStatus.isCreator && (
                    <div style={{ marginTop: '0.5rem', color: '#8b3a3a', fontStyle: 'italic' }}>
                      You are the tournament creator. Select your class and press Start Game when ready.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Start Game Button */}
        <div style={{ textAlign: 'center' }}>
          <button 
            onClick={handleStartGame}
            disabled={!selectedClass}
            style={{ 
              padding: '0.75rem 2.5rem',
              backgroundColor: selectedClass ? '#8b3a3a' : 'rgba(139, 58, 58, 0.5)',
              color: '#e8d7b9',
              border: '2px solid rgba(139, 58, 58, 0.3)',
              borderRadius: '0.25rem',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              cursor: selectedClass ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            Start Game
          </button>
        </div>
      </main>
      
      <footer style={{ 
        padding: '1rem', 
        textAlign: 'center', 
        fontSize: '0.75rem', 
        color: 'rgba(232, 215, 185, 0.6)', 
        backgroundColor: 'rgba(26, 46, 53, 0.8)', 
        borderTop: '1px solid rgba(139, 58, 58, 0.2)' 
      }}>
        <p>Guild Clash &copy; {new Date().getFullYear()} | All rights reserved</p>
      </footer>
    </div>
  );
}

export default CharacterSelection; 