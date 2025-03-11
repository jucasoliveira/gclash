import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Lobby() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
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
              background: 'transparent', 
              border: 'none', 
              color: '#8b3a3a', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0 }}>Logout</span>
          </button>
        </div>
      </header>
      
      <main style={{ 
        flex: 1, 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '1rem',
        width: '100%'
      }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#e8d7b9', marginBottom: '0.5rem' }}>Welcome to the Arena</h1>
          <p style={{ color: 'rgba(232, 215, 185, 0.7)' }}>Choose your battle, warrior</p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {/* Tournament Card */}
          <div style={{ 
            backgroundColor: 'rgba(232, 215, 185, 0.9)',
            border: '2px solid rgba(139, 58, 58, 0.4)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            borderRadius: '0.125rem',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b3a3a', fontSize: '1.25rem', fontWeight: 'bold' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
                Tournament
              </div>
              <div style={{ color: '#5a3e2a', fontSize: '0.875rem' }}>16-player bracket tournament</div>
            </div>
            
            <div style={{ padding: '1.5rem 1.25rem 1.25rem', position: 'relative' }}>
              <div style={{ 
                position: 'relative',
                aspectRatio: '16/9',
                borderRadius: '0.125rem',
                overflow: 'hidden',
                marginBottom: '1rem',
                border: '1px solid rgba(139, 58, 58, 0.3)'
              }}>
                <div style={{ 
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: 'url(https://images.unsplash.com/photo-1612404730960-5c71577fca11?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}></div>
                <div style={{ 
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
                  padding: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e8d7b9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span style={{ fontSize: '0.875rem' }}>{playerCount.tournament}/16 players waiting</span>
                  </div>
                </div>
              </div>
              <p style={{ color: '#5a3e2a', fontSize: '0.875rem' }}>
                Face off in a 16-player tournament bracket. Win your matches to advance to the finals and claim glory!
              </p>
            </div>
            
            <div style={{ padding: '0 1.25rem 1.25rem', position: 'relative' }}>
              <button 
                onClick={() => navigate('/character-selection', { state: { mode: 'tournament' } })}
                style={{ 
                  width: '100%',
                  backgroundColor: '#8b3a3a',
                  color: '#e8d7b9',
                  border: '1px solid rgba(139, 58, 58, 0.5)',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '0.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#6e2e2e'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8b3a3a'}
              >
                Join Tournament
              </button>
            </div>
          </div>

          {/* Battle Royale Card */}
          <div style={{ 
            backgroundColor: 'rgba(232, 215, 185, 0.9)',
            border: '2px solid rgba(139, 58, 58, 0.4)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            borderRadius: '0.125rem',
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
              background: 'linear-gradient(to right, rgba(26, 46, 53, 0.3), transparent)',
              padding: '1.25rem 1.25rem 0.5rem',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1a2e35', fontSize: '1.25rem', fontWeight: 'bold' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m14.5 12.5-5-5 5 5z" />
                  <path d="m18.5 16.5-5-5 5 5z" />
                  <path d="m6.5 19.5 7-7-7 7z" />
                  <path d="m16 7-4.5 4.5" />
                  <path d="M21 11.5c-.5 1-1.5 2-2.5 2.75L16 16" />
                  <path d="M3 19.5 16 7 3 19.5z" />
                </svg>
                Battle Royale
              </div>
              <div style={{ color: '#5a3e2a', fontSize: '0.875rem' }}>40-player free-for-all battle</div>
            </div>
            
            <div style={{ padding: '1.5rem 1.25rem 1.25rem', position: 'relative' }}>
              <div style={{ 
                position: 'relative',
                aspectRatio: '16/9',
                borderRadius: '0.125rem',
                overflow: 'hidden',
                marginBottom: '1rem',
                border: '1px solid rgba(139, 58, 58, 0.3)'
              }}>
                <div style={{ 
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: 'url(https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}></div>
                <div style={{ 
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
                  padding: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e8d7b9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span style={{ fontSize: '0.875rem' }}>{playerCount.battleRoyale}/40 players waiting</span>
                  </div>
                </div>
              </div>
              <p style={{ color: '#5a3e2a', fontSize: '0.875rem' }}>
                Enter a massive 40-player battle royale on a sprawling map. Be the last warrior standing to earn your place on the leaderboard!
              </p>
            </div>
            
            <div style={{ padding: '0 1.25rem 1.25rem', position: 'relative' }}>
              <button 
                onClick={() => navigate('/character-selection', { state: { mode: 'battle-royale' } })}
                style={{ 
                  width: '100%',
                  backgroundColor: '#1a2e35',
                  color: '#e8d7b9',
                  border: '1px solid rgba(26, 46, 53, 0.5)',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '0.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#142228'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1a2e35'}
              >
                Join Battle Royale
              </button>
            </div>
          </div>
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

export default Lobby; 