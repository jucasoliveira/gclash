const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guildclash';

// Connect to MongoDB (optional for development)
const connectMongoDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
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

// WebSocket event handling
wss.on('connection', (ws) => {
  // Assign a unique ID to this connection
  const clientId = uuidv4();
  console.log('A user connected:', clientId);
  
  // Send the client their ID
  ws.send(JSON.stringify({
    type: 'id',
    id: clientId
  }));
  
  // Notify all existing clients about the new player
  wss.clients.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'newPlayer',
        id: clientId
      }));
    }
  });
  
  // Store player data
  players[clientId] = {
    id: clientId,
    ws: ws,
    lastSeen: Date.now()
  };
  
  // Handle messages from clients
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data.type);
      
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
          const newPlayerData = {
            id: clientId,
            position: data.playerData.position,
            class: data.playerData.class,
            stats: data.playerData.stats,
            type: data.playerData.type
          };
          
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'playerJoined',
                player: newPlayerData
              }));
            }
          });
        }
      }
      // Handle player movement
      else if (data.type === 'playerMove') {
        // Update player position in our store
        if (players[clientId]) {
          players[clientId].position = data.position;
        }
        
        // Broadcast to other players
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'playerMoved',
              id: clientId,
              position: data.position
            }));
          }
        });
      }
      // Handle player attacks
      else if (data.type === 'playerAttack') {
        console.log(`Player ${clientId} attacked player ${data.targetId} for ${data.damage} damage`);
        
        // Broadcast attack to all players
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'playerAttacked',
              id: clientId,
              targetId: data.targetId,
              damage: data.damage,
              attackType: data.attackType
            }));
          }
        });
        
        // Update target player's health in server state
        if (players[data.targetId]) {
          const targetPlayer = players[data.targetId];
          
          // Initialize health if not present
          if (targetPlayer.health === undefined && targetPlayer.stats && targetPlayer.stats.health) {
            targetPlayer.health = targetPlayer.stats.health;
          }
          
          // Update health
          if (targetPlayer.health !== undefined) {
            const oldHealth = targetPlayer.health;
            targetPlayer.health = Math.max(0, targetPlayer.health - data.damage);
            console.log(`Player ${data.targetId} health updated to ${targetPlayer.health}`);
            
            // Create health change event data
            const healthChangeData = {
              id: data.targetId,
              health: targetPlayer.health,
              maxHealth: targetPlayer.stats?.health || 100,
              damage: data.damage,
              attackerId: clientId
            };
            
            // Broadcast health change to all players
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'playerHealthChanged',
                  ...healthChangeData
                }));
              }
            });
            
            // If player died, broadcast death event
            if (oldHealth > 0 && targetPlayer.health <= 0) {
              // Create death event data
              const deathEventData = {
                id: data.targetId,
                attackerId: clientId
              };
              
              // Broadcast to all players
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'playerDied',
                    ...deathEventData
                  }));
                }
              });
            }
          }
        }
      }
      // Handle player health changes
      else if (data.type === 'playerHealthChange') {
        // Update player health in server state
        if (players[clientId]) {
          players[clientId].health = data.health;
        }
        
        // Broadcast to other players
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'playerHealthChanged',
              id: clientId,
              health: data.health,
              maxHealth: data.maxHealth,
              damage: data.damage
            }));
          }
        });
      }
      // Handle player death
      else if (data.type === 'playerDeath') {
        // Broadcast to other players
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'playerDied',
              id: clientId,
              attackerId: data.attackerId
            }));
          }
        });
      }
      // Handle player respawn
      else if (data.type === 'playerRespawn') {
        console.log(`Player ${clientId} respawned`);
        
        // Update player position and health in server state
        if (players[clientId]) {
          if (data.position) {
            players[clientId].position = data.position;
          }
          if (data.health) {
            players[clientId].health = data.health;
          } else if (players[clientId].stats && players[clientId].stats.health) {
            // Default to full health if not specified
            players[clientId].health = players[clientId].stats.health;
          }
        }
        
        // Create respawn data
        const respawnData = {
          id: clientId,
          position: data.position,
          health: data.health || players[clientId]?.health || 100,
          maxHealth: players[clientId]?.stats?.health || 100
        };
        
        // Broadcast to all players
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'playerRespawned',
              ...respawnData
            }));
          }
        });
      }
      // Handle WebRTC signaling (for backward compatibility)
      else if (data.type === 'signal' && data.to) {
        console.log(`Ignoring WebRTC signal from ${clientId} to ${data.to}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
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