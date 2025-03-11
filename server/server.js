// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const bodyParser = require('body-parser');

// Import models
const { Player } = require('./models');
const Tournament = require('./models/Tournament');
const TournamentWinner = require('./models/TournamentWinner');
const BattleRoyale = require('./models/BattleRoyale');
const BattleRoyaleManager = require('./utils/battleRoyaleManager');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guildclash';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Character class definitions
const CHARACTER_CLASSES = {
  CLERK: {
    health: 80,
    damage: 15,
    speed: 0.15,
    attackSpeed: 1.0,
    range: 8
  },
  WARRIOR: {
    health: 120,
    damage: 20,
    speed: 0.08,
    attackSpeed: 1.0,
    range: 2
  },
  RANGER: {
    health: 100,
    damage: 18,
    speed: 0.12,
    attackSpeed: 1.0,
    range: 6
  }
};

/**
 * Get stats for a character class
 * @param {string} characterClass - The character class (CLERK, WARRIOR, RANGER)
 * @returns {Object} The stats for the character class
 */
function getClassStats(characterClass) {
  // Normalize character class to uppercase
  const normalizedClass = characterClass.toUpperCase();
  
  // Return stats for the class or default stats if class not found
  return CHARACTER_CLASSES[normalizedClass] || {
    health: 100,
    damage: 10,
    speed: 0.1,
    attackSpeed: 1.0,
    range: 5
  };
}

// Connect to MongoDB
const connectMongoDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // 5 seconds timeout for server selection
    });
    console.log('Connected to MongoDB');
    
    // Create test player if in development mode
    if (NODE_ENV === 'development') {
      try {
        // Check if test player exists
        const testPlayer = await Player.findOne({ username: 'TestPlayer' });
        
        if (!testPlayer) {
          // Create a test player
          const newPlayer = new Player({
            username: 'TestPlayer',
            characterClass: 'WARRIOR',
            score: 100,
            stats: {
              wins: 5,
              losses: 2,
              kills: 20,
              deaths: 10,
              damageDealt: 1500,
              healingDone: 0,
              gamesPlayed: 7
            }
          });
          
          await newPlayer.save();
          console.log('Created test player');
        }
      } catch (err) {
        console.error('Error creating test player:', err);
      }
    }
    
    return true;
  } catch (err) {
    console.warn('MongoDB connection error:', err.message);
    console.warn('Continuing without database connection...');
    return false;
  }
};

// Try to connect but don't stop server if connection fails
connectMongoDB();

// API Routes

/**
 * @route   POST /api/auth/register
 * @desc    Register a new player
 * @access  Public
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if username or email already exists
    const existingPlayer = await Player.findOne({
      $or: [{ username }, { email }]
    });

    if (existingPlayer) {
      return res.status(400).json({
        error: existingPlayer.username === username
          ? 'Username already exists'
          : 'Email already exists'
      });
    }

    // Create new player
    const newPlayer = new Player({
      username,
      email,
      characters: []
    });

    // Set password (this uses the method defined in the Player model)
    newPlayer.setPassword(password);

    // Save player to database
    await newPlayer.save();

    // Return player data (excluding password and salt)
    res.status(201).json({
      id: newPlayer._id,
      username: newPlayer.username,
      email: newPlayer.email,
      tier: newPlayer.tier,
      characters: []
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login a player
 * @access  Public
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find player by username and include password and salt fields
    const player = await Player.findOne({ username }).select('+password +salt');

    if (!player) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Validate password
    if (!player.validatePassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last active timestamp
    player.lastActive = Date.now();
    await player.save();

    // Return player data (excluding password and salt)
    res.json({
      id: player._id,
      username: player.username,
      email: player.email,
      tier: player.tier,
      characters: player.characters,
      activeCharacterId: player.activeCharacterId
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

/**
 * @route   GET /api/characters
 * @desc    Get all characters for a player
 * @access  Private
 */
app.get('/api/characters', async (req, res) => {
  try {
    const { playerId } = req.query;

    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }

    const player = await Player.findById(playerId);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
      characters: player.characters,
      activeCharacterId: player.activeCharacterId
    });
  } catch (error) {
    console.error('Error fetching characters:', error);
    res.status(500).json({ error: 'Server error fetching characters' });
  }
});

/**
 * @route   POST /api/characters
 * @desc    Create a new character for a player
 * @access  Private
 */
app.post('/api/characters', async (req, res) => {
  try {
    const { playerId, name, characterClass } = req.body;

    if (!playerId || !name || !characterClass) {
      return res.status(400).json({ error: 'Player ID, name, and character class are required' });
    }

    const player = await Player.findById(playerId);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Validate character class
    const validClasses = ['CLERK', 'WARRIOR', 'RANGER'];
    const normalizedClass = characterClass.toUpperCase();
    
    if (!validClasses.includes(normalizedClass)) {
      return res.status(400).json({ error: 'Invalid character class' });
    }

    // Create new character
    const newCharacter = {
      name,
      characterClass: normalizedClass,
      level: 1,
      experience: 0,
      equipment: {
        weapon: null,
        armor: null,
        accessory: null
      },
      items: [],
      stats: {
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        healingDone: 0,
        gamesPlayed: 0
      }
    };

    // Add character to player
    player.characters.push(newCharacter);
    
    // If this is the player's first character, set it as active
    if (player.characters.length === 1) {
      player.activeCharacterId = player.characters[0]._id;
    }
    
    await player.save();

    res.status(201).json({
      character: player.characters[player.characters.length - 1],
      activeCharacterId: player.activeCharacterId
    });
  } catch (error) {
    console.error('Error creating character:', error);
    res.status(500).json({ error: 'Server error creating character' });
  }
});

/**
 * @route   PUT /api/characters/:characterId/activate
 * @desc    Set a character as active
 * @access  Private
 */
app.put('/api/characters/:characterId/activate', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }

    const player = await Player.findById(playerId);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if character exists
    const character = player.characters.id(characterId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Set character as active
    player.activeCharacterId = characterId;
    await player.save();

    res.json({
      activeCharacterId: player.activeCharacterId,
      message: 'Character activated successfully'
    });
  } catch (error) {
    console.error('Error activating character:', error);
    res.status(500).json({ error: 'Server error activating character' });
  }
});

/**
 * @route   GET /api/characters/:characterId
 * @desc    Get a specific character
 * @access  Private
 */
app.get('/api/characters/:characterId', async (req, res) => {
  try {
    const { characterId } = req.params;
    const { playerId } = req.query;

    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }

    const player = await Player.findById(playerId);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Find character
    const character = player.characters.id(characterId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json({ character });
  } catch (error) {
    console.error('Error fetching character:', error);
    res.status(500).json({ error: 'Server error fetching character' });
  }
});

// API endpoint to check for battle royale triggers
app.get('/api/check-battle-royale-trigger', async (req, res) => {
  try {
    const pendingCount = await BattleRoyaleManager.getPendingWinnersCount();
    const canTrigger = await BattleRoyaleManager.checkForBattleRoyaleTrigger();
    
    res.json({
      pendingWinners: pendingCount,
      canTrigger,
      requiredWinners: 40
    });
  } catch (error) {
    console.error('Error checking battle royale trigger:', error);
    res.status(500).json({ error: 'Failed to check battle royale trigger' });
  }
});

// API endpoint to manually trigger a battle royale
app.post('/api/trigger-battle-royale', async (req, res) => {
  try {
    const battleRoyale = await BattleRoyaleManager.checkAndTriggerBattleRoyale();
    
    if (battleRoyale) {
      res.json({
        success: true,
        battleRoyale: {
          id: battleRoyale._id,
          name: battleRoyale.name,
          participants: battleRoyale.participants.length,
          status: battleRoyale.status
        }
      });
    } else {
      const pendingCount = await BattleRoyaleManager.getPendingWinnersCount();
      res.status(400).json({
        success: false,
        message: `Not enough tournament winners (${pendingCount}/40)`,
        pendingWinners: pendingCount
      });
    }
  } catch (error) {
    console.error('Error triggering battle royale:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger battle royale' });
  }
});

// API endpoint to add test tournament winners
app.post('/api/add-test-winners', async (req, res) => {
  try {
    const count = parseInt(req.query.count || '1', 10);
    
    if (isNaN(count) || count < 1 || count > 40) {
      return res.status(400).json({ error: 'Count must be between 1 and 40' });
    }
    
    const results = [];
    
    for (let i = 0; i < count; i++) {
      const winner = await BattleRoyaleManager.addTestWinner({});
      if (winner) {
        results.push({
          id: winner._id,
          username: winner.username,
          characterClass: winner.characterClass
        });
      }
    }
    
    const pendingCount = await BattleRoyaleManager.getPendingWinnersCount();
    
    res.json({
      success: true,
      added: results.length,
      winners: results,
      pendingWinners: pendingCount
    });
  } catch (error) {
    console.error('Error adding test winners:', error);
    res.status(500).json({ success: false, error: 'Failed to add test winners' });
  }
});

// Player routes
app.get('/api/players', async (req, res) => {
  try {
    const players = await Player.find().select('-__v');
    res.json(players);
  } catch (err) {
    console.error('Error fetching players:', err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

app.get('/api/players/:id', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).select('-__v');
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(player);
  } catch (err) {
    console.error('Error fetching player:', err);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

app.post('/api/players', async (req, res) => {
  try {
    const { username, characterClass } = req.body;
    
    console.log('Creating player:', { username, characterClass });
    
    // Validate required fields
    if (!username || !characterClass) {
      console.log('Validation error: Username and characterClass are required');
      return res.status(400).json({ error: 'Username and characterClass are required' });
    }
    
    // Check if username already exists
    const existingPlayer = await Player.findOne({ username });
    if (existingPlayer) {
      console.log('Username already exists:', username);
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Create new player
    const newPlayer = new Player({
      username,
      characterClass,
      score: 0,
      stats: {
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        healingDone: 0,
        gamesPlayed: 0
      }
    });
    
    await newPlayer.save();
    console.log('Player created successfully:', newPlayer.username);
    res.status(201).json(newPlayer);
  } catch (err) {
    console.error('Error creating player:', err);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

app.put('/api/players/:id', async (req, res) => {
  try {
    const { username, characterClass, score, stats } = req.body;
    
    // Find player
    const player = await Player.findById(req.params.id);
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Update fields if provided
    if (username) player.username = username;
    if (characterClass) player.characterClass = characterClass;
    if (score !== undefined) player.score = score;
    if (stats) {
      // Update only provided stats
      Object.keys(stats).forEach(key => {
        if (player.stats[key] !== undefined) {
          player.stats[key] = stats[key];
        }
      });
    }
    
    // Update lastActive
    player.lastActive = Date.now();
    
    await player.save();
    res.json(player);
  } catch (err) {
    console.error('Error updating player:', err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Leaderboard route
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await Player.getLeaderboard(limit);
    res.json(leaderboard);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Tournament routes
app.get('/api/tournaments', async (req, res) => {
  try {
    const tournaments = await Tournament.find().select('-__v');
    res.json(tournaments);
  } catch (err) {
    console.error('Error fetching tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

app.post('/api/tournaments', async (req, res) => {
  try {
    const { name, tier, participants } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Tournament name is required' });
    }
    
    // Create new tournament
    const newTournament = new Tournament({
      name,
      tier: tier || 'ALL',
      participants: participants || []
    });
    
    // Generate brackets if participants are provided
    if (participants && participants.length >= 2) {
      newTournament.generateBrackets();
    }
    
    await newTournament.save();
    res.status(201).json(newTournament);
  } catch (err) {
    console.error('Error creating tournament:', err);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// Battle Royale routes
app.get('/api/battle-royale', async (req, res) => {
  try {
    const matches = await BattleRoyale.find().select('-__v');
    res.json(matches);
  } catch (err) {
    console.error('Error fetching battle royale matches:', err);
    res.status(500).json({ error: 'Failed to fetch battle royale matches' });
  }
});

app.get('/api/battle-royale/active', async (req, res) => {
  try {
    const activeMatches = await BattleRoyale.getActiveMatches();
    res.json(activeMatches);
  } catch (err) {
    console.error('Error fetching active battle royale matches:', err);
    res.status(500).json({ error: 'Failed to fetch active battle royale matches' });
  }
});

// Serve the index.html for all non-API routes (SPA approach)
app.get('*', (req, res, next) => {
  // Skip API requests
  if (req.url.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Store active players
const players = {};

// Global tournament state
const activeTournaments = {};

// Function to check if a tournament is ready to start
function checkTournamentReady(tournamentId) {
  const tournament = activeTournaments[tournamentId];
  if (!tournament) return false;
  
  // For testing purposes, we can start with fewer players
  // In production, we would require 16 players
  const minPlayers = process.env.NODE_ENV === 'development' ? 4 : 16;
  
  if (tournament.players.length >= minPlayers) {
    return true;
  }
  return false;
}

// Function to create tournament brackets
function createTournamentBrackets(tournamentId) {
  const tournament = activeTournaments[tournamentId];
  if (!tournament) return null;
  
  // Shuffle players for random seeding
  const shuffledPlayers = [...tournament.players].sort(() => 0.5 - Math.random());
  
  // Calculate number of rounds needed
  const numPlayers = shuffledPlayers.length;
  const numRounds = Math.ceil(Math.log2(numPlayers));
  
  // Create bracket structure
  const brackets = [];
  
  // First round with actual participants
  const firstRoundMatches = [];
  const numFirstRoundMatches = Math.floor(numPlayers / 2);
  
  for (let i = 0; i < numFirstRoundMatches; i++) {
    const player1 = shuffledPlayers[i];
    const player2 = shuffledPlayers[numPlayers - 1 - i];
    
    firstRoundMatches.push({
      matchId: `R1-M${i+1}`,
      player1Id: player1.id,
      player2Id: player2.id,
      player1Name: player1.username || player1.id,
      player2Name: player2.username || player2.id,
      winnerId: null,
      status: 'PENDING'
    });
  }
  
  brackets.push({
    round: 1,
    matches: firstRoundMatches
  });
  
  // Generate placeholder matches for subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const numMatches = Math.pow(2, numRounds - round);
    const matches = [];
    
    for (let i = 0; i < numMatches; i++) {
      matches.push({
        matchId: `R${round}-M${i+1}`,
        player1Id: null,
        player2Id: null,
        player1Name: 'TBD',
        player2Name: 'TBD',
        winnerId: null,
        status: 'PENDING'
      });
    }
    
    brackets.push({
      round,
      matches
    });
  }
  
  return brackets;
}

// Function to update tournament bracket after a match
function updateTournamentBracket(tournamentId, matchId, winnerId) {
  const tournament = activeTournaments[tournamentId];
  if (!tournament) return false;
  
  // Find the match in the bracket
  let match = null;
  let roundIndex = -1;
  let matchIndex = -1;
  
  for (let i = 0; i < tournament.brackets.length; i++) {
    const round = tournament.brackets[i];
    for (let j = 0; j < round.matches.length; j++) {
      if (round.matches[j].matchId === matchId) {
        match = round.matches[j];
        roundIndex = i;
        matchIndex = j;
        break;
      }
    }
    if (match) break;
  }
  
  if (!match) return false;
  
  // Update match result
  match.winnerId = winnerId;
  match.status = 'COMPLETED';
  
  // Find winner name
  const winner = tournament.players.find(p => p.id === winnerId);
  const winnerName = winner ? (winner.username || winner.id) : winnerId;
  
  // If not the final round, update the next round's match
  if (roundIndex < tournament.brackets.length - 1) {
    const nextRound = tournament.brackets[roundIndex + 1];
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const nextMatch = nextRound.matches[nextMatchIndex];
    
    // Determine if this winner goes to player1 or player2 slot
    if (matchIndex % 2 === 0) {
      nextMatch.player1Id = winnerId;
      nextMatch.player1Name = winnerName;
    } else {
      nextMatch.player2Id = winnerId;
      nextMatch.player2Name = winnerName;
    }
    
    // If both players are set, update match status
    if (nextMatch.player1Id && nextMatch.player2Id) {
      nextMatch.status = 'READY';
    }
  } else {
    // This was the final match, tournament is complete
    tournament.status = 'COMPLETED';
    tournament.winner = {
      id: winnerId,
      name: winnerName
    };
    
    // Broadcast tournament completion
    broadcastToAll({
      type: 'tournamentComplete',
      tournamentId,
      winner: tournament.winner
    });
    
    // Save tournament results to database if connected
    if (mongoose.connection.readyState === 1) {
      // Use a self-executing async function to allow await
      (async () => {
        try {
          // Create a database record of the tournament
          const dbTournament = new Tournament({
            name: tournament.name,
            tier: tournament.tier || 'ALL',
            participants: tournament.players.map(p => ({
              playerId: p.dbId,
              username: p.username || p.id,
              characterClass: p.characterClass
            })),
            winner: {
              playerId: winner.dbId,
              username: winner.username || winner.id,
              characterClass: winner.characterClass
            }
          });
          
          // Generate brackets and save
          dbTournament.generateBrackets();
          dbTournament.status = 'COMPLETED';
          dbTournament.endDate = new Date();
          await dbTournament.save();
          
          console.log(`Tournament ${tournamentId} saved to database`);
          
          // Save the winner to the TournamentWinner collection
          const tournamentWinner = new TournamentWinner({
            playerId: winner.dbId,
            username: winner.username || winner.id,
            characterClass: winner.characterClass,
            tournamentId: dbTournament._id,
            tournamentName: tournament.name,
            tier: tournament.tier || 'ALL'
          });
          
          await tournamentWinner.save();
          console.log(`Tournament winner ${winner.username || winner.id} saved to database`);
          
          // Check if we have enough winners to trigger a battle royale
          const pendingCount = await BattleRoyaleManager.getPendingWinnersCount();
          console.log(`Current pending tournament winners: ${pendingCount}/40`);
          
          if (pendingCount >= 40) {
            console.log('Triggering battle royale from tournament winners...');
            const battleRoyale = await BattleRoyaleManager.createBattleRoyaleFromWinners();
            
            if (battleRoyale) {
              console.log(`Battle Royale created: ${battleRoyale.name} (${battleRoyale._id})`);
              
              // Get the winners who qualified for this battle royale
              const qualifiedWinners = await TournamentWinner.find({ 
                battleRoyaleId: battleRoyale._id,
                battleRoyaleStatus: 'QUALIFIED'
              });
              
              // Notify players about the battle royale event
              notifyBattleRoyaleEvent(battleRoyale, qualifiedWinners);
              
              // Broadcast battle royale creation to all players
              broadcastToAll({
                type: 'battleRoyaleCreated',
                battleRoyale: {
                  id: battleRoyale._id,
                  name: battleRoyale.name,
                  tier: battleRoyale.tier,
                  maxPlayers: 40,
                  playerCount: battleRoyale.participants.length,
                  status: battleRoyale.status
                }
              });
            }
          }
        } catch (err) {
          console.error('Error saving tournament to database:', err);
        }
      })();
    }
  }
  
  // Broadcast updated bracket to all players
  broadcastToAll({
    type: 'tournamentBracketUpdate',
    tournamentId,
    brackets: tournament.brackets
  });
  
  return true;
}

// Helper function to broadcast message to all clients
function broadcastToAll(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Helper function to broadcast message to all clients except the sender
function broadcastToOthers(senderId, message) {
  wss.clients.forEach((client) => {
    if (client !== players[senderId]?.ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  // Generate a unique client ID
  const clientId = uuidv4();
  console.log(`Client connected: ${clientId}`);
  
  // Initialize player data
  players[clientId] = {
    id: clientId,
    ws: ws,
    connected: true,
    lastSeen: Date.now()
  };
  
  // Send client ID to the client
  ws.send(JSON.stringify({
    type: 'id',
    id: clientId
  }));
  
  // Handle messages from client
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from ${clientId}:`, data.type);
      
      // Handle ping messages (for connection testing)
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      
      // Handle join messages
      if (data.type === 'join') {
        if (data.playerData) {
          console.log('Player joined with data:', data.playerData);
          
          // Initialize player properties if they don't exist
          if (!players[clientId]) {
            players[clientId] = {
              id: clientId,
              ws: ws,
              connected: true,
              lastSeen: Date.now()
            };
          }
          
          // Update player data
          players[clientId].username = data.playerData.username || `Player_${clientId.substring(0, 6)}`;
          players[clientId].characterClass = data.playerData.characterClass || 'clerk';
          players[clientId].position = data.playerData.position || { x: 0, y: 0, z: 0 };
          
          // If player has a tournament ID, update it
          if (data.playerData.tournamentId) {
            players[clientId].currentTournament = data.playerData.tournamentId;
            console.log(`Player ${clientId} joined with tournament ID: ${data.playerData.tournamentId}`);
          }
          
          // Initialize player stats if needed
          if (!players[clientId].stats) {
            // Get class stats
            const classStats = getClassStats(data.playerData.characterClass);
            
            players[clientId].stats = {
              health: classStats.health || 100,
              maxHealth: classStats.health || 100,
              damage: classStats.damage || 10,
              speed: classStats.speed || 10,
              attackSpeed: classStats.attackSpeed || 1.0,
              range: classStats.range || 5
            };
          }
          
          console.log(`Updated player ${clientId} data:`, {
            username: players[clientId].username,
            characterClass: players[clientId].characterClass,
            currentTournament: players[clientId].currentTournament
          });
          
          // Check for authentication data
          let dbPlayer = null;
          if (data.playerData.auth && data.playerData.auth.userId) {
            try {
              // Find the player in the database
              dbPlayer = await Player.findById(data.playerData.auth.userId);
              
              if (dbPlayer) {
                console.log(`Authenticated player joined: ${dbPlayer.username} (${dbPlayer._id})`);
                
                // Store database ID reference
                players[clientId].dbId = dbPlayer._id;
                
                // Update username from database if available
                if (dbPlayer.username) {
                  players[clientId].username = dbPlayer.username;
                }
              }
            } catch (dbError) {
              console.error('Error authenticating player from database:', dbError);
            }
          }
          
          // Send acknowledgment back to the client
          ws.send(JSON.stringify({
            type: 'joined',
            id: clientId,
            username: players[clientId].username,
            characterClass: players[clientId].characterClass,
            stats: players[clientId].stats,
            currentTournament: players[clientId].currentTournament
          }));
          
          // Broadcast to other players that a new player has joined
          broadcastToOthers(clientId, {
            type: 'playerJoined',
            id: clientId,
            username: players[clientId].username,
            characterClass: players[clientId].characterClass,
            position: players[clientId].position
          });
          
          // Send current players list to the new player
          const activePlayers = {};
          Object.keys(players).forEach(id => {
            if (id !== clientId && players[id].connected) {
              activePlayers[id] = {
                id: id,
                username: players[id].username,
                characterClass: players[id].characterClass,
                position: players[id].position || { x: 0, y: 0, z: 0 }
              };
            }
          });
          
          ws.send(JSON.stringify({
            type: 'playersList',
            players: activePlayers
          }));
          
          // Send active tournaments list to the new player
          const tournamentsList = Object.keys(activeTournaments)
            .filter(id => activeTournaments[id].status === 'WAITING')
            .map(id => ({
              tournamentId: id,
              name: activeTournaments[id].name,
              playerCount: activeTournaments[id].players.length,
              status: activeTournaments[id].status
            }));
          
          if (tournamentsList.length > 0) {
            console.log(`Sending ${tournamentsList.length} active tournaments to new player`);
            ws.send(JSON.stringify({
              type: 'activeTournaments',
              tournaments: tournamentsList
            }));
          }
        }
      }
      
      // Handle player movement
      else if (data.type === 'playerMove') {
        // Update player position
        if (players[clientId]) {
          players[clientId].position = data.position;
          players[clientId].lastSeen = Date.now();
          
          // Broadcast position to other players
          broadcastToOthers(clientId, {
            type: 'playerMoved',
            id: clientId,
            position: data.position
          });
        }
      }
      
      // Handle player attacks
      else if (data.type === 'playerAttack') {
        const { targetId, damage, attackType } = data;
        
        // Validate attack data
        if (!targetId || !players[targetId] || damage === undefined) {
          console.warn(`Invalid attack data from ${clientId}`);
          return;
        }
        
        console.log(`Player ${clientId} attacks ${targetId} for ${damage} damage`);
        
        // Broadcast attack to all players (including attacker for visual feedback)
        broadcastToAll({
          type: 'playerAttacked',
          id: clientId,
          targetId,
          damage,
          attackType
        });
        
        // Update target's health
        if (players[targetId] && players[targetId].stats) {
          const targetStats = players[targetId].stats;
          const newHealth = Math.max(0, targetStats.health - damage);
          targetStats.health = newHealth;
          
          // Broadcast health update
          broadcastToAll({
            type: 'playerHealth',
            id: targetId,
            health: newHealth,
            maxHealth: targetStats.maxHealth,
            damage,
            attackerId: clientId
          });
          
          // Try to update database stats
          try {
            if (mongoose.connection.readyState === 1) {
              // Update attacker's damage dealt
              if (players[clientId] && players[clientId].dbId) {
                await Player.findByIdAndUpdate(
                  players[clientId].dbId,
                  { $inc: { 'stats.damageDealt': damage } }
                );
              }
              
              // Check if target is defeated
              if (newHealth <= 0) {
                // Broadcast death
                broadcastToAll({
                  type: 'playerDeath',
                  id: targetId,
                  attackerId: clientId
                });
                
                // Update database stats
                if (players[clientId] && players[clientId].dbId) {
                  // Increment attacker's kills
                  await Player.findByIdAndUpdate(
                    players[clientId].dbId,
                    { 
                      $inc: { 
                        'stats.kills': 1,
                        score: 10 // Award points for kill
                      } 
                    }
                  );
                }
                
                if (players[targetId] && players[targetId].dbId) {
                  // Increment target's deaths
                  await Player.findByIdAndUpdate(
                    players[targetId].dbId,
                    { $inc: { 'stats.deaths': 1 } }
                  );
                }
              }
            }
          } catch (dbError) {
            console.error('Error updating player stats in database:', dbError);
          }
        }
      }
      
      // Handle player respawn
      else if (data.type === 'playerRespawn') {
        const { position, health, maxHealth } = data;
        
        // Update player data
        if (players[clientId]) {
          players[clientId].position = position;
          if (players[clientId].stats) {
            players[clientId].stats.health = health;
            players[clientId].stats.maxHealth = maxHealth;
          }
          
          // Broadcast respawn to all players
          broadcastToAll({
            type: 'playerRespawn',
            id: clientId,
            position,
            health,
            maxHealth
          });
        }
      }
      
      // Handle game completion (for tournament or battle royale)
      else if (data.type === 'gameComplete') {
        const { gameType, gameId, winnerId, playerResults } = data;
        
        // Try to update database with game results
        try {
          if (mongoose.connection.readyState === 1) {
            if (gameType === 'tournament' && gameId) {
              // Update tournament results
              const tournament = await Tournament.findById(gameId);
              if (tournament) {
                // Find the final match
                const finalRound = tournament.bracket[tournament.bracket.length - 1];
                if (finalRound && finalRound.matches.length > 0) {
                  const finalMatch = finalRound.matches[0];
                  
                  // Update match result
                  await tournament.updateMatchResult(finalMatch.matchId, players[winnerId].dbId);
                  console.log(`Tournament ${gameId} completed. Winner: ${winnerId}`);
                  
                  // Update player stats
                  if (players[winnerId] && players[winnerId].dbId) {
                    await Player.findByIdAndUpdate(
                      players[winnerId].dbId,
                      { 
                        $inc: { 
                          'stats.wins': 1,
                          'stats.gamesPlayed': 1,
                          score: 50 // Award points for tournament win
                        } 
                      }
                    );
                  }
                  
                  // Update loser stats
                  const loserId = finalMatch.player1Id.toString() === players[winnerId].dbId.toString() 
                    ? finalMatch.player2Id 
                    : finalMatch.player1Id;
                  
                  if (loserId) {
                    await Player.findByIdAndUpdate(
                      loserId,
                      { 
                        $inc: { 
                          'stats.losses': 1,
                          'stats.gamesPlayed': 1,
                          score: 10 // Award some points for second place
                        } 
                      }
                    );
                  }
                }
              }
            } 
            else if (gameType === 'battleRoyale' && gameId) {
              // Update battle royale results
              const battleRoyale = await BattleRoyale.findById(gameId);
              if (battleRoyale && battleRoyale.status === 'IN_PROGRESS') {
                // Set winner
                if (players[winnerId] && players[winnerId].dbId) {
                  const winner = await Player.findById(players[winnerId].dbId);
                  if (winner) {
                    battleRoyale.winner = {
                      playerId: winner._id,
                      username: winner.username,
                      characterClass: winner.characterClass,
                      kills: playerResults[winnerId]?.kills || 0
                    };
                    
                    // Update winner stats
                    await Player.findByIdAndUpdate(
                      winner._id,
                      { 
                        $inc: { 
                          'stats.wins': 1,
                          'stats.gamesPlayed': 1,
                          score: 100 // Award points for battle royale win
                        } 
                      }
                    );
                  }
                }
                
                // Update all player placements and stats
                if (playerResults) {
                  for (const [playerId, result] of Object.entries(playerResults)) {
                    const player = players[playerId];
                    if (player && player.dbId) {
                      // Find participant in battle royale
                      const participantIndex = battleRoyale.participants.findIndex(
                        p => p.playerId.toString() === player.dbId.toString()
                      );
                      
                      if (participantIndex !== -1) {
                        // Update participant data
                        battleRoyale.participants[participantIndex].placement = result.placement;
                        battleRoyale.participants[participantIndex].kills = result.kills;
                        battleRoyale.participants[participantIndex].damageDealt = result.damageDealt;
                        
                        // Update player stats in database
                        await Player.findByIdAndUpdate(
                          player.dbId,
                          { 
                            $inc: { 
                              'stats.kills': result.kills,
                              'stats.deaths': result.placement > 1 ? 1 : 0,
                              'stats.gamesPlayed': 1,
                              'stats.damageDealt': result.damageDealt,
                              // Award points based on placement
                              score: result.placement === 1 ? 100 : 
                                    result.placement <= 3 ? 50 :
                                    result.placement <= 10 ? 25 : 10
                            } 
                          }
                        );
                      }
                    }
                  }
                }
                
                // Mark battle royale as completed
                battleRoyale.status = 'COMPLETED';
                battleRoyale.endDate = new Date();
                await battleRoyale.save();
                
                console.log(`Battle Royale ${gameId} completed. Winner: ${winnerId}`);
              }
            }
          }
        } catch (dbError) {
          console.error('Error updating game results in database:', dbError);
        }
      }
      
      // Handle tournament creation
      else if (data.type === 'createTournament') {
        console.log('Create tournament request received:', data);
        
        // Verify player exists and is properly initialized
        if (!players[clientId]) {
          console.error(`Player ${clientId} tried to create a tournament but isn't properly initialized`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'You must join the game before creating a tournament'
          }));
          return;
        }
        
        // Create tournament ID
        const tournamentId = `tournament_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // Set up tournament data
        const tournament = {
          id: tournamentId,
          name: data.name || `Tournament ${tournamentId.substring(0, 6)}`,
          createdBy: clientId,
          createdAt: Date.now(),
          tier: data.tier || 'ALL',
          maxPlayers: 16,
          players: [{
            id: clientId,
            username: players[clientId].username,
            characterClass: players[clientId].characterClass
          }],
          status: 'WAITING', // WAITING, STARTING, IN_PROGRESS, COMPLETED
          matches: [],
          round: 0
        };
        
        // Store tournament
        activeTournaments[tournamentId] = tournament;
        
        console.log(`Tournament created: ${tournament.name} (${tournamentId})`);
        
        // Add the creator to the tournament players
        players[clientId].currentTournament = tournamentId;
        
        // Send confirmation to creator
        ws.send(JSON.stringify({
          type: 'tournamentCreated',
          tournament: {
            id: tournamentId,
            name: tournament.name,
            tier: tournament.tier,
            maxPlayers: tournament.maxPlayers,
            playerCount: tournament.players.length,
            status: tournament.status
          }
        }));
        
        // Broadcast tournament creation to all players
        broadcastToAll({
          type: 'newTournament',
          tournament: {
            id: tournamentId,
            name: tournament.name,
            tier: tournament.tier,
            maxPlayers: tournament.maxPlayers,
            playerCount: tournament.players.length,
            status: tournament.status
          }
        });
      }
      
      // Handle tournament join
      else if (data.type === 'joinTournament') {
        console.log(`Player ${clientId} requested to join tournament ${data.tournamentId}`);
        
        // Verify player exists and is properly initialized
        if (!players[clientId]) {
          console.error(`Player ${clientId} tried to join a tournament but isn't properly initialized`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'You must join the game before joining a tournament'
          }));
          return;
        }
        
        // Verify tournament exists
        if (!activeTournaments[data.tournamentId]) {
          console.error(`Tournament ${data.tournamentId} not found`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Tournament not found'
          }));
          return;
        }
        
        const tournament = activeTournaments[data.tournamentId];
        
        // Verify tournament is in WAITING status
        if (tournament.status !== 'WAITING') {
          console.error(`Tournament ${data.tournamentId} is not accepting new players (status: ${tournament.status})`);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Cannot join tournament with status: ${tournament.status}`
          }));
          return;
        }
        
        // Check if player is already in this tournament
        const existingPlayerIndex = tournament.players.findIndex(p => p.id === clientId);
        if (existingPlayerIndex >= 0) {
          console.log(`Player ${clientId} is already in tournament ${data.tournamentId}`);
          ws.send(JSON.stringify({
            type: 'tournamentJoined',
            tournament: {
              id: tournament.id,
              name: tournament.name,
              playerCount: tournament.players.length,
              players: tournament.players,
              status: tournament.status
            }
          }));
          return;
        }
        
        // Check if tournament is full
        if (tournament.players.length >= tournament.maxPlayers) {
          console.error(`Tournament ${data.tournamentId} is full`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Tournament is full'
          }));
          return;
        }
        
        // Add player to tournament
        tournament.players.push({
          id: clientId,
          username: players[clientId].username,
          characterClass: players[clientId].characterClass
        });
        
        // Update player's currentTournament field
        players[clientId].currentTournament = data.tournamentId;
        
        console.log(`Player ${clientId} joined tournament ${data.tournamentId}. Current player count: ${tournament.players.length}`);
        
        // Send confirmation to the player
        ws.send(JSON.stringify({
          type: 'tournamentJoined',
          tournament: {
            id: tournament.id,
            name: tournament.name,
            playerCount: tournament.players.length,
            players: tournament.players,
            status: tournament.status
          }
        }));
        
        // Broadcast updated player count to all players
        broadcastToAll({
          type: 'tournamentUpdated',
          tournament: {
            id: tournament.id,
            name: tournament.name,
            playerCount: tournament.players.length,
            status: tournament.status
          }
        });
      }
      
      // Handle tournament start
      else if (data.type === 'tournamentStart') {
        const { tournamentId } = data;
        const tournament = activeTournaments[tournamentId];
        
        if (!tournament) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Tournament not found'
          }));
          return;
        }
        
        // Only creator can start tournament
        if (tournament.createdBy !== clientId) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the tournament creator can start the tournament'
          }));
          return;
        }
        
        if (tournament.status !== 'WAITING') {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Tournament already started'
          }));
          return;
        }
        
        // Check if enough players
        if (!checkTournamentReady(tournamentId)) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Not enough players to start tournament'
          }));
          return;
        }
        
        // Create brackets
        tournament.brackets = createTournamentBrackets(tournamentId);
        tournament.status = 'IN_PROGRESS';
        tournament.currentRound = 1;
        
        console.log(`Tournament ${tournamentId} started with ${tournament.players.length} players`);
        
        // Broadcast tournament start to all players
        broadcastToAll({
          type: 'tournamentStarted',
          tournamentId,
          name: tournament.name,
          brackets: tournament.brackets
        });
        
        // Notify first round players to prepare for their matches
        const firstRound = tournament.brackets[0];
        firstRound.matches.forEach(match => {
          // Set match status to READY
          match.status = 'READY';
          
          // Notify players
          if (players[match.player1Id] && players[match.player1Id].ws) {
            players[match.player1Id].ws.send(JSON.stringify({
              type: 'tournamentMatchReady',
              tournamentId,
              matchId: match.matchId,
              opponent: {
                id: match.player2Id,
                name: match.player2Name
              }
            }));
          }
          
          if (players[match.player2Id] && players[match.player2Id].ws) {
            players[match.player2Id].ws.send(JSON.stringify({
              type: 'tournamentMatchReady',
              tournamentId,
              matchId: match.matchId,
              opponent: {
                id: match.player1Id,
                name: match.player1Name
              }
            }));
          }
        });
      }
      
      // Handle tournament match complete
      else if (data.type === 'tournamentMatchComplete') {
        const { tournamentId, matchId, winnerId } = data;
        const tournament = activeTournaments[tournamentId];
        
        if (!tournament) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Tournament not found'
          }));
          return;
        }
        
        // Update bracket
        const updated = updateTournamentBracket(tournamentId, matchId, winnerId);
        
        if (updated) {
          console.log(`Tournament ${tournamentId} match ${matchId} completed. Winner: ${winnerId}`);
          
          // Find the next match for the winner
          let nextMatchId = null;
          let nextOpponentId = null;
          let nextOpponentName = null;
          
          // Look for matches in the next round where the winner is a player
          for (let i = 1; i < tournament.brackets.length; i++) {
            const round = tournament.brackets[i];
            for (const match of round.matches) {
              if ((match.player1Id === winnerId || match.player2Id === winnerId) && match.status === 'READY') {
                nextMatchId = match.matchId;
                nextOpponentId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
                nextOpponentName = match.player1Id === winnerId ? match.player2Name : match.player1Name;
                break;
              }
            }
            if (nextMatchId) break;
          }
          
          // If there's a next match, notify the winner
          if (nextMatchId && players[winnerId] && players[winnerId].ws) {
            players[winnerId].ws.send(JSON.stringify({
              type: 'tournamentMatchReady',
              tournamentId,
              matchId: nextMatchId,
              opponent: {
                id: nextOpponentId,
                name: nextOpponentName
              }
            }));
          }
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to update tournament bracket'
          }));
        }
      }
      
      // Handle tournament bracket request
      else if (data.type === 'tournamentBracketRequest') {
        const { tournamentId } = data;
        const tournament = activeTournaments[tournamentId];
        
        if (!tournament) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Tournament not found'
          }));
          return;
        }
        
        // Send bracket to requesting player
        ws.send(JSON.stringify({
          type: 'tournamentBracket',
          tournamentId,
          name: tournament.name,
          status: tournament.status,
          brackets: tournament.brackets,
          winner: tournament.winner
        }));
      }
      
      // Handle battle royale join request
      else if (data.type === 'joinBattleRoyale') {
        const { battleRoyaleId } = data;
        const playerId = clientId;
        
        console.log(`Player ${playerId} is joining battle royale ${battleRoyaleId}`);
        
        try {
          // Add player to battle royale
          const battleRoyale = await BattleRoyale.findById(battleRoyaleId);
          
          if (!battleRoyale) {
            console.error(`Battle royale ${battleRoyaleId} not found`);
            ws.send(JSON.stringify({
              type: 'error',
              data: {
                message: 'Battle royale not found'
              }
            }));
            return;
          }
          
          // Check if player is already in the battle royale
          if (battleRoyale.participants.includes(playerId)) {
            console.log(`Player ${playerId} is already in battle royale ${battleRoyaleId}`);
            ws.send(JSON.stringify({
              type: 'battleRoyaleJoined',
              data: battleRoyale
            }));
            return;
          }
          
          // Add player to battle royale
          battleRoyale.participants.push(playerId);
          await battleRoyale.save();
          
          // Notify player they've joined
          ws.send(JSON.stringify({
            type: 'battleRoyaleJoined',
            data: battleRoyale
          }));
          
          // Notify all clients about updated participant count
          broadcastToAll({
            type: 'battleRoyaleUpdated',
            data: {
              battleRoyaleId: battleRoyale._id,
              participantCount: battleRoyale.participants.length
            }
          });
          
          console.log(`Player ${playerId} joined battle royale ${battleRoyaleId}`);
          
          // Check if battle royale is full and should start
          if (battleRoyale.participants.length >= battleRoyale.maxParticipants) {
            console.log(`Battle royale ${battleRoyaleId} is full, starting...`);
            
            // Start the battle royale
            battleRoyale.status = 'in-progress';
            battleRoyale.startTime = new Date();
            await battleRoyale.save();
            
            // Notify all clients that battle royale has started
            broadcastToAll({
              type: 'battleRoyaleStarted',
              data: battleRoyale
            });
          }
        } catch (error) {
          console.error('Error joining battle royale:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: {
              message: 'Failed to join battle royale'
            }
          }));
        }
      }
      
      // Handle tournament completion
      else if (data.type === 'tournamentCompleted') {
        console.log('Tournament completed:', data.tournamentId);
        
        try {
          // Find the tournament
          const tournament = await Tournament.findById(data.tournamentId);
          
          if (!tournament) {
            console.error(`Tournament ${data.tournamentId} not found`);
            return;
          }
          
          // Update tournament status
          tournament.status = 'completed';
          tournament.completedAt = new Date();
          await tournament.save();
          
          // Handle tournament completion (save winner, check for battle royale, etc.)
          await handleTournamentCompletion(tournament);
          
          // Broadcast tournament completion to all clients
          broadcastToAll({
            type: 'tournamentUpdated',
            data: {
              tournamentId: tournament._id,
              status: 'completed',
              winner: data.winner
            }
          });
        } catch (error) {
          console.error('Error handling tournament completion:', error);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('Client disconnected:', clientId);
    
    // Notify all clients about the disconnection
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'playerLeft',
          id: clientId
        }));
      }
    });
    
    // Remove the player from our store
    delete players[clientId];
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  
  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed');
    
    // Close HTTP server
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});

// Helper function to calculate distance between two points
function calculateDistance(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Notify all clients about a battle royale event
 * @param {Object} battleRoyale - The battle royale event data
 */
function notifyBattleRoyaleEvent(battleRoyale) {
  console.log('Notifying all clients about battle royale event:', battleRoyale._id);
  
  broadcastToAll({
    type: 'battleRoyaleEvent',
    data: {
      battleRoyaleId: battleRoyale._id,
      name: battleRoyale.name,
      tier: battleRoyale.tier,
      playerCount: battleRoyale.participants.length,
      maxPlayers: battleRoyale.maxParticipants,
      startTime: battleRoyale.startTime
    }
  });
}

/**
 * Notify tournament winners about a battle royale invitation
 * @param {Object} battleRoyale - The battle royale event data
 * @param {Array} winners - Array of tournament winner IDs
 */
function notifyBattleRoyaleInvitation(battleRoyale, winners) {
  console.log(`Notifying ${winners.length} tournament winners about battle royale invitation`);
  
  winners.forEach(winnerId => {
    const socket = wss.clients.find(c => c.id === winnerId);
    
    if (socket) {
      socket.send(JSON.stringify({
        type: 'battleRoyaleInvitation',
        data: {
          battleRoyaleId: battleRoyale._id,
          message: 'You have been invited to join the Battle Royale as a tournament winner!',
          name: battleRoyale.name,
          tier: battleRoyale.tier,
          startTime: battleRoyale.startTime
        }
      }));
    }
  });
}

/**
 * Handle tournament completion
 * @param {Object} tournament - The completed tournament
 */
async function handleTournamentCompletion(tournament) {
  console.log(`Tournament ${tournament._id} completed`);
  
  try {
    // Get the winner
    const winner = tournament.participants.find(p => p.position === 1);
    
    if (!winner) {
      console.error(`No winner found for tournament ${tournament._id}`);
      return;
    }
    
    console.log(`Tournament winner: ${winner.playerId}`);
    
    // Save winner to TournamentWinner collection
    const tournamentWinner = new TournamentWinner({
      playerId: winner.playerId,
      tournamentId: tournament._id,
      tier: tournament.tier,
      timestamp: new Date(),
      processed: false
    });
    
    await tournamentWinner.save();
    console.log(`Saved tournament winner to database: ${tournamentWinner._id}`);
    
    // Check if we have enough winners to trigger a battle royale
    const pendingWinners = await TournamentWinner.find({ processed: false });
    console.log(`Current pending tournament winners: ${pendingWinners.length}`);
    
    // If we have 40 winners, trigger a battle royale
    if (pendingWinners.length >= 40) {
      console.log('We have 40 tournament winners. Triggering battle royale event!');
      
      // Create a new battle royale
      const battleRoyale = new BattleRoyale({
        name: 'Tournament Champions Battle Royale',
        tier: 'champions',
        status: 'pending',
        maxParticipants: 40,
        participants: [],
        startTime: new Date(Date.now() + (15 * 60 * 1000)), // Start in 15 minutes
        createdAt: new Date()
      });
      
      await battleRoyale.save();
      console.log(`Created battle royale: ${battleRoyale._id}`);
      
      // Mark winners as processed
      const winnerIds = pendingWinners.map(w => w.playerId);
      await TournamentWinner.updateMany(
        { _id: { $in: pendingWinners.map(w => w._id) } },
        { $set: { processed: true, battleRoyaleId: battleRoyale._id } }
      );
      
      // Notify all players about the battle royale event
      notifyBattleRoyaleEvent(battleRoyale);
      
      // Send special invitations to the tournament winners
      notifyBattleRoyaleInvitation(battleRoyale, winnerIds);
    }
    
    // Update player stats
    // ... existing code to update player stats ...
    
  } catch (error) {
    console.error('Error handling tournament completion:', error);
  }
}