// Load environment variables
require('dotenv').config();

const fetch = require('node-fetch');

// API base URL
const API_BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;

// Test API endpoints
async function testApi() {
  try {
    console.log('Testing Guild Clash API endpoints...\n');
    
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('Health endpoint response:', healthData);
    
    // Create a test player
    console.log('\n2. Creating a test player...');
    const createPlayerResponse = await fetch(`${API_BASE_URL}/players`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: `TestPlayer_${Date.now()}`,
        characterClass: 'RANGER'
      })
    });
    
    if (!createPlayerResponse.ok) {
      const errorData = await createPlayerResponse.json();
      console.error('Error creating player:', errorData);
      return;
    }
    
    const playerData = await createPlayerResponse.json();
    console.log('Created player:', playerData);
    
    // Get all players
    console.log('\n3. Getting all players...');
    const playersResponse = await fetch(`${API_BASE_URL}/players`);
    const players = await playersResponse.json();
    console.log(`Found ${players.length} players`);
    
    // Get leaderboard
    console.log('\n4. Getting leaderboard...');
    const leaderboardResponse = await fetch(`${API_BASE_URL}/leaderboard?limit=5`);
    const leaderboard = await leaderboardResponse.json();
    console.log('Leaderboard (top 5):', leaderboard);
    
    // Update player stats
    console.log('\n5. Updating player stats...');
    const updateResponse = await fetch(`${API_BASE_URL}/players/${playerData._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        score: 100,
        stats: {
          wins: 2,
          kills: 10,
          damageDealt: 500
        }
      })
    });
    
    const updatedPlayer = await updateResponse.json();
    console.log('Updated player:', updatedPlayer);
    
    // Create a test tournament
    console.log('\n6. Creating a test tournament...');
    const createTournamentResponse = await fetch(`${API_BASE_URL}/tournaments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `Test Tournament ${Date.now()}`,
        tier: 'BRONZE'
      })
    });
    
    const tournamentData = await createTournamentResponse.json();
    console.log('Created tournament:', tournamentData.name);
    
    // Get all tournaments
    console.log('\n7. Getting all tournaments...');
    const tournamentsResponse = await fetch(`${API_BASE_URL}/tournaments`);
    const tournaments = await tournamentsResponse.json();
    console.log(`Found ${tournaments.length} tournaments`);
    
    // Get active battle royale matches
    console.log('\n8. Getting active battle royale matches...');
    const brResponse = await fetch(`${API_BASE_URL}/battle-royale/active`);
    const brMatches = await brResponse.json();
    console.log(`Found ${brMatches.length} active battle royale matches`);
    
    console.log('\nAPI tests completed successfully!');
  } catch (error) {
    console.error('Error during API testing:', error);
  }
}

// Run the tests
testApi(); 