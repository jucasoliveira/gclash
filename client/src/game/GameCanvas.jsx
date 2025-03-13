import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as THREE from 'three';

// Import game components
import game from '../components/core/Game.js';
import { initGlobalFunctions } from './GameUtils.js';

function GameCanvas() {
  const canvasRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  
  // Get game parameters from location state
  const { state } = location;
  const characterClass = state?.characterClass || 'warrior';
  const gameMode = state?.gameMode || 'standard';
  const tournament = state?.tournament || null;

  useEffect(() => {
    // Initialize global functions
    initGlobalFunctions();
    
    // Check if user is logged in
    const userData = localStorage.getItem('guildClashUser');
    if (!userData) {
      navigate('/');
      return;
    }

    // Check if we have a character class
    if (!characterClass) {
      navigate('/character-selection');
      return;
    }

    console.log('Starting game with character class:', characterClass);
    console.log('Game mode:', gameMode);
    console.log('Tournament data:', tournament);

    // Initialize game if not already initialized
    if (!isGameInitialized && canvasRef.current) {
      console.log('Initializing game with:', { characterClass, gameMode, tournament });
      
      try {
        // Initialize the game with the canvas
        game.init(canvasRef.current);
        
        // Set the game mode and load appropriate map
        const initializeGameMode = async () => {
          try {
            // First, set the game mode
            game.gameMode = gameMode;
            console.log(`Setting game mode to: ${gameMode}`);
            
            // Convert to uppercase for compatibility with existing code
            const classForGame = characterClass.toUpperCase();
            console.log('Starting game with class:', classForGame);
            
            // Set the selected class
            game.selectedClass = classForGame;
            
            // Explicitly load the map before starting the game
            console.log(`Explicitly loading ${gameMode} map...`);
            await game._loadMap(gameMode);
            
            // For tournament mode, set tournament data if available
            if (gameMode === 'tournament' && tournament) {
              game.currentTournamentId = tournament.id;
              game.currentTournamentName = tournament.name;
              console.log(`Set tournament data: ${tournament.id} - ${tournament.name}`);
            }
            
            // Hide character selection UI (in case it's showing)
            game._hideCharacterSelection();
            
            // Show game UI
            game._showGameUI();
            
            // Set state to playing
            game.state = 'playing';
            
            // Prevent double map loading by temporarily overriding the _loadMap method
            const originalLoadMap = game._loadMap;
            game._loadMap = function(mode) {
              console.log(`Map loading skipped - already loaded ${gameMode} map`);
              return Promise.resolve();
            };
            
            // Start the game
            await game.start(classForGame);
            
            // Restore original _loadMap function
            game._loadMap = originalLoadMap;
            
            // Make game globally available for debugging
            window.game = game;
          } catch (error) {
            console.error('Error initializing game mode:', error);
            
            // Display error message to user
            const errorMessage = document.createElement('div');
            errorMessage.style.position = 'absolute';
            errorMessage.style.top = '50%';
            errorMessage.style.left = '50%';
            errorMessage.style.transform = 'translate(-50%, -50%)';
            errorMessage.style.color = 'white';
            errorMessage.style.backgroundColor = 'rgba(220, 53, 69, 0.8)';
            errorMessage.style.padding = '20px';
            errorMessage.style.borderRadius = '5px';
            errorMessage.style.fontSize = '18px';
            errorMessage.style.textAlign = 'center';
            errorMessage.style.maxWidth = '80%';
            errorMessage.innerHTML = `
              <h3>Error Starting Game</h3>
              <p>${error.message || 'Unknown error'}</p>
              <button style="padding: 10px 20px; margin-top: 15px; cursor: pointer; background: #444; color: white; border: none; border-radius: 4px;">
                Return to Lobby
              </button>
            `;
            
            // Add button event listener
            const button = errorMessage.querySelector('button');
            if (button) {
              button.addEventListener('click', () => {
                navigate('/lobby');
              });
            }
            
            // Add to document
            document.body.appendChild(errorMessage);
          }
        };
        
        initializeGameMode();
        setIsGameInitialized(true);
        
        // Set up event listener for escape key to return to lobby
        const handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            // Clean up game resources
            game.dispose();
            navigate('/lobby');
          }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        
        // Return cleanup function
        return () => {
          window.removeEventListener('keydown', handleKeyDown);
          if (isGameInitialized) {
            console.log('Cleaning up game resources');
            game.dispose();
          }
        };
      } catch (error) {
        console.error('Critical error initializing game:', error);
        
        // Display error message to user
        const errorMessage = document.createElement('div');
        errorMessage.style.position = 'absolute';
        errorMessage.style.top = '50%';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translate(-50%, -50%)';
        errorMessage.style.color = 'white';
        errorMessage.style.backgroundColor = 'rgba(220, 53, 69, 0.8)';
        errorMessage.style.padding = '20px';
        errorMessage.style.borderRadius = '5px';
        errorMessage.style.fontSize = '18px';
        errorMessage.style.textAlign = 'center';
        errorMessage.style.maxWidth = '80%';
        errorMessage.innerHTML = `
          <h3>Critical Error</h3>
          <p>Unable to initialize the game engine. Please try again later.</p>
          <pre style="text-align: left; max-width: 100%; overflow: auto; background: #333; padding: 10px; margin-top: 10px; font-size: 12px;">${error.stack || error.message || 'Unknown error'}</pre>
          <button style="padding: 10px 20px; margin-top: 15px; cursor: pointer; background: #444; color: white; border: none; border-radius: 4px;">
            Return to Lobby
          </button>
        `;
        
        // Add button event listener
        const button = errorMessage.querySelector('button');
        if (button) {
          button.addEventListener('click', () => {
            navigate('/lobby');
          });
        }
        
        // Add to document
        document.body.appendChild(errorMessage);
      }
    }
  }, [canvasRef, characterClass, gameMode, isGameInitialized, navigate, tournament]);

  // Add UI overlay for in-game UI elements
  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Game canvas */}
      <canvas 
        ref={canvasRef} 
        id="game-canvas"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      
      {/* UI overlay for HTML/CSS UI elements */}
      <div className="ui-overlay" id="ui-overlay"></div>
      
      {/* Game UI */}
      <div className="game-ui" id="game-ui" style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        right: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        pointerEvents: 'none'
      }}>
        {/* Health bar */}
        <div style={{ 
          width: '200px', 
          height: '20px', 
          backgroundColor: '#333',
          borderRadius: '10px',
          overflow: 'hidden',
          pointerEvents: 'none'
        }}>
          <div 
            id="health-fill"
            style={{ 
              width: '100%', 
              height: '100%', 
              backgroundColor: '#2ecc71',
              transition: 'width 0.3s ease-out, background-color 0.3s ease-out'
            }}
          ></div>
        </div>
        
        {/* Player stats */}
        <div id="player-stats" style={{ 
          color: 'white',
          textShadow: '1px 1px 2px black',
          pointerEvents: 'none'
        }}>
          Health: 100
        </div>
      </div>
      
      {/* Death overlay */}
      <div 
        id="death-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}
      >
        <div style={{ 
          fontSize: '4rem', 
          color: '#e74c3c',
          marginBottom: '2rem',
          textShadow: '0 0 10px #e74c3c'
        }}>
          YOU DIED
        </div>
        <div 
          className="death-message"
          style={{ 
            fontSize: '1.5rem', 
            color: 'white',
            marginBottom: '1rem'
          }}
        >
          You were defeated in battle!
        </div>
        <div 
          id="respawn-timer"
          style={{ 
            fontSize: '1.2rem', 
            color: '#aaa'
          }}
        >
          Respawning in 3...
        </div>
      </div>
      
      {/* Game mode indicator */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        padding: '8px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        Mode: {gameMode === 'battleRoyale' ? 'Battle Royale' : gameMode === 'tournament' ? 'Tournament' : 'Standard'}
      </div>
      
      {/* Back to lobby button */}
      <button 
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '10px 20px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          border: '1px solid #444',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 100
        }}
        onClick={() => {
          game.dispose();
          navigate('/lobby');
        }}
      >
        Back to Lobby (ESC)
      </button>
    </div>
  );
}

export default GameCanvas; 