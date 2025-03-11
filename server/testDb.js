// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const { Player, Tournament, BattleRoyale } = require('./models');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guildclash';

// Test database connection and models
async function testDatabase() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully!');

    // Test Player model
    console.log('\n--- Testing Player Model ---');
    
    // Create a test player
    const testPlayer = new Player({
      username: `TestPlayer_${Date.now()}`,
      characterClass: 'CLERK',
      score: 50,
      stats: {
        wins: 2,
        losses: 1,
        kills: 10,
        deaths: 5,
        damageDealt: 500,
        gamesPlayed: 3
      }
    });
    
    // Save the player
    await testPlayer.save();
    console.log('Created test player:', testPlayer.username);
    
    // Update player score
    await testPlayer.updateScore(100);
    console.log('Updated player score. New score:', testPlayer.score);
    console.log('New tier:', testPlayer.tier);
    
    // Get leaderboard
    const leaderboard = await Player.getLeaderboard(5);
    console.log('Leaderboard (top 5):', leaderboard.map(p => ({
      username: p.username,
      score: p.score,
      tier: p.tier
    })));
    
    // Test Tournament model
    console.log('\n--- Testing Tournament Model ---');
    
    // Create a test tournament
    const testTournament = new Tournament({
      name: `Test Tournament ${Date.now()}`,
      tier: 'BRONZE',
      participants: [
        {
          playerId: testPlayer._id,
          username: testPlayer.username,
          characterClass: testPlayer.characterClass,
          seed: 1
        }
      ]
    });
    
    // Save the tournament
    await testTournament.save();
    console.log('Created test tournament:', testTournament.name);
    
    // Add more test players to the tournament
    for (let i = 0; i < 7; i++) {
      const player = new Player({
        username: `TournamentPlayer_${i}_${Date.now()}`,
        characterClass: ['CLERK', 'WARRIOR', 'RANGER'][i % 3],
        score: 50 + i * 10
      });
      
      await player.save();
      
      testTournament.participants.push({
        playerId: player._id,
        username: player.username,
        characterClass: player.characterClass,
        seed: i + 2
      });
    }
    
    await testTournament.save();
    console.log('Added 7 more players to tournament');
    
    // Generate brackets
    const bracketsGenerated = testTournament.generateBrackets();
    if (bracketsGenerated) {
      await testTournament.save();
      console.log('Generated tournament brackets');
      console.log('First round matches:', testTournament.bracket[0].matches.length);
    }
    
    // Start tournament
    await testTournament.start();
    console.log('Started tournament. Status:', testTournament.status);
    
    // Test Battle Royale model
    console.log('\n--- Testing Battle Royale Model ---');
    
    // Create a test battle royale
    const testBattleRoyale = new BattleRoyale({
      name: `Test Battle Royale ${Date.now()}`,
      tier: 'ALL',
      mapSize: 1000
    });
    
    // Add participants
    const allPlayers = await Player.find().limit(10);
    testBattleRoyale.participants = allPlayers.map(player => ({
      playerId: player._id,
      username: player.username,
      characterClass: player.characterClass,
      isAlive: true,
      kills: 0,
      damageDealt: 0
    }));
    
    // Save the battle royale
    await testBattleRoyale.save();
    console.log('Created test battle royale with', testBattleRoyale.participants.length, 'participants');
    
    // Start battle royale
    await testBattleRoyale.start();
    console.log('Started battle royale. Status:', testBattleRoyale.status);
    console.log('Safe zone stages:', testBattleRoyale.safeZoneStages.length);
    
    // Simulate some eliminations
    if (testBattleRoyale.participants.length >= 3) {
      const player1 = testBattleRoyale.participants[0];
      const player2 = testBattleRoyale.participants[1];
      const player3 = testBattleRoyale.participants[2];
      
      // Player 1 eliminates Player 2
      await testBattleRoyale.eliminatePlayer(player2.playerId, player1.playerId);
      console.log(`${player1.username} eliminated ${player2.username}`);
      
      // Update player damage
      await testBattleRoyale.updatePlayerDamage(player1.playerId, 100);
      console.log(`${player1.username} dealt 100 damage`);
      
      // Get updated battle royale
      const updatedBR = await BattleRoyale.findById(testBattleRoyale._id);
      console.log('Remaining players:', updatedBR.participants.filter(p => p.isAlive).length);
      console.log('Player 1 kills:', updatedBR.participants[0].kills);
    }
    
    console.log('\nDatabase tests completed successfully!');
  } catch (error) {
    console.error('Error during database testing:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the tests
testDatabase(); 