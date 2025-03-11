import eventBus from '../core/EventBus.js';

/**
 * BattleRoyaleNotification - Component to handle battle royale notifications and invitations
 * Displays notifications when battle royale events are triggered and allows players to join
 */
class BattleRoyaleNotification {
  constructor() {
    this.container = null;
    this.notificationElement = null;
    this.joinButton = null;
    this.dismissButton = null;
    this.currentBattleRoyaleId = null;
    
    // Initialize the component
    this._init();
    
    // Set up event listeners
    this._setupEventListeners();
  }
  
  /**
   * Initialize the component
   * @private
   */
  _init() {
    // Create container for notifications
    this.container = document.createElement('div');
    this.container.className = 'battle-royale-notification';
    this.container.style.display = 'none';
    this.container.style.position = 'fixed';
    this.container.style.bottom = '20px';
    this.container.style.right = '20px';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.container.style.color = 'white';
    this.container.style.padding = '15px';
    this.container.style.borderRadius = '5px';
    this.container.style.zIndex = '1000';
    this.container.style.maxWidth = '300px';
    this.container.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.7)';
    this.container.style.border = '1px solid #ffd700';
    
    // Create notification text
    this.notificationElement = document.createElement('div');
    this.notificationElement.className = 'notification-text';
    this.notificationElement.style.marginBottom = '10px';
    this.container.appendChild(this.notificationElement);
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    
    // Create join button
    this.joinButton = document.createElement('button');
    this.joinButton.textContent = 'Join Battle';
    this.joinButton.className = 'join-battle-btn';
    this.joinButton.style.backgroundColor = '#ffd700';
    this.joinButton.style.color = 'black';
    this.joinButton.style.border = 'none';
    this.joinButton.style.padding = '8px 15px';
    this.joinButton.style.borderRadius = '3px';
    this.joinButton.style.cursor = 'pointer';
    this.joinButton.style.fontWeight = 'bold';
    buttonContainer.appendChild(this.joinButton);
    
    // Create dismiss button
    this.dismissButton = document.createElement('button');
    this.dismissButton.textContent = 'Dismiss';
    this.dismissButton.className = 'dismiss-btn';
    this.dismissButton.style.backgroundColor = '#333';
    this.dismissButton.style.color = 'white';
    this.dismissButton.style.border = 'none';
    this.dismissButton.style.padding = '8px 15px';
    this.dismissButton.style.borderRadius = '3px';
    this.dismissButton.style.cursor = 'pointer';
    buttonContainer.appendChild(this.dismissButton);
    
    this.container.appendChild(buttonContainer);
    
    // Add to document
    document.body.appendChild(this.container);
  }
  
  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Listen for battle royale events
    eventBus.on('network.battleRoyaleEvent', this.showBattleRoyaleNotification.bind(this));
    eventBus.on('network.battleRoyaleInvitation', this.showBattleRoyaleInvitation.bind(this));
    
    // Button click handlers
    this.joinButton.addEventListener('click', this._handleJoinClick.bind(this));
    this.dismissButton.addEventListener('click', this._handleDismissClick.bind(this));
  }
  
  /**
   * Show a notification about a battle royale event
   * @param {Object} data - Battle royale event data
   */
  showBattleRoyaleNotification(data) {
    console.log('Showing battle royale notification:', data);
    
    this.currentBattleRoyaleId = data.battleRoyaleId;
    
    // Set notification text
    this.notificationElement.textContent = `A Battle Royale event is starting! ${data.playerCount || 40} players will compete for glory. Will you join the battle?`;
    
    // Show the notification
    this.container.style.display = 'block';
    
    // Add animation
    this.container.style.animation = 'pulse 2s infinite';
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.7); }
        50% { box-shadow: 0 0 20px rgba(255, 215, 0, 1); }
        100% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.7); }
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Show an invitation to join a battle royale
   * @param {Object} data - Battle royale invitation data
   */
  showBattleRoyaleInvitation(data) {
    console.log('Showing battle royale invitation:', data);
    
    this.currentBattleRoyaleId = data.battleRoyaleId;
    
    // Set notification text
    this.notificationElement.textContent = `You've been invited to join the Battle Royale as a tournament winner! Join now to claim your spot.`;
    
    // Show the notification
    this.container.style.display = 'block';
    
    // Add animation
    this.container.style.animation = 'pulse 2s infinite';
  }
  
  /**
   * Handle join button click
   * @private
   */
  _handleJoinClick() {
    console.log('Join battle royale clicked');
    
    if (this.currentBattleRoyaleId) {
      // Emit event to join battle royale
      eventBus.emit('game.joinBattleRoyale', {
        battleRoyaleId: this.currentBattleRoyaleId
      });
      
      // Hide notification
      this.hide();
    }
  }
  
  /**
   * Handle dismiss button click
   * @private
   */
  _handleDismissClick() {
    console.log('Dismiss battle royale notification');
    this.hide();
  }
  
  /**
   * Hide the notification
   */
  hide() {
    this.container.style.display = 'none';
    this.currentBattleRoyaleId = null;
  }
  
  /**
   * Clean up the component
   */
  dispose() {
    // Remove event listeners
    eventBus.off('network.battleRoyaleEvent', this.showBattleRoyaleNotification);
    eventBus.off('network.battleRoyaleInvitation', this.showBattleRoyaleInvitation);
    
    // Remove DOM elements
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

export default BattleRoyaleNotification; 