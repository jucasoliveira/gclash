const mongoose = require('mongoose');

/**
 * BattleRoyale Schema
 * Stores battle royale match information, participants, and results
 */
const battleRoyaleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  tier: {
    type: String,
    enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'ALL'],
    default: 'ALL'
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
    default: 'PENDING'
  },
  participants: [{
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    username: String,
    characterClass: String,
    isAlive: {
      type: Boolean,
      default: true
    },
    placement: {
      type: Number,
      default: null
    },
    kills: {
      type: Number,
      default: 0
    },
    damageDealt: {
      type: Number,
      default: 0
    }
  }],
  winner: {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null
    },
    username: String,
    characterClass: String,
    kills: Number
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  mapSize: {
    type: Number,
    default: 1000 // Size in game units
  },
  safeZoneStages: [{
    radius: Number,
    duration: Number, // Duration in seconds
    damagePerSecond: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: true
});

// Method to start battle royale
battleRoyaleSchema.methods.start = function() {
  if (this.status !== 'PENDING' || this.participants.length < 2) {
    return false;
  }
  
  // Set default safe zone stages if not defined
  if (!this.safeZoneStages || this.safeZoneStages.length === 0) {
    this.safeZoneStages = [
      { radius: 800, duration: 120, damagePerSecond: 1 },
      { radius: 600, duration: 120, damagePerSecond: 2 },
      { radius: 400, duration: 90, damagePerSecond: 3 },
      { radius: 200, duration: 60, damagePerSecond: 5 },
      { radius: 100, duration: 60, damagePerSecond: 10 }
    ];
  }
  
  this.status = 'IN_PROGRESS';
  this.startDate = new Date();
  
  return this.save();
};

// Method to record player elimination
battleRoyaleSchema.methods.eliminatePlayer = function(playerId, eliminatorId = null) {
  // Find the player in participants
  const playerIndex = this.participants.findIndex(p => 
    p.playerId.toString() === playerId.toString()
  );
  
  if (playerIndex === -1 || !this.participants[playerIndex].isAlive) {
    return false;
  }
  
  // Mark player as eliminated
  this.participants[playerIndex].isAlive = false;
  
  // Calculate placement (number of players still alive + 1)
  const alivePlayers = this.participants.filter(p => p.isAlive).length;
  this.participants[playerIndex].placement = alivePlayers + 1;
  
  // If eliminator exists, increment their kill count
  if (eliminatorId) {
    const eliminatorIndex = this.participants.findIndex(p => 
      p.playerId.toString() === eliminatorId.toString()
    );
    
    if (eliminatorIndex !== -1) {
      this.participants[eliminatorIndex].kills += 1;
    }
  }
  
  // Check if only one player remains
  if (alivePlayers === 1) {
    // Get the winner
    const winner = this.participants.find(p => p.isAlive);
    
    // Set battle royale as completed
    this.status = 'COMPLETED';
    this.endDate = new Date();
    
    // Set winner information
    this.winner = {
      playerId: winner.playerId,
      username: winner.username,
      characterClass: winner.characterClass,
      kills: winner.kills
    };
  }
  
  return this.save();
};

// Method to update player damage
battleRoyaleSchema.methods.updatePlayerDamage = function(playerId, damage) {
  const playerIndex = this.participants.findIndex(p => 
    p.playerId.toString() === playerId.toString()
  );
  
  if (playerIndex === -1) {
    return false;
  }
  
  this.participants[playerIndex].damageDealt += damage;
  
  return this.save();
};

// Static method to get active battle royale matches
battleRoyaleSchema.statics.getActiveMatches = function() {
  return this.find({ status: 'IN_PROGRESS' })
    .select('name tier participants startDate');
};

const BattleRoyale = mongoose.model('BattleRoyale', battleRoyaleSchema);

module.exports = BattleRoyale; 