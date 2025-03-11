// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import models
const { Player, Tournament, BattleRoyale } = require('./models');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guildclash';
const NODE_ENV = process.env.NODE_ENV || 'development';

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

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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
      console.log('Received message:', data.type);
      
      // Handle ping messages (for connection testing)
      if (data.type === 'ping') {
        console.log(`Ping received from ${clientId}`);
        
        // Send pong response
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
          originalTimestamp: data.timestamp
        }));
        
        return;
      }
      
      // Update player data if this is a join message
      if (data.type === 'join') {
        if (data.playerData) {
          console.log('Player joined with data:', data.playerData);
          
          // Store player data with the WebSocket connection
          players[clientId] = {
            ...players[clientId],
            ...data.playerData,
            ws: ws,
            lastSeen: Date.now()
          };
          
          // Try to save player data to database if MongoDB is connected
          try {
            if (mongoose.connection.readyState === 1) { // 1 = connected
              const { username, class: characterClass } = data.playerData;
              
              // Check if player already exists
              let player = await Player.findOne({ username });
              
              if (!player) {
                // Create new player
                player = new Player({
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
                
                await player.save();
                console.log(`Created new player in database: ${username}`);
              } else {
                // Update last active timestamp
                player.lastActive = Date.now();
                await player.save();
                console.log(`Updated existing player in database: ${username}`);
              }
              
              // Store player database ID with connection
              players[clientId].dbId = player._id;
            }
          } catch (dbError) {
            console.error('Error saving player to database:', dbError);
            // Continue without database integration if there's an error
          }
          
          // Get existing players to send to the new player
          const existingPlayers = Object.entries(players)
            .filter(([id]) => id !== clientId)
            .map(([id, player]) => ({
              id,
              position: player.position,
              class: player.class,
              stats: player.stats,
              type: player.type
            }));
            
          console.log(`Sending ${existingPlayers.length} existing players to new player`);
          
          // Send existing players to the new player
          ws.send(JSON.stringify({
            type: 'existingPlayers',
            players: existingPlayers
          }));
          
          // Notify all other clients about the new player
          broadcastToOthers(clientId, {
            type: 'newPlayer',
            id: clientId,
            position: data.playerData.position,
            class: data.playerData.class,
            stats: data.playerData.stats,
            type: data.playerData.type
          });
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
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Send error back to client
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