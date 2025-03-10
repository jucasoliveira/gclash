const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001'], // Vite dev server
    methods: ['GET', 'POST'],
    credentials: true
  }
});

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
  if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Store active players
const players = {};

// Socket.io event handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Handle player joining
  socket.on('playerJoin', (playerData) => {
    console.log('Player joined:', playerData);
    
    // Add player to active players
    players[socket.id] = {
      id: socket.id,
      position: playerData.position,
      type: playerData.type,
      class: playerData.class,
      stats: playerData.stats,
      health: playerData.stats?.health || 100
    };
    
    // Notify the new player about all existing players
    socket.emit('existingPlayers', Object.values(players).filter(p => p.id !== socket.id));
    
    // Notify all other players about the new player
    socket.broadcast.emit('playerJoined', players[socket.id]);
  });
  
  // Handle player movement
  socket.on('playerMove', (moveData) => {
    // Update player position in our store
    if (players[socket.id]) {
      players[socket.id].position = moveData.position;
    }
    
    // Broadcast to other players
    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      ...moveData
    });
  });
  
  // Handle player attacks
  socket.on('playerAttack', (attackData) => {
    // Broadcast attack to all players (both viewers and the target)
    // This notifies everyone that an attack is happening
    io.emit('playerAttacked', {
      id: socket.id,
      ...attackData
    });
    
    // Log attack
    console.log(`Player ${socket.id} attacked player ${attackData.targetId} for ${attackData.damage} damage`);
    
    // Update target player's health in server state if we're tracking it
    if (players[attackData.targetId]) {
      const targetPlayer = players[attackData.targetId];
      
      // Initialize health if not present
      if (targetPlayer.health === undefined && targetPlayer.stats && targetPlayer.stats.health) {
        targetPlayer.health = targetPlayer.stats.health;
      }
      
      // Update health if we can
      if (targetPlayer.health !== undefined) {
        const oldHealth = targetPlayer.health;
        targetPlayer.health = Math.max(0, targetPlayer.health - attackData.damage);
        console.log(`Player ${attackData.targetId} health updated to ${targetPlayer.health}`);
        
        // Create health change event data
        const healthChangeData = {
          id: attackData.targetId,
          health: targetPlayer.health,
          maxHealth: targetPlayer.stats?.health || 100,
          damage: attackData.damage,
          attackerId: socket.id
        };
        
        // Explicitly emit to the target player first to ensure they get the update
        if (io.sockets.sockets.get(attackData.targetId)) {
          io.to(attackData.targetId).emit('playerHealthChanged', healthChangeData);
          console.log(`Health change sent directly to target player ${attackData.targetId}`);
        }
        
        // Then broadcast to everyone else, including the attacker
        io.emit('playerHealthChanged', healthChangeData);
        
        // If player died, broadcast death event
        if (oldHealth > 0 && targetPlayer.health <= 0) {
          // Create death event data
          const deathEventData = {
            id: attackData.targetId,
            attackerId: socket.id
          };
          
          // First emit directly to the player who died
          if (io.sockets.sockets.get(attackData.targetId)) {
            io.to(attackData.targetId).emit('playerDied', deathEventData);
            console.log(`Death event sent directly to player ${attackData.targetId}`);
          }
          
          // Then broadcast to everyone
          io.emit('playerDied', deathEventData);
        }
      }
    }
  });
  
  // Handle player health changes
  socket.on('playerHealthChange', (healthData) => {
    // Update player health in server state
    if (players[socket.id]) {
      players[socket.id].health = healthData.health;
    }
    
    // Broadcast to other players
    socket.broadcast.emit('playerHealthChanged', {
      id: socket.id,
      ...healthData
    });
    
    console.log(`Player ${socket.id} health changed to ${healthData.health}`);
  });
  
  // Handle player death
  socket.on('playerDeath', (deathData) => {
    // Broadcast to other players
    socket.broadcast.emit('playerDied', {
      id: socket.id,
      ...deathData
    });
    
    console.log(`Player ${socket.id} died`);
  });
  
  // Handle player respawn
  socket.on('playerRespawn', (respawnData) => {
    console.log(`Received respawn from player ${socket.id}:`, respawnData);
    
    // Update player position and health in server state
    if (players[socket.id]) {
      if (respawnData.position) {
        players[socket.id].position = respawnData.position;
      }
      if (respawnData.health) {
        players[socket.id].health = respawnData.health;
      } else if (players[socket.id].stats && players[socket.id].stats.health) {
        // Default to full health if not specified
        players[socket.id].health = players[socket.id].stats.health;
      }
      
      console.log(`Updated server state for player ${socket.id}: health=${players[socket.id].health}, position=${JSON.stringify(players[socket.id].position)}`);
    }
    
    // Create respawn data to ensure it contains all necessary fields
    const fullRespawnData = {
      id: socket.id,
      position: respawnData.position || players[socket.id]?.position || { x: 0, y: 0.8, z: 0 },
      health: respawnData.health || players[socket.id]?.health || 100,
      maxHealth: players[socket.id]?.stats?.health || 100
    };
    
    // Broadcast to ALL players including the sender to ensure consistent state
    io.emit('playerRespawned', fullRespawnData);
    
    console.log(`Player ${socket.id} respawned with health ${fullRespawnData.health} at position ${JSON.stringify(fullRespawnData.position)}`);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove player from active players
    if (players[socket.id]) {
      // Notify all other players about this disconnection
      socket.broadcast.emit('playerLeft', { id: socket.id });
      delete players[socket.id];
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  
  // Check if MongoDB is connected
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});