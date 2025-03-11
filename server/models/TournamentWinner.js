const mongoose = require('mongoose');

/**
 * TournamentWinner Schema
 * Stores information about tournament winners who qualify for battle royale events
 */
const tournamentWinnerSchema = new mongoose.Schema({
  // Player ID who won the tournament
  playerId: {
    type: String,
    required: true
  },
  
  // Tournament ID that was won
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Tournament tier
  tier: {
    type: String,
    required: true,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond']
  },
  
  // Timestamp when the tournament was won
  timestamp: {
    type: Date,
    default: Date.now
  },
  
  // Whether this winner has been processed for a battle royale
  processed: {
    type: Boolean,
    default: false
  },
  
  // Battle royale ID this winner was invited to (if processed)
  battleRoyaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BattleRoyale',
    default: null
  }
});

// Create indexes for faster queries
tournamentWinnerSchema.index({ processed: 1 });
tournamentWinnerSchema.index({ playerId: 1 });
tournamentWinnerSchema.index({ tournamentId: 1 });

const TournamentWinner = mongoose.model('TournamentWinner', tournamentWinnerSchema);

module.exports = TournamentWinner; 