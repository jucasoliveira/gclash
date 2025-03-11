const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Player Schema
 * Stores player information, character class, and game statistics
 */
const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true,
    match: [/.+\@.+\..+/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false // Don't include password in query results by default
  },
  salt: {
    type: String,
    select: false // Don't include salt in query results by default
  },
  characterClass: {
    type: String,
    required: true,
    enum: ['CLERK', 'WARRIOR', 'RANGER'],
    default: 'CLERK'
  },
  score: {
    type: Number,
    default: 0
  },
  tier: {
    type: String,
    enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'],
    default: 'BRONZE'
  },
  stats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    damageDealt: { type: Number, default: 0 },
    healingDone: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 }
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: true
});

// Virtual for win rate calculation
playerSchema.virtual('winRate').get(function() {
  if (this.stats.gamesPlayed === 0) return 0;
  return (this.stats.wins / this.stats.gamesPlayed * 100).toFixed(2);
});

// Virtual for KD ratio calculation
playerSchema.virtual('kdRatio').get(function() {
  if (this.stats.deaths === 0) return this.stats.kills;
  return (this.stats.kills / this.stats.deaths).toFixed(2);
});

// Method to update player score
playerSchema.methods.updateScore = function(points) {
  this.score += points;
  
  // Update tier based on score
  if (this.score >= 5000) {
    this.tier = 'DIAMOND';
  } else if (this.score >= 2500) {
    this.tier = 'PLATINUM';
  } else if (this.score >= 1000) {
    this.tier = 'GOLD';
  } else if (this.score >= 500) {
    this.tier = 'SILVER';
  } else {
    this.tier = 'BRONZE';
  }
  
  return this.save();
};

// Authentication methods
playerSchema.methods.setPassword = function(password) {
  this.salt = crypto.randomBytes(16).toString('hex');
  this.password = crypto
    .pbkdf2Sync(password, this.salt, 1000, 64, 'sha512')
    .toString('hex');
};

playerSchema.methods.validatePassword = function(password) {
  const hash = crypto
    .pbkdf2Sync(password, this.salt, 1000, 64, 'sha512')
    .toString('hex');
  return this.password === hash;
};

// Static method to get top players
playerSchema.statics.getLeaderboard = function(limit = 10) {
  return this.find()
    .sort({ score: -1 })
    .limit(limit)
    .select('username characterClass score tier stats');
};

const Player = mongoose.model('Player', playerSchema);

module.exports = Player; 