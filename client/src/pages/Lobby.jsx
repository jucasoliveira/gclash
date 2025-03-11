import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Lobby() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [playerCount, setPlayerCount] = useState({
    tournament: 12,
    battleRoyale: 27,
  });

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('guildClashUser');
    if (!userData) {
      navigate('/');
    } else {
      try {
        const user = JSON.parse(userData);
        setUsername(user.username || 'Player');
        
        // Get active character
        if (user.activeCharacter) {
          setActiveCharacter(user.activeCharacter);
        } else {
          // If no active character, redirect to character selection
          navigate('/character-selection');
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    // Simulate updating player counts
    const interval = setInterval(() => {
      setPlayerCount(prev => ({
        tournament: Math.min(16, Math.max(1, prev.tournament + Math.floor(Math.random() * 3) - 1)),
        battleRoyale: Math.min(40, Math.max(5, prev.battleRoyale + Math.floor(Math.random() * 5) - 2)),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('guildClashUser');
    navigate('/');
  };

  const handleChangeCharacter = () => {
    navigate('/character-selection');
  };

  const handleSelectGameMode = (mode) => {
    navigate('/game', { 
      state: { 
        characterClass: activeCharacter.characterClass,
        gameMode: mode === 'battle-royale' ? 'battleRoyale' : mode
      } 
    });
  };

  // Get class color
  const getClassColor = () => {
    switch (activeCharacter?.characterClass) {
      case 'CLERK':
        return 'blue';
      case 'WARRIOR':
        return 'red';
      case 'RANGER':
        return 'green';
      default:
        return '#8b3a3a';
    }
  };

  // Get class name
  const getClassName = () => {
    switch (activeCharacter?.characterClass) {
      case 'CLERK':
        return 'Clerk';
      case 'WARRIOR':
        return 'Warrior';
      case 'RANGER':
        return 'Ranger';
      default:
        return 'Unknown';
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
          {activeCharacter && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              border: `1px solid ${getClassColor()}`,
              cursor: 'pointer'
            }}
            onClick={handleChangeCharacter}
            >
              <div style={{ 
                height: '1.75rem', 
                width: '1.75rem', 
                borderRadius: '50%', 
                backgroundColor: getClassColor(),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.75rem'
              }}>
                {getClassName().substring(0, 1)}
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#5a3e2a' }}>
                  {activeCharacter.name}
                </div>
                <div style={{ fontSize: '0.625rem', color: getClassColor(), fontWeight: 'bold' }}>
                  Lvl {activeCharacter.level} {getClassName()}
                </div>
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              height: '2rem', 
              width: '2rem', 
              borderRadius: '50%', 
              border: '1px solid rgba(139, 58, 58, 0.5)',
              backgroundColor: 'rgba(139, 58, 58, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8b3a3a',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              overflow: 'hidden'
            }}>
              {username.substring(0, 2).toUpperCase()}
            </div>
            <span style={{ color: '#5a3e2a' }}>{username}</span>
          </div>
          
          <button 
            onClick={handleLogout}
            style={{ 
              backgroundColor: 'transparent',
              border: 'none',
              color: '#8b3a3a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.875rem'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <main style={{ 
        flex: 1, 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem',
        width: '100%' 
      }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#e8d7b9', marginBottom: '0.5rem' }}>Game Lobby</h1>
          <p style={{ color: 'rgba(232, 215, 185, 0.7)' }}>Select a game mode to begin your adventure</p>
        </div>

        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem'
        }}>
          {/* Tournament Card */}
          <div style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '0.5rem',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(139, 58, 58, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
            height: '300px',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={() => handleSelectGameMode('tournament')}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          >
            <div style={{ 
              backgroundImage: 'url(https://images.unsplash.com/photo-1519947486511-46149fa0a254?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              height: '60%',
              position: 'relative'
            }}>
              <div style={{ 
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.8))'
              }}></div>
              
              <div style={{ 
                position: 'absolute',
                bottom: '1rem',
                left: '1rem',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1.5rem',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
              }}>
                Tournament
              </div>
            </div>
            
            <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: '#e8d7b9', marginBottom: '0.5rem' }}>
                Compete in a 16-player tournament bracket. Win your matches to advance to the finals.
              </div>
              
              <div style={{ 
                marginTop: 'auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ 
                  backgroundColor: 'rgba(139, 58, 58, 0.2)',
                  color: '#e8d7b9',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  {playerCount.tournament}/16 Players
                </div>
                
                <div style={{ 
                  color: '#8b3a3a',
                  fontSize: '0.875rem',
                  fontWeight: 'bold'
                }}>
                  PLAY NOW
                </div>
              </div>
            </div>
          </div>
          
          {/* Battle Royale Card */}
          <div style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '0.5rem',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(139, 58, 58, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
            height: '300px',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={() => handleSelectGameMode('battle-royale')}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          >
            <div style={{ 
              backgroundImage: 'url(https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              height: '60%',
              position: 'relative'
            }}>
              <div style={{ 
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.8))'
              }}></div>
              
              <div style={{ 
                position: 'absolute',
                bottom: '1rem',
                left: '1rem',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1.5rem',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
              }}>
                Battle Royale
              </div>
            </div>
            
            <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: '#e8d7b9', marginBottom: '0.5rem' }}>
                Enter a massive 40-player battle royale. Be the last warrior standing to win.
              </div>
              
              <div style={{ 
                marginTop: 'auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ 
                  backgroundColor: 'rgba(139, 58, 58, 0.2)',
                  color: '#e8d7b9',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  {playerCount.battleRoyale}/40 Players
                </div>
                
                <div style={{ 
                  color: '#8b3a3a',
                  fontSize: '0.875rem',
                  fontWeight: 'bold'
                }}>
                  PLAY NOW
                </div>
              </div>
            </div>
          </div>
          
          {/* Standard Match Card */}
          <div style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '0.5rem',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(139, 58, 58, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
            height: '300px',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={() => handleSelectGameMode('standard')}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          >
            <div style={{ 
              backgroundImage: 'url(https://images.unsplash.com/photo-1531259683007-016a7b628fc3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              height: '60%',
              position: 'relative'
            }}>
              <div style={{ 
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.8))'
              }}></div>
              
              <div style={{ 
                position: 'absolute',
                bottom: '1rem',
                left: '1rem',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1.5rem',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
              }}>
                Standard Match
              </div>
            </div>
            
            <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: '#e8d7b9', marginBottom: '0.5rem' }}>
                Standard 1v1 match against an opponent of similar skill level. Perfect for practice.
              </div>
              
              <div style={{ 
                marginTop: 'auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ 
                  backgroundColor: 'rgba(139, 58, 58, 0.2)',
                  color: '#e8d7b9',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Always Available
                </div>
                
                <div style={{ 
                  color: '#8b3a3a',
                  fontSize: '0.875rem',
                  fontWeight: 'bold'
                }}>
                  PLAY NOW
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer style={{ 
        padding: '1rem', 
        textAlign: 'center', 
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: '0.75rem'
      }}>
        &copy; 2025 Guild Clash. All rights reserved.
      </footer>
    </div>
  );
}

export default Lobby; 