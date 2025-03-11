import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Settings() {
  const [volume, setVolume] = useState(50);
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('guildClashUser');
    if (!userData) {
      navigate('/');
    } else {
      try {
        const user = JSON.parse(userData);
        setUsername(user.username || '');
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    // Load saved settings if available
    const savedVolume = localStorage.getItem('guildClashVolume');
    if (savedVolume) {
      setVolume(parseInt(savedVolume, 10));
    }
  }, [navigate]);

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    localStorage.setItem('guildClashVolume', newVolume.toString());
  };

  return (
    <div className="page-container">
      <div className="settings-container">
        <h1 className="settings-title">Player Settings</h1>
        
        <div className="settings-group">
          <label htmlFor="username">Username: {username}</label>
        </div>
        
        <div className="settings-group">
          <label htmlFor="volume">Audio Volume: {volume}%</label>
          <input 
            type="range" 
            id="volume" 
            min="0" 
            max="100" 
            value={volume}
            onChange={handleVolumeChange}
            style={{ width: '100%' }}
          />
        </div>
        
        <div className="settings-group">
          <h3>Controls</h3>
          <div style={{ backgroundColor: '#222', padding: '1rem', borderRadius: '4px' }}>
            <p>Movement: WASD keys</p>
            <p>Camera: Arrow keys</p>
            <p>Attack: Left mouse button</p>
          </div>
        </div>
        
        <button 
          className="settings-back"
          onClick={() => navigate('/lobby')}
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

export default Settings; 