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
        console.log(`==== ATTACK REQUEST from ${clientId} ====`);
        console.log(`Attack details:`, JSON.stringify(data, null, 2));
        
        // Generate a unique attack ID for tracking
        const attackId = data.attackId || uuidv4();
        
        // Get attacker and target player data
        const attacker = players[clientId];
        const target = players[data.targetId];
        
        // Validate that both players exist
        if (!attacker || !target) {
          console.log(`Attack invalid: player(s) not found. Attacker: ${!!attacker}, Target: ${!!target}`);
          if (attacker) {
            console.log(`Known players: ${Object.keys(players).join(', ')}`);
            
            // Send attack missed event back to attacker
            ws.send(JSON.stringify({
              type: 'playerAttackMissed',
              id: clientId,
              targetId: data.targetId,
              attackId: attackId,
              reason: 'target_not_found',
              message: 'Target player not found'
            }));
          }
          return;
        }
        
        // Validate that attacker and target have position data
        if (!attacker.position || !target.position) {
          console.log(`Attack invalid: missing position data. Attacker pos: ${!!attacker.position}, Target pos: ${!!target.position}`);
          
          // Send attack missed event back to attacker
          ws.send(JSON.stringify({
            type: 'playerAttackMissed',
            id: clientId,
            targetId: data.targetId,
            attackId: attackId,
            reason: 'missing_position_data',
            message: 'Missing position data'
          }));
          return;
        }
        
        // Calculate distance between players
        const distance = calculateDistance(attacker.position, target.position);
        
        // Get range based on attacker class and attack type
        const attackerClass = attacker.class || 'WARRIOR';
        let attackRange = 2; // Default range
        
        // Determine range based on class (these values should match client-side range settings)
        if (attackerClass === 'CLERK') {
          attackRange = 8; // Magic bolts have long range
        } else if (attackerClass === 'WARRIOR') {
          attackRange = 2; // Melee attacks have short range
        } else if (attackerClass === 'RANGER') {
          attackRange = 10; // Arrows have the longest range
        }
        
        // Log attack attempt with detailed position data
        console.log(`Attack validation - ID: ${attackId}, Distance: ${distance.toFixed(2)}, Range: ${attackRange}`);
        console.log(`  Attacker: ${attackerClass} at position (${attacker.position.x.toFixed(2)}, ${attacker.position.y.toFixed(2)}, ${attacker.position.z.toFixed(2)})`);
        console.log(`  Target: at position (${target.position.x.toFixed(2)}, ${target.position.y.toFixed(2)}, ${target.position.z.toFixed(2)})`);
        
        // Check if target is in range
        if (distance <= attackRange) {
          console.log(`Attack in range (${distance.toFixed(2)} <= ${attackRange}), processing damage`);
          console.log(`Broadcasting playerAttacked event with inRange=true`);
          
          // Update target health
          const damage = data.damage || 10; // Default damage if not specified
          const oldHealth = target.health || 100;
          const maxHealth = target.stats?.health || 100;
          
          // Calculate new health
          target.health = Math.max(0, oldHealth - damage);
          
          console.log(`Target health: ${oldHealth} -> ${target.health} (${damage} damage)`);
          
          // Broadcast attack to all players
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'playerAttacked',
                id: clientId,
                targetId: data.targetId,
                damage: damage,
                attackType: data.attackType || 'primary',
                attackId: attackId, // Include attack ID for tracking
                inRange: true, // Explicitly indicate this was in range
                distance: distance
              }));
            }
          });
          
          // Also send specific health update
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'playerHealth',
                id: data.targetId,
                health: target.health,
                maxHealth: maxHealth,
                damage: damage,
                attackerId: clientId
              }));
            }
          });
          
          // Check if target died
          if (target.health <= 0) {
            console.log(`Player ${data.targetId} died from attack by ${clientId}`);
            
            // Broadcast death event
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'playerDeath',
                  id: data.targetId,
                  attackerId: clientId
                }));
              }
            });
            
            // Respawn player after delay
            setTimeout(() => {
              // Only respawn if player is still connected
              if (players[data.targetId]) {
                // Generate random respawn position
                const respawnPosition = {
                  x: Math.random() * 20 - 10,
                  y: 0.8,
                  z: Math.random() * 20 - 10
                };
                
                // Update player position and health
                players[data.targetId].position = respawnPosition;
                players[data.targetId].health = maxHealth;
                
                console.log(`Player ${data.targetId} respawned at position:`, respawnPosition);
                
                // Broadcast respawn event
                wss.clients.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                      type: 'playerRespawn',
                      id: data.targetId,
                      position: respawnPosition,
                      health: maxHealth,
                      maxHealth: maxHealth
                    }));
                  }
                });
              }
            }, 3000); // 3 second respawn delay
          }
        } else {
          console.log(`Attack out of range (${distance.toFixed(2)} > ${attackRange}), sending miss event`);
          console.log(`Broadcasting playerAttackMissed event`);
          
          // Broadcast attack missed to all players
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'playerAttackMissed',
                id: clientId,
                targetId: data.targetId,
                attackId: attackId,
                distance: distance,
                maxRange: attackRange,
                reason: 'out_of_range',
                message: `Target out of range (${distance.toFixed(1)} > ${attackRange})`
              }));
            }
          });
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
      else {
        console.log(`Unknown message type: ${data.type}`);
      }
    } catch (err) {
      console.error('Error processing message:', err);
      console.error('Raw message:', message.toString());
      
      // Send error response
      try {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          details: err.message
        }));
      } catch (sendError) {
        console.error('Error sending error response:', sendError);
      }
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

// Helper function to calculate distance between two 3D points
function calculateDistance(posA, posB) {
  const dx = posA.x - posB.x;
  const dy = posA.y - posB.y;
  const dz = posA.z - posB.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}