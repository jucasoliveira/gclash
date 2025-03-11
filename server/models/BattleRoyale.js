const mongoose = require('mongoose');

/**
 * BattleRoyale Schema
 * Stores information about battle royale events
 */
const battleRoyaleSchema = new mongoose.Schema({
  // Name of the battle royale event
  name: {
    type: String,
    required: true
  },
  
  // Tier of the battle royale
  tier: {
    type: String,
    required: true,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champions']
  },
  
  // Status of the battle royale
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  
  // Maximum number of participants
  maxParticipants: {
    type: Number,
    required: true,
    default: 40
  },
  
  // Array of participant IDs
  participants: [{
    type: String
  }],
  
  // Scheduled start time
  startTime: {
    type: Date,
    required: true
  },
  
  // When the battle royale was created
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // When the battle royale ended (if completed)
  endedAt: {
    type: Date
  },
  
  // Winner of the battle royale (if completed)
  winnerId: {
    type: String
  },
  
  // Results of the battle royale (top 10 placements)
  results: [{
    playerId: String,
    position: Number,
    kills: Number
  }]
});

// Create indexes for faster queries
battleRoyaleSchema.index({ status: 1 });
battleRoyaleSchema.index({ tier: 1 });
battleRoyaleSchema.index({ startTime: 1 });

const BattleRoyale = mongoose.model('BattleRoyale', battleRoyaleSchema);

module.exports = BattleRoyale; 