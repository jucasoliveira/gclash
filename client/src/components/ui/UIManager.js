import eventBus from '../core/EventBus.js';
import HUD from './HUD.js';

/**
 * UIManager - Manages all UI elements and screens
 * Handles UI transitions, state, and coordinates UI input and events
 */
class UIManager {
  constructor() {
    this.isInitialized = false;
    this.components = {
      hud: null
    };
  }

  /**
   * Initialize the UI Manager
   * @returns {UIManager} This instance for chaining
   */
  init() {
    if (this.isInitialized) return this;

    console.log('Initializing UI Manager...');

    // Initialize HUD component
    this.components.hud = new HUD().init();

    // Set up event listeners
    this._setupEventListeners();

    this.isInitialized = true;
    return this;
  }

  /**
   * Set up event listeners for UI-related events
   * @private
   */
  _setupEventListeners() {
    // Listen for player health changes to update HUD
    eventBus.on('player.healthChanged', (data) => {
      if (this.components.hud) {
        this.components.hud.updateHealth(data.health, data.maxHealth);
      }
    });

    // Listen for player mana changes to update HUD (will be implemented later)
    eventBus.on('player.manaChanged', (data) => {
      if (this.components.hud) {
        this.components.hud.updateMana(data.mana, data.maxMana);
      }
    });

    // Listen for skill cooldown updates
    eventBus.on('player.cooldownUpdate', (data) => {
      if (this.components.hud) {
        this.components.hud.updateCooldown(data.skillIndex, data.remainingTime, data.totalTime);
      }
    });

    // Listen for game state changes
    eventBus.on('game.started', () => {
      if (this.components.hud) {
        this.components.hud.show();
      }
    });

    eventBus.on('game.stopped', () => {
      if (this.components.hud) {
        this.components.hud.hide();
      }
    });
  }

  /**
   * Show the HUD
   */
  showHUD() {
    if (this.components.hud) {
      console.log('UIManager: Showing HUD');
      this.components.hud.show();
    } else {
      console.error('UIManager: Cannot show HUD - component not initialized');
      // Try to initialize it if it's not already
      if (!this.isInitialized) {
        console.log('UIManager: Attempting to initialize on demand');
        this.init();
      }
      if (this.components.hud) {
        this.components.hud.show();
      }
    }
  }

  /**
   * Hide the HUD
   */
  hideHUD() {
    if (this.components.hud) {
      this.components.hud.hide();
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Clean up event listeners
    eventBus.off('player.healthChanged');
    eventBus.off('player.manaChanged');
    eventBus.off('player.cooldownUpdate');
    eventBus.off('game.started');
    eventBus.off('game.stopped');

    // Dispose components
    if (this.components.hud) {
      this.components.hud.dispose();
    }

    this.isInitialized = false;
  }
}

// Create singleton instance
const uiManager = new UIManager();

export default uiManager;