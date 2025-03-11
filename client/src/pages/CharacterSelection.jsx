import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, LogOut, Settings, Sword, Users, Info, CircleDot } from 'lucide-react';

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
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  // Mock items data for UI display
  const mockItems = {
    CLERK: [
      {
        id: "item5",
        name: "Arcane Staff",
        category: "weapon",
        rarity: "rare",
        characteristics: {
          damage: "18-25",
          attackSpeed: "Slow",
          durability: "40/40",
        },
        properties: [
          { name: "Intelligence", value: "+15", isPositive: true },
          { name: "Spell Damage", value: "+20%", isPositive: true },
          { name: "Mana Regeneration", value: "+10%", isPositive: true },
        ],
        sockets: [{ filled: true, gemName: "Sapphire", effect: "+12 Cold Damage" }],
        equipped: true,
        requiredLevel: 22,
        icon: "🪄",
      },
      {
        id: "item6",
        name: "Robe of Wisdom",
        category: "armor",
        rarity: "magic",
        characteristics: {
          defense: "45",
          durability: "30/30",
        },
        properties: [
          { name: "Intelligence", value: "+12", isPositive: true },
          { name: "Maximum Mana", value: "+35", isPositive: true },
        ],
        sockets: [],
        equipped: true,
        requiredLevel: 20,
        icon: "👘",
      }
    ],
    WARRIOR: [
      {
        id: "item1",
        name: "Runic Broadsword",
        category: "weapon",
        rarity: "rare",
        characteristics: {
          damage: "24-38",
          attackSpeed: "Medium",
          durability: "45/45",
        },
        properties: [
          { name: "Strength", value: "+12", isPositive: true },
          { name: "Attack Rating", value: "+25%", isPositive: true },
          { name: "Critical Hit Chance", value: "+5%", isPositive: true },
        ],
        sockets: [{ filled: true, gemName: "Ruby", effect: "+15 Fire Damage" }, { filled: false }],
        equipped: true,
        requiredLevel: 25,
        icon: "⚔️",
      },
      {
        id: "item2",
        name: "Platemail of the Bear",
        category: "armor",
        rarity: "magic",
        characteristics: {
          defense: "120",
          durability: "60/60",
        },
        properties: [
          { name: "Vitality", value: "+15", isPositive: true },
          { name: "Physical Damage Reduction", value: "8%", isPositive: true },
        ],
        sockets: [{ filled: false }],
        equipped: true,
        requiredLevel: 30,
        icon: "🛡️",
      }
    ],
    RANGER: [
      {
        id: "item9",
        name: "Composite Longbow",
        category: "weapon",
        rarity: "rare",
        characteristics: {
          damage: "15-30",
          attackSpeed: "Fast",
          durability: "35/35",
        },
        properties: [
          { name: "Dexterity", value: "+14", isPositive: true },
          { name: "Attack Speed", value: "+10%", isPositive: true },
          { name: "Critical Hit Damage", value: "+25%", isPositive: true },
        ],
        sockets: [{ filled: true, gemName: "Emerald", effect: "+12% Critical Hit Chance" }],
        equipped: true,
        requiredLevel: 22,
        icon: "🏹",
      },
      {
        id: "item10",
        name: "Studded Leather",
        category: "armor",
        rarity: "magic",
        characteristics: {
          defense: "65",
          durability: "40/40",
        },
        properties: [
          { name: "Dexterity", value: "+10", isPositive: true },
          { name: "Movement Speed", value: "+5%", isPositive: true },
        ],
        sockets: [],
        equipped: true,
        requiredLevel: 18,
        icon: "🧥",
      }
    ]
  };

  const classes = [
    { id: 'CLERK', name: 'Clerk', color: 'blue', health: 80, speed: 15, description: 'Magic user with speed and agility', icon: '🧙‍♂️' },
    { id: 'WARRIOR', name: 'Warrior', color: 'red', health: 120, speed: 8, description: 'Tank with heavy armor and strength', icon: '⚔️' },
    { id: 'RANGER', name: 'Ranger', color: 'green', health: 100, speed: 12, description: 'Balanced fighter with ranged attacks', icon: '🏹' },
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
      
      // If there's an active character, select it
      if (data.activeCharacterId) {
        const activeChar = data.characters.find(c => c._id === data.activeCharacterId);
        if (activeChar) {
          setSelectedCharacter(activeChar);
        }
      }
    } catch (error) {
      console.error('Error fetching characters:', error);
      setError(error.message || 'Failed to fetch characters. Please try again.');
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

    setIsLoading(true);

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
        setSelectedCharacter(data.character);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCharacter = async (character) => {
    if (!character || isLoading) return;
    
    setSelectedCharacter(character);
    setIsLoading(true);
    
    try {
      const response = await fetch(`http://localhost:3000/api/characters/${character._id}/activate`, {
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
      
      // If this is successful, we can immediately continue to lobby if desired
      if (data.activeCharacterId === character._id) {
        // Update UI to show this character is now active
        const updatedCharacters = characters.map(char => ({
          ...char,
          isActive: char._id === character._id
        }));
        setCharacters(updatedCharacters);
      }
    } catch (error) {
      console.error('Error selecting character:', error);
      setError(error.message || 'Failed to select character. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToLobby = () => {
    if (!activeCharacterId) {
      setError('Please select a character first');
      console.log('No active character selected');
      return;
    }

    // Find the active character to get its details
    const activeCharacter = characters.find(char => char._id === activeCharacterId);
    
    if (!activeCharacter) {
      setError('Selected character not found');
      console.log('Active character not found in characters list:', activeCharacterId, characters);
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

    console.log('Navigating to lobby with character:', activeCharacter.name);
    
    // Navigate to lobby
    navigate('/lobby');
  };

  const handleDeleteCharacter = async () => {
    if (!selectedCharacter) return;

    setIsLoading(true);

    try {
      const response = await fetch(`http://localhost:3000/api/characters/${selectedCharacter._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete character');
      }

      // Remove the character from the list
      setCharacters(prevChars => prevChars.filter(char => char._id !== selectedCharacter._id));
      
      // If the deleted character was active, clear the active character
      if (selectedCharacter._id === activeCharacterId) {
        setActiveCharacterId(null);
      }
      
      setSelectedCharacter(null);
    } catch (error) {
      console.error('Error deleting character:', error);
      setError(error.message || 'Failed to delete character. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getClassDetails = (classId) => {
    return classes.find(c => c.id === classId) || classes[0];
  };

  const getClassColor = (characterClass) => {
    const classDetails = getClassDetails(characterClass);
    switch (classDetails.color) {
      case 'blue':
        return 'text-blue-600';
      case 'red':
        return 'text-red-600';
      case 'green':
        return 'text-green-600';
      default:
        return 'text-[#8b3a3a]';
    }
  };

  const getClassBgColor = (characterClass) => {
    const classDetails = getClassDetails(characterClass);
    switch (classDetails.color) {
      case 'blue':
        return 'bg-blue-600/20';
      case 'red':
        return 'bg-red-600/20';
      case 'green':
        return 'bg-green-600/20';
      default:
        return 'bg-[#8b3a3a]/20';
    }
  };

  const getClassIcon = (characterClass) => {
    const classDetails = getClassDetails(characterClass);
    switch (classDetails.id) {
      case 'CLERK':
        return <span className="text-blue-600">🧙‍♂️</span>;
      case 'WARRIOR':
        return <span className="text-red-600">⚔️</span>;
      case 'RANGER':
        return <span className="text-green-600">🏹</span>;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common':
        return 'text-gray-200';
      case 'magic':
        return 'text-blue-400';
      case 'rare':
        return 'text-yellow-400';
      case 'legendary':
        return 'text-orange-400';
      case 'set':
        return 'text-green-400';
      default:
        return 'text-gray-200';
    }
  };

  const getEquippedItems = () => {
    if (!selectedCharacter) return [];
    
    // For the demo, return mock items based on character class
    return mockItems[selectedCharacter.characterClass] || [];
  };

  const handleLogout = () => {
    localStorage.removeItem('guildClashUser');
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-[#1a2e35] bg-blend-overlay bg-cover bg-center"
         style={{ backgroundImage: "url('/placeholder.svg')" }}>
      {/* Left Menu */}
      <div className="w-64 bg-[#1a2e35]/95 border-r border-[#8b3a3a]/20">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <Shield className="h-8 w-8 text-[#8b3a3a]" />
            <span className="text-xl font-bold text-[#e8d7b9]">GUILD CLASH</span>
          </div>

          <div className="space-y-2">
            {[
              { icon: <Users className="h-5 w-5" />, label: "Friends List" },
              { icon: <Settings className="h-5 w-5" />, label: "Settings", onClick: () => navigate('/settings') },
              { icon: <Info className="h-5 w-5" />, label: "Credits" },
              { icon: <LogOut className="h-5 w-5" />, label: "Exit Game", onClick: handleLogout },
            ].map((item) => (
              <button
                key={item.label}
                className="w-full flex items-center gap-3 px-4 py-2 text-[#e8d7b9]/70 hover:text-[#e8d7b9] hover:bg-[#8b3a3a]/20 rounded-sm transition-colors"
                onClick={item.onClick}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Character Preview & Equipment */}
      <div className="flex-1 relative">
        {selectedCharacter ? (
          <div className="absolute inset-0 flex flex-col p-6">
            <div className="flex items-center mb-6">
              <div className="w-24 h-24 mr-4">
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl">
                    {getClassDetails(selectedCharacter.characterClass).icon}
                  </span>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#e8d7b9]">
                  {selectedCharacter.name}
                </h2>
                <p className={`text-lg font-medium ${getClassColor(selectedCharacter.characterClass)}`}>
                  Level {selectedCharacter.level}{" "}
                  {getClassDetails(selectedCharacter.characterClass).name}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <h3 className="text-[#e8d7b9] text-lg font-medium mb-3 border-b border-[#8b3a3a]/30 pb-1">
                Equipped Items
              </h3>

              <div className="space-y-4">
                {getEquippedItems().map((item) => (
                  <div key={item.id} className="bg-[#1a2e35]/50 border border-[#8b3a3a]/30 rounded-sm p-3">
                    <div className="flex items-center mb-2">
                      <span className="text-2xl mr-2">{item.icon}</span>
                      <div>
                        <h4 className={`font-medium ${getRarityColor(item.rarity)}`}>{item.name}</h4>
                        <p className="text-[#e8d7b9]/60 text-sm">
                          {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                          {item.requiredLevel > 0 && ` (Required Level: ${item.requiredLevel})`}
                        </p>
                      </div>
                    </div>

                    {/* Characteristics */}
                    {Object.keys(item.characteristics).length > 0 && (
                      <div className="mb-2">
                        <h5 className="text-[#e8d7b9]/80 text-sm font-medium mb-1">Characteristics:</h5>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          {Object.entries(item.characteristics).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-[#e8d7b9]/60">{key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                              <span className="text-[#e8d7b9]">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Properties */}
                    {item.properties.length > 0 && (
                      <div className="mb-2">
                        <h5 className="text-[#e8d7b9]/80 text-sm font-medium mb-1">Properties:</h5>
                        <div className="space-y-1">
                          {item.properties.map((prop, index) => (
                            <div key={index} className="text-sm">
                              <span className={prop.isPositive ? "text-green-400" : "text-red-400"}>
                                {prop.value} {prop.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sockets */}
                    {item.sockets.length > 0 && (
                      <div>
                        <h5 className="text-[#e8d7b9]/80 text-sm font-medium mb-1">Sockets ({item.sockets.length}):</h5>
                        <div className="flex gap-2">
                          {item.sockets.map((socket, index) => (
                            <div
                              key={index}
                              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                socket.filled ? "bg-[#8b3a3a]/50" : "bg-[#1a2e35]/70 border border-[#8b3a3a]/30"
                              }`}
                              title={socket.filled ? `${socket.gemName}: ${socket.effect}` : "Empty Socket"}
                            >
                              {socket.filled ? (
                                <CircleDot className="h-4 w-4 text-yellow-400" />
                              ) : (
                                <CircleDot className="h-4 w-4 text-[#e8d7b9]/30" />
                              )}
                            </div>
                          ))}
                        </div>
                        {item.sockets.some((s) => s.filled) && (
                          <div className="mt-1 text-xs text-[#e8d7b9]/60">
                            {item.sockets
                              .filter((s) => s.filled)
                              .map((s, i) => (
                                <div key={i}>
                                  <span className="text-yellow-400">{s.gemName}</span>: {s.effect}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {getEquippedItems().length === 0 && (
                  <div className="text-center py-8 text-[#e8d7b9]/50">No items equipped</div>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-center gap-4">
              <button
                className="border border-red-600/50 text-red-600 hover:bg-red-600/10 bg-transparent py-2 px-4 rounded"
                onClick={handleDeleteCharacter}
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Delete"}
              </button>
              <button
                className="bg-[#8b3a3a] hover:bg-[#6e2e2e] text-[#e8d7b9] border border-[#8b3a3a]/50 py-2 px-4 rounded"
                onClick={activeCharacterId !== selectedCharacter._id ? 
                  () => handleSelectCharacter(selectedCharacter) : 
                  handleContinueToLobby}
                disabled={isLoading}
              >
                {activeCharacterId !== selectedCharacter._id ? "Select Character" : "Continue"}
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[#e8d7b9]/50 text-lg">Select a character to begin your journey</p>
          </div>
        )}
      </div>

      {/* Right Character List */}
      <div className="w-80 bg-[#1a2e35]/95 border-l border-[#8b3a3a]/20">
        <div className="p-4">
          <button
            className="w-full bg-[#8b3a3a] hover:bg-[#6e2e2e] text-[#e8d7b9] border border-[#8b3a3a]/50 py-2 px-4 rounded mb-4"
            onClick={() => setShowCreateForm(true)}
          >
            Create New
          </button>

          <div className="space-y-2">
            {characters.map((character) => (
              <button
                key={character._id}
                className={`w-full text-left p-3 rounded-sm transition-colors ${
                  selectedCharacter && selectedCharacter._id === character._id
                    ? "bg-[#8b3a3a]/20 border border-[#8b3a3a]/50"
                    : "hover:bg-[#8b3a3a]/10 border border-transparent"
                }`}
                onClick={() => handleSelectCharacter(character)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded-full ${getClassBgColor(character.characterClass)}`}>
                    {getClassIcon(character.characterClass)}
                  </div>
                  <div>
                    <div className="text-[#e8d7b9] font-medium">{character.name}</div>
                    <div className={getClassColor(character.characterClass)}>
                      Level {character.level} {getClassDetails(character.characterClass).name}
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {characters.length === 0 && !isLoading && (
              <div className="text-center py-8 text-[#e8d7b9]/50">
                No characters found. Create your first character!
              </div>
            )}

            {isLoading && (
              <div className="text-center py-8 text-[#e8d7b9]/50">
                Loading characters...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Character Dialog */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#e8d7b9] border-2 border-[#8b3a3a]/40 shadow-lg rounded-sm relative overflow-hidden max-w-md w-full mx-auto p-6">
            {/* Parchment texture overlay */}
            <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                 style={{ backgroundImage: "url('/parchment-texture.svg')" }}></div>

            <div className="relative">
              <h2 className="text-2xl font-bold text-[#8b3a3a] mb-2">Create New Character</h2>
              <p className="text-[#5a3e2a]/70 mb-4">
                Choose a name and class for your new character
              </p>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateCharacter} className="space-y-6 relative">
              <div className="space-y-2">
                <label htmlFor="characterName" className="block text-[#5a3e2a]">
                  Character Name
                </label>
                <input
                  id="characterName"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="Enter a name for your character"
                  className="w-full bg-[#e8d7b9]/60 border border-[#8b3a3a]/30 text-[#5a3e2a] focus:ring-[#8b3a3a] focus:border-[#8b3a3a] p-2 rounded"
                  required
                  minLength={3}
                  maxLength={50}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {classes.map((classOption) => (
                  <button
                    key={classOption.id}
                    type="button"
                    className={`p-4 rounded-sm border-2 text-center transition-colors ${
                      newCharClass === classOption.id
                        ? "bg-[#8b3a3a]/10 border-[#8b3a3a] text-[#8b3a3a]"
                        : "border-[#8b3a3a]/30 text-[#5a3e2a] hover:bg-[#8b3a3a]/5"
                    }`}
                    onClick={() => setNewCharClass(classOption.id)}
                  >
                    <div className="text-3xl mb-2">{classOption.icon}</div>
                    <div className="font-medium">{classOption.name}</div>
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="border-[#8b3a3a]/50 text-[#8b3a3a] hover:bg-[#8b3a3a]/10 bg-transparent py-2 px-4 rounded"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#8b3a3a] hover:bg-[#6e2e2e] text-[#e8d7b9] border border-[#8b3a3a]/50 py-2 px-4 rounded"
                  disabled={!newCharName || !newCharClass || isLoading}
                >
                  {isLoading ? "Creating..." : "Create Character"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CharacterSelection; 