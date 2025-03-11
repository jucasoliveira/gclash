const mongoose = require('mongoose');

/**
 * Tournament Schema
 * Stores tournament information, participants, brackets, and results
 */
const tournamentSchema = new mongoose.Schema({
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
    seed: Number,
    eliminated: {
      type: Boolean,
      default: false
    }
  }],
  bracket: [{
    round: Number,
    matches: [{
      matchId: String,
      player1Id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      },
      player2Id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      },
      winnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        default: null
      },
      score: {
        player1: {
          type: Number,
          default: 0
        },
        player2: {
          type: Number,
          default: 0
        }
      },
      status: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
        default: 'PENDING'
      }
    }]
  }],
  winner: {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null
    },
    username: String,
    characterClass: String
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: true
});

// Method to generate tournament brackets
tournamentSchema.methods.generateBrackets = function() {
  // Only generate brackets if tournament is in PENDING status
  if (this.status !== 'PENDING' || this.participants.length < 2) {
    return false;
  }
  
  // Shuffle participants for random seeding
  const shuffledParticipants = [...this.participants].sort(() => 0.5 - Math.random());
  
  // Assign seeds
  shuffledParticipants.forEach((participant, index) => {
    participant.seed = index + 1;
  });
  
  // Calculate number of rounds needed (log2 of participants, rounded up)
  const numRounds = Math.ceil(Math.log2(shuffledParticipants.length));
  
  // Calculate total number of matches needed
  const totalMatches = Math.pow(2, numRounds) - 1;
  
  // Generate bracket structure
  const bracket = [];
  
  // First round with actual participants
  const firstRoundMatches = [];
  const numFirstRoundMatches = Math.floor(shuffledParticipants.length / 2);
  
  for (let i = 0; i < numFirstRoundMatches; i++) {
    const player1 = shuffledParticipants[i];
    const player2 = shuffledParticipants[shuffledParticipants.length - 1 - i];
    
    firstRoundMatches.push({
      matchId: `R1-M${i+1}`,
      player1Id: player1.playerId,
      player2Id: player2.playerId,
      status: 'PENDING'
    });
  }
  
  bracket.push({
    round: 1,
    matches: firstRoundMatches
  });
  
  // Generate placeholder matches for subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const numMatches = Math.pow(2, numRounds - round);
    const matches = [];
    
    for (let i = 0; i < numMatches; i++) {
      matches.push({
        matchId: `R${round}-M${i+1}`,
        player1Id: null,
        player2Id: null,
        status: 'PENDING'
      });
    }
    
    bracket.push({
      round,
      matches
    });
  }
  
  this.bracket = bracket;
  this.status = 'PENDING';
  
  return true;
};

// Method to start tournament
tournamentSchema.methods.start = function() {
  if (this.status !== 'PENDING' || !this.bracket || this.bracket.length === 0) {
    return false;
  }
  
  this.status = 'IN_PROGRESS';
  this.startDate = new Date();
  
  return this.save();
};

// Method to update match result
tournamentSchema.methods.updateMatchResult = function(matchId, winnerId) {
  // Find the match in the bracket
  let match = null;
  let roundIndex = -1;
  let matchIndex = -1;
  
  for (let i = 0; i < this.bracket.length; i++) {
    const round = this.bracket[i];
    for (let j = 0; j < round.matches.length; j++) {
      if (round.matches[j].matchId === matchId) {
        match = round.matches[j];
        roundIndex = i;
        matchIndex = j;
        break;
      }
    }
    if (match) break;
  }
  
  if (!match) return false;
  
  // Update match result
  match.winnerId = winnerId;
  match.status = 'COMPLETED';
  
  // If not the final round, update the next round's match
  if (roundIndex < this.bracket.length - 1) {
    const nextRound = this.bracket[roundIndex + 1];
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const nextMatch = nextRound.matches[nextMatchIndex];
    
    // Determine if this winner goes to player1 or player2 slot
    if (matchIndex % 2 === 0) {
      nextMatch.player1Id = winnerId;
    } else {
      nextMatch.player2Id = winnerId;
    }
    
    // If both players are set, update match status
    if (nextMatch.player1Id && nextMatch.player2Id) {
      nextMatch.status = 'PENDING';
    }
  } else {
    // This was the final match, tournament is complete
    this.status = 'COMPLETED';
    this.endDate = new Date();
    
    // Set tournament winner
    const winnerParticipant = this.participants.find(p => 
      p.playerId.toString() === winnerId.toString()
    );
    
    if (winnerParticipant) {
      this.winner = {
        playerId: winnerId,
        username: winnerParticipant.username,
        characterClass: winnerParticipant.characterClass
      };
    }
  }
  
  return this.save();
};

const Tournament = mongoose.model('Tournament', tournamentSchema);

module.exports = Tournament; 