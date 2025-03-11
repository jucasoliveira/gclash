/**
 * Test script for adding tournament winners and triggering battle royale
 * Run with: node server/testBattleRoyaleTrigger.js
 */

const mongoose = require('mongoose');
const { Player, Tournament, TournamentWinner, BattleRoyale } = require('./models');
const BattleRoyaleManager = require('./utils/battleRoyaleManager');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guildclash';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

/**
 * Add a specified number of test tournament winners
 * @param {number} count - Number of winners to add
 */
async function addTestWinners(count = 1) {
  console.log(`Adding ${count} test tournament winners...`);
  
  try {
    // Create a test tournament if needed
    let tournament = await Tournament.findOne({ name: /Test Tournament/ });
    
    if (!tournament) {
      tournament = new Tournament({
        name: `Test Tournament ${Date.now()}`,
        tier: 'ALL',
        status: 'COMPLETED'
      });
      await tournament.save();
      console.log(`Created test tournament: ${tournament.name}`);
    }
    
    // Create test players and winners
    for (let i = 0; i < count; i++) {
      // Create a test player
      const player = new Player({
        username: `TestPlayer_${Date.now()}_${i}`,
        characterClass: ['CLERK', 'WARRIOR', 'RANGER'][Math.floor(Math.random() * 3)],
        score: 100 + Math.floor(Math.random() * 900)
      });
      
      await player.save();
      
      // Create a tournament winner
      const winner = new TournamentWinner({
        playerId: player._id,
        username: player.username,
        characterClass: player.characterClass,
        tournamentId: tournament._id,
        tournamentName: tournament.name,
        tier: 'ALL'
      });
      
      await winner.save();
      console.log(`Added winner #${i+1}: ${player.username}`);
    }
    
    // Get current count of pending winners
    const pendingCount = await TournamentWinner.countDocuments({ battleRoyaleStatus: 'PENDING' });
    console.log(`Current pending tournament winners: ${pendingCount}/40`);
    
    return pendingCount;
  } catch (error) {
    console.error('Error adding test winners:', error);
    return 0;
  }
}

/**
 * Check if we have enough winners to trigger a battle royale
 */
async function checkBattleRoyaleTrigger() {
  try {
    const canTrigger = await BattleRoyaleManager.checkForBattleRoyaleTrigger();
    console.log(`Can trigger battle royale: ${canTrigger}`);
    return canTrigger;
  } catch (error) {
    console.error('Error checking battle royale trigger:', error);
    return false;
  }
}

/**
 * Create a battle royale from tournament winners
 */
async function createBattleRoyale() {
  try {
    console.log('Creating battle royale from tournament winners...');
    const battleRoyale = await BattleRoyaleManager.createBattleRoyaleFromWinners();
    
    if (battleRoyale) {
      console.log(`Battle Royale created: ${battleRoyale.name}`);
      console.log(`Participants: ${battleRoyale.participants.length}`);
      console.log(`Status: ${battleRoyale.status}`);
      return battleRoyale;
    } else {
      console.log('Failed to create battle royale');
      return null;
    }
  } catch (error) {
    console.error('Error creating battle royale:', error);
    return null;
  }
}

/**
 * Main function to run the test
 */
async function main() {
  try {
    // Check current pending winners count
    const initialCount = await TournamentWinner.countDocuments({ battleRoyaleStatus: 'PENDING' });
    console.log(`Initial pending tournament winners: ${initialCount}/40`);
    
    // If we don't have 40 winners yet, add more
    if (initialCount < 40) {
      const neededCount = 40 - initialCount;
      console.log(`Need ${neededCount} more winners to trigger battle royale`);
      
      // Add the needed winners
      await addTestWinners(neededCount);
    }
    
    // Check if we can trigger a battle royale
    const canTrigger = await checkBattleRoyaleTrigger();
    
    if (canTrigger) {
      // Create a battle royale
      const battleRoyale = await createBattleRoyale();
      
      if (battleRoyale) {
        console.log('Battle Royale successfully created!');
        console.log(`ID: ${battleRoyale._id}`);
        console.log(`Name: ${battleRoyale.name}`);
        console.log(`Participants: ${battleRoyale.participants.length}`);
      }
    } else {
      console.log('Cannot trigger battle royale yet');
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Run the main function
main(); 