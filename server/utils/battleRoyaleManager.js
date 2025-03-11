const { TournamentWinner, BattleRoyale } = require('../models');
const mongoose = require('mongoose');

/**
 * BattleRoyaleManager
 * Manages the connection between tournaments and battle royale events
 */
class BattleRoyaleManager {
  /**
   * Check if there are enough tournament winners to trigger a battle royale
   * @param {number} requiredWinners - Number of winners required (default: 40)
   * @returns {Promise<boolean>} - Whether there are enough winners
   */
  static async checkForBattleRoyaleTrigger(requiredWinners = 40) {
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, skipping battle royale trigger check');
      return false;
    }
    
    try {
      const hasEnough = await TournamentWinner.hasEnoughWinners(requiredWinners);
      return hasEnough;
    } catch (error) {
      console.error('Error checking for battle royale trigger:', error);
      return false;
    }
  }
  
  /**
   * Create a battle royale event from tournament winners
   * @param {number} playerCount - Number of players to include (default: 40)
   * @returns {Promise<BattleRoyale|null>} - The created battle royale or null if failed
   */
  static async createBattleRoyaleFromWinners(playerCount = 40) {
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, cannot create battle royale');
      return null;
    }
    
    try {
      // Check if we have enough winners
      const hasEnough = await TournamentWinner.hasEnoughWinners(playerCount);
      if (!hasEnough) {
        console.log(`Not enough tournament winners for battle royale (need ${playerCount})`);
        return null;
      }
      
      // Create a new battle royale
      const battleRoyale = new BattleRoyale({
        name: `Champions Battle Royale ${new Date().toISOString().split('T')[0]}`,
        tier: 'ALL',
        status: 'PENDING',
        mapSize: 1000
      });
      
      // Save to get an ID
      await battleRoyale.save();
      
      // Get winners and assign them to this battle royale
      const winners = await TournamentWinner.assignToBattleRoyale(battleRoyale._id, playerCount);
      
      // Add winners as participants
      battleRoyale.participants = winners.map(winner => ({
        playerId: winner.playerId,
        username: winner.username,
        characterClass: winner.characterClass,
        isAlive: true,
        kills: 0,
        damageDealt: 0
      }));
      
      // Save the updated battle royale
      await battleRoyale.save();
      
      console.log(`Created battle royale ${battleRoyale._id} with ${winners.length} tournament winners`);
      return battleRoyale;
    } catch (error) {
      console.error('Error creating battle royale from winners:', error);
      return null;
    }
  }
  
  /**
   * Manually add a tournament winner for testing
   * @param {Object} winnerData - Winner data
   * @returns {Promise<Object|null>} - The created winner or null if failed
   */
  static async addTestWinner(winnerData) {
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, cannot add test winner');
      return null;
    }
    
    try {
      const winner = new TournamentWinner({
        playerId: winnerData.playerId || new mongoose.Types.ObjectId(),
        username: winnerData.username || `TestWinner_${Date.now()}`,
        characterClass: winnerData.characterClass || ['CLERK', 'WARRIOR', 'RANGER'][Math.floor(Math.random() * 3)],
        tournamentId: winnerData.tournamentId || new mongoose.Types.ObjectId(),
        tournamentName: winnerData.tournamentName || `Test Tournament ${Date.now()}`,
        tier: winnerData.tier || 'ALL',
        winDate: winnerData.winDate || new Date()
      });
      
      await winner.save();
      console.log(`Added test tournament winner: ${winner.username}`);
      return winner;
    } catch (error) {
      console.error('Error adding test winner:', error);
      return null;
    }
  }
  
  /**
   * Get the count of pending tournament winners
   * @returns {Promise<number>} - The count of pending winners
   */
  static async getPendingWinnersCount() {
    if (mongoose.connection.readyState !== 1) {
      return 0;
    }
    
    try {
      return await TournamentWinner.countDocuments({ battleRoyaleStatus: 'PENDING' });
    } catch (error) {
      console.error('Error getting pending winners count:', error);
      return 0;
    }
  }
  
  /**
   * Check for battle royale trigger and create one if needed
   * @returns {Promise<BattleRoyale|null>} - The created battle royale or null
   */
  static async checkAndTriggerBattleRoyale() {
    const shouldTrigger = await this.checkForBattleRoyaleTrigger();
    if (shouldTrigger) {
      return await this.createBattleRoyaleFromWinners();
    }
    return null;
  }
}

module.exports = BattleRoyaleManager; 