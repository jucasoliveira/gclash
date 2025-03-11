const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Character Schema
 * Represents a playable character with class, level, and equipment
 */
const characterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  characterClass: {
    type: String,
    required: true,
    enum: ['CLERK', 'WARRIOR', 'RANGER'],
    default: 'CLERK'
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  experience: {
    type: Number,
    default: 0
  },
  equipment: {
    weapon: {
      type: String,
      default: null
    },
    armor: {
      type: String,
      default: null
    },
    accessory: {
      type: String,
      default: null
    }
  },
  items: [{
    name: String,
    type: String,
    rarity: String,
    stats: mongoose.Schema.Types.Mixed
  }],
  stats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    damageDealt: { type: Number, default: 0 },
    healingDone: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

// Virtual for character win rate calculation
characterSchema.virtual('winRate').get(function() {
  if (this.stats.gamesPlayed === 0) return 0;
  return (this.stats.wins / this.stats.gamesPlayed * 100).toFixed(2);
});

// Virtual for character KD ratio calculation
characterSchema.virtual('kdRatio').get(function() {
  if (this.stats.deaths === 0) return this.stats.kills;
  return (this.stats.kills / this.stats.deaths).toFixed(2);
});

/**
 * Player Schema
 * Stores user account information and owns multiple characters
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
  characters: [characterSchema],
  activeCharacterId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
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

// Method to update player score and tier based on character performance
playerSchema.methods.updateScore = function() {
  // Calculate total score based on all characters
  let totalScore = 0;
  this.characters.forEach(character => {
    totalScore += (character.stats.wins * 10) + (character.stats.kills * 2);
  });
  
  this.score = totalScore;
  
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

// Method to create a new character
playerSchema.methods.createCharacter = function(characterData) {
  this.characters.push(characterData);
  return this.save();
};

// Method to get a character by ID
playerSchema.methods.getCharacter = function(characterId) {
  return this.characters.id(characterId);
};

// Method to set active character
playerSchema.methods.setActiveCharacter = function(characterId) {
  this.activeCharacterId = characterId;
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
    .select('username tier score');
};

const Player = mongoose.model('Player', playerSchema);

module.exports = Player; 