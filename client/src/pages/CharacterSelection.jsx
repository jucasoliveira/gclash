import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function CharacterSelection() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [activeCharacterId, setActiveCharacterId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharClass, setNewCharClass] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerId, setPlayerId] = useState('');

  const classes = [
    { id: 'CLERK', name: 'Clerk', color: 'blue', health: 80, speed: 15, description: 'Magic user with speed and agility' },
    { id: 'WARRIOR', name: 'Warrior', color: 'red', health: 120, speed: 8, description: 'Tank with heavy armor and strength' },
    { id: 'RANGER', name: 'Ranger', color: 'green', health: 100, speed: 12, description: 'Balanced fighter with ranged attacks' },
  ];

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('guildClashUser');
    if (!userData) {
      navigate('/');
      return;
    }

    try {
      const user = JSON.parse(userData);
      setPlayerId(user.id);
      
      // Fetch characters for this player
      fetchCharacters(user.id);
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('guildClashUser');
      navigate('/');
    }
  }, [navigate]);

  const fetchCharacters = async (id) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:3000/api/characters?playerId=${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch characters');
      }

      setCharacters(data.characters || []);
      setActiveCharacterId(data.activeCharacterId);
    } catch (error) {
      console.error('Error fetching characters:', error);
      setError('Failed to load characters. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCharacter = async (e) => {
    e.preventDefault();
    setError('');

    if (!newCharName.trim()) {
      setError('Character name is required');
      return;
    }

    if (!newCharClass) {
      setError('Please select a character class');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerId,
          name: newCharName,
          characterClass: newCharClass
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create character');
      }

      // Add the new character to the list
      setCharacters(prevChars => [...prevChars, data.character]);
      
      // If this is the first character, set it as active
      if (data.activeCharacterId) {
        setActiveCharacterId(data.activeCharacterId);
      }

      // Reset form and hide it
      setNewCharName('');
      setNewCharClass('');
      setShowCreateForm(false);

      // Refresh characters
      fetchCharacters(playerId);
    } catch (error) {
      console.error('Error creating character:', error);
      setError(error.message || 'Failed to create character. Please try again.');
    }
  };

  const handleSelectCharacter = async (characterId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/characters/${characterId}/activate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to select character');
      }

      setActiveCharacterId(data.activeCharacterId);
    } catch (error) {
      console.error('Error selecting character:', error);
      setError(error.message || 'Failed to select character. Please try again.');
    }
  };

  const handleContinueToLobby = () => {
    if (!activeCharacterId) {
      setError('Please select a character first');
      return;
    }

    // Find the active character to get its details
    const activeCharacter = characters.find(char => char._id === activeCharacterId);
    
    if (!activeCharacter) {
      setError('Selected character not found');
      return;
    }

    // Store active character info in localStorage
    const userData = JSON.parse(localStorage.getItem('guildClashUser'));
    userData.activeCharacter = activeCharacter;
    localStorage.setItem('guildClashUser', JSON.stringify(userData));

    // Set global variables for compatibility
    window.playerCharacterClass = activeCharacter.characterClass;
    window.playerCharacterName = activeCharacter.name;
    window.playerCharacterLevel = activeCharacter.level;

    // Navigate to lobby
    navigate('/lobby');
  };

  const getClassDetails = (classId) => {
    return classes.find(c => c.id === classId) || {};
  };

  const renderCharacterList = () => {
    if (characters.length === 0) {
      return (
        <div className="empty-state">
          <p>You don't have any characters yet.</p>
          <button 
            className="primary-button"
            onClick={() => setShowCreateForm(true)}
          >
            Create Your First Character
          </button>
        </div>
      );
    }

    return (
      <div className="character-list">
        {characters.map(character => {
          const classDetails = getClassDetails(character.characterClass);
          const isActive = character._id === activeCharacterId;
          
          return (
            <div 
              key={character._id} 
              className={`character-card ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectCharacter(character._id)}
              style={{
                borderColor: isActive ? classDetails.color : 'transparent',
                backgroundColor: isActive ? `${classDetails.color}22` : 'rgba(0, 0, 0, 0.2)',
                padding: '1rem',
                borderRadius: '0.5rem',
                margin: '0.5rem 0',
                cursor: 'pointer',
                borderWidth: '2px',
                borderStyle: 'solid',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ color: classDetails.color, margin: '0 0 0.5rem 0' }}>
                    {character.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                    <span>Level {character.level}</span>
                    <span style={{ color: classDetails.color }}>{classDetails.name}</span>
                  </div>
                </div>
                <div style={{ 
                  height: '3rem', 
                  width: '3rem', 
                  borderRadius: '50%', 
                  backgroundColor: classDetails.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  {classDetails.name.substring(0, 1)}
                </div>
              </div>
              
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                <div>
                  <div>Wins: {character.stats.wins}</div>
                  <div>Kills: {character.stats.kills}</div>
                </div>
                <div>
                  <div>Losses: {character.stats.losses}</div>
                  <div>Deaths: {character.stats.deaths}</div>
                </div>
              </div>
              
              {isActive && (
                <div style={{ 
                  marginTop: '0.5rem', 
                  padding: '0.25rem 0.5rem', 
                  backgroundColor: classDetails.color, 
                  color: 'white',
                  borderRadius: '0.25rem',
                  display: 'inline-block',
                  fontSize: '0.8rem'
                }}>
                  Selected
                </div>
              )}
            </div>
          );
        })}
        
        <button 
          className="secondary-button"
          onClick={() => setShowCreateForm(true)}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px dashed rgba(255, 255, 255, 0.3)',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
            fontSize: '1rem'
          }}
        >
          + Create New Character
        </button>
      </div>
    );
  };

  const renderCreateForm = () => {
    return (
      <div className="create-character-form">
        <h2>Create New Character</h2>
        <form onSubmit={handleCreateCharacter}>
          <div className="form-group">
            <label htmlFor="charName">Character Name</label>
            <input
              type="text"
              id="charName"
              value={newCharName}
              onChange={(e) => setNewCharName(e.target.value)}
              required
              minLength={3}
              maxLength={50}
              placeholder="Enter character name"
            />
          </div>
          
          <div className="form-group">
            <label>Character Class</label>
            <div className="class-selection">
              {classes.map(classOption => (
                <div 
                  key={classOption.id}
                  className={`class-option ${newCharClass === classOption.id ? 'selected' : ''}`}
                  onClick={() => setNewCharClass(classOption.id)}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    margin: '0.5rem 0',
                    cursor: 'pointer',
                    backgroundColor: newCharClass === classOption.id 
                      ? `${classOption.color}22` 
                      : 'rgba(0, 0, 0, 0.2)',
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: newCharClass === classOption.id 
                      ? classOption.color 
                      : 'transparent',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      height: '2.5rem', 
                      width: '2.5rem', 
                      borderRadius: '50%', 
                      backgroundColor: classOption.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold'
                    }}>
                      {classOption.name.substring(0, 1)}
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 0.25rem 0', color: classOption.color }}>
                        {classOption.name}
                      </h3>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                        <span>Health: {classOption.health}</span>
                        <span>Speed: {classOption.speed}</span>
                      </div>
                    </div>
                  </div>
                  
                  {newCharClass === classOption.id && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                      {classOption.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              type="button" 
              className="secondary-button"
              onClick={() => {
                setShowCreateForm(false);
                setNewCharName('');
                setNewCharClass('');
                setError('');
              }}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                flex: 1
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="primary-button"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#8b3a3a',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                flex: 2
              }}
            >
              Create Character
            </button>
          </div>
        </form>
      </div>
    );
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
          <button 
            onClick={() => {
              localStorage.removeItem('guildClashUser');
              navigate('/');
            }}
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
        padding: '2rem', 
        maxWidth: '800px', 
        margin: '0 auto', 
        width: '100%' 
      }}>
        <div style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.7)', 
          borderRadius: '0.5rem', 
          padding: '2rem',
          color: 'white'
        }}>
          <h1 style={{ 
            fontSize: '1.5rem', 
            marginBottom: '1.5rem', 
            color: '#e8d7b9',
            textAlign: 'center'
          }}>
            {showCreateForm ? 'Create Character' : 'Select Character'}
          </h1>

          {isLoading ? (
            <div className="loading-state" style={{ textAlign: 'center', padding: '2rem' }}>
              <div>Loading characters...</div>
            </div>
          ) : (
            <>
              {showCreateForm ? renderCreateForm() : renderCharacterList()}
              
              {!showCreateForm && characters.length > 0 && (
                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                  <button 
                    onClick={handleContinueToLobby}
                    style={{
                      padding: '0.75rem 2rem',
                      backgroundColor: '#8b3a3a',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: 'bold'
                    }}
                    disabled={!activeCharacterId}
                  >
                    Continue to Lobby
                  </button>
                  {error && <div className="error-message" style={{ marginTop: '1rem', color: '#ff6b6b' }}>{error}</div>}
                </div>
              )}
            </>
          )}
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

export default CharacterSelection; 