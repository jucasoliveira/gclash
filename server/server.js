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
      stats: playerData.stats
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