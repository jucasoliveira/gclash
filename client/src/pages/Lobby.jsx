import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Trophy, Swords, LogOut, Users, User, Settings } from 'lucide-react';

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
    console.log(`Selected game mode: ${mode}`);
    
    if (mode === 'tournament') {
      // Navigate to game page with tournament mode
      navigate('/game', { 
        state: { 
          gameMode: 'tournament',
          characterClass: activeCharacter?.characterClass.toLowerCase() || 'warrior'
        } 
      });
    } else if (mode === 'battleRoyale') {
      // Navigate to game page with battle royale mode
      navigate('/game', { 
        state: { 
          gameMode: 'battleRoyale',
          characterClass: activeCharacter?.characterClass.toLowerCase() || 'warrior'
        } 
      });
    }
  };

  // Get class color
  const getClassColor = (characterClass) => {
    switch (characterClass) {
      case 'CLERK':
        return 'text-blue-600';
      case 'WARRIOR':
        return 'text-red-600';
      case 'RANGER':
        return 'text-green-600';
      default:
        return 'text-[#8b3a3a]';
    }
  };

  // Get class background color
  const getClassBgColor = (characterClass) => {
    switch (characterClass) {
      case 'CLERK':
        return 'bg-blue-600';
      case 'WARRIOR':
        return 'bg-red-600';
      case 'RANGER':
        return 'bg-green-600';
      default:
        return 'bg-[#8b3a3a]';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a2e35] bg-blend-overlay bg-cover bg-center"
         style={{ backgroundImage: "url('/placeholder.svg')" }}>
      <header className="p-4 flex justify-between items-center bg-[#e8d7b9] border-b-2 border-[#8b3a3a]/40 relative overflow-hidden">
        {/* Parchment texture overlay */}
        <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
             style={{ backgroundImage: "url('/parchment-texture.svg')" }}></div>

        <div className="flex items-center gap-2 relative">
          <Shield className="h-6 w-6 text-[#8b3a3a]" />
          <span className="text-xl font-bold text-[#8b3a3a]">GUILD CLASH</span>
        </div>

        <div className="flex items-center gap-4 relative">
          {activeCharacter && (
            <div className="flex items-center gap-2 bg-[#1a2e35]/10 px-3 py-1 rounded-sm border border-[#8b3a3a]/20">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-bold ${getClassBgColor(activeCharacter.characterClass)}`}>
                {activeCharacter.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-[#5a3e2a] text-sm font-medium">{activeCharacter.name}</span>
                <span className={`text-xs font-medium ${getClassColor(activeCharacter.characterClass)}`}>
                  Level {activeCharacter.level}{" "}
                  {activeCharacter.characterClass.charAt(0) + activeCharacter.characterClass.slice(1).toLowerCase()}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Link to="/settings">
              <button className="text-[#8b3a3a] hover:text-[#6e2e2e] hover:bg-transparent bg-transparent p-2 rounded-full">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </button>
            </Link>

            <button 
              onClick={handleChangeCharacter}
              className="text-[#8b3a3a] hover:text-[#6e2e2e] hover:bg-transparent bg-transparent p-2 rounded-full"
            >
              <User className="h-5 w-5" />
              <span className="sr-only">Characters</span>
            </button>

            <button 
              onClick={handleLogout}
              className="text-[#8b3a3a] hover:text-[#6e2e2e] hover:bg-transparent bg-transparent p-2 rounded-full"
            >
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#e8d7b9] mb-2">Welcome to the Arena</h1>
          <p className="text-[#e8d7b9]/70">Choose your battle, {username}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Tournament Card */}
          <div className="bg-[#e8d7b9] bg-opacity-90 border-2 border-[#8b3a3a]/40 shadow-lg overflow-hidden rounded-sm relative">
            {/* Parchment texture overlay */}
            <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                 style={{ backgroundImage: "url('/parchment-texture.svg')" }}></div>

            <div className="bg-gradient-to-r from-[#8b3a3a]/20 to-transparent pb-2 relative p-4">
              <div className="flex items-center gap-2 text-[#8b3a3a] text-xl font-bold">
                <Trophy className="h-5 w-5" />
                Tournament
              </div>
              <div className="text-[#5a3e2a] text-sm">16-player bracket tournament</div>
            </div>
            <div className="pt-2 relative p-4">
              <div className="aspect-video relative rounded-sm overflow-hidden mb-4 border border-[#8b3a3a]/30">
                <div className="absolute inset-0 bg-cover bg-center"
                     style={{ backgroundImage: "url('/placeholder.svg')" }}></div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <div className="flex items-center gap-2 text-[#e8d7b9]">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{playerCount.tournament}/16 players waiting</span>
                  </div>
                </div>
              </div>
              <p className="text-[#5a3e2a] text-sm">
                Face off in a 16-player tournament bracket. Win your matches to advance to the finals and claim glory!
              </p>
            </div>
            <div className="p-4 relative">
              <button
                className="w-full bg-[#8b3a3a] hover:bg-[#6e2e2e] text-[#e8d7b9] border border-[#8b3a3a]/50 py-2 px-4 rounded"
                onClick={() => handleSelectGameMode('tournament')}
              >
                Join Tournament
              </button>
            </div>
          </div>

          {/* Battle Royale Card */}
          <div className="bg-[#e8d7b9] bg-opacity-90 border-2 border-[#8b3a3a]/40 shadow-lg overflow-hidden rounded-sm relative">
            {/* Parchment texture overlay */}
            <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                 style={{ backgroundImage: "url('/parchment-texture.svg')" }}></div>

            <div className="bg-gradient-to-r from-[#1a2e35]/30 to-transparent pb-2 relative p-4">
              <div className="flex items-center gap-2 text-[#1a2e35] text-xl font-bold">
                <Swords className="h-5 w-5" />
                Battle Royale
              </div>
              <div className="text-[#5a3e2a] text-sm">40-player free-for-all battle</div>
            </div>
            <div className="pt-2 relative p-4">
              <div className="aspect-video relative rounded-sm overflow-hidden mb-4 border border-[#8b3a3a]/30">
                <div className="absolute inset-0 bg-cover bg-center"
                     style={{ backgroundImage: "url('/placeholder.svg')" }}></div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <div className="flex items-center gap-2 text-[#e8d7b9]">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{playerCount.battleRoyale}/40 players waiting</span>
                  </div>
                </div>
              </div>
              <p className="text-[#5a3e2a] text-sm">
                Enter a massive 40-player battle royale on a sprawling map. Be the last warrior standing to earn your
                place on the leaderboard!
              </p>
            </div>
            <div className="p-4 relative">
              <button
                className="w-full bg-[#1a2e35] hover:bg-[#142228] text-[#e8d7b9] border border-[#1a2e35]/50 py-2 px-4 rounded"
                onClick={() => handleSelectGameMode('battleRoyale')}
              >
                Join Battle Royale
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-[#e8d7b9]/60 bg-[#1a2e35]/80 border-t border-[#8b3a3a]/20">
        <p>Guild Clash &copy; {new Date().getFullYear()} | All rights reserved</p>
      </footer>
    </div>
  );
}

export default Lobby; 