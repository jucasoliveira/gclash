import eventBus from '../core/EventBus.js';

/**
 * HUD - In-game Heads-Up Display
 * Displays player health, mana, and abilities
 */
class HUD {
  constructor() {
    this.isInitialized = false;
    this.hudElement = null;
    this.healthOrb = null;
    this.manaOrb = null;
    this.skillSlots = [];
    this.skillIcons = [];
    this.cooldownOverlays = [];
    this.selectedClass = null;
    this.id = null; // Will be set when player is created
  }

  /**
   * Initialize the HUD
   * @returns {HUD} This instance for chaining
   */
  init() {
    if (this.isInitialized) return this;

    console.log('Initializing HUD...');
    
    // Create HUD elements
    this._createHUDElements();
    
    // Listen for class selection
    eventBus.on('game.classSelected', (data) => {
      this.selectedClass = data.classType;
      this._updateSkillIcons();
    });
    
    // Debug listener for health changes
    eventBus.on('player.healthChanged', (data) => {
      // Check if this is for our local player or if no ID is provided (backward compatibility)
      if (!data.id || data.id === this.id) {
        console.log(`HUD received health change for player: ${data.health}/${data.maxHealth}`);
        this.updateHealth(data.health, data.maxHealth);
      } else {
        console.log(`HUD ignoring health change for other player: ${data.id}`);
      }
    });
    
    // Also listen for direct network health changes
    eventBus.on('network.playerHealthChanged', (data) => {
      // Check if this is for our local player
      if (data.id === this.id) {
        console.log(`HUD received network health change for LOCAL player: ${data.health}/${data.maxHealth}`);
        this.updateHealth(data.health, data.maxHealth);
      } else {
        console.log(`HUD ignoring network health change for OTHER player: ${data.id}`);
      }
    });

    this.isInitialized = true;
    return this;
  }

  /**
   * Create HUD elements in the DOM
   * @private
   */
  _createHUDElements() {
    // Remove existing HUD if present
    const existingHUD = document.getElementById('new-hud');
    if (existingHUD) {
      existingHUD.remove();
    }

    // Create HUD container
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'new-hud';
    this.hudElement.className = 'new-hud';
    
    // Create health orb
    this.healthOrb = document.createElement('div');
    this.healthOrb.className = 'orb health-orb';
    
    const healthFill = document.createElement('div');
    healthFill.className = 'orb-fill health-fill';
    healthFill.id = 'health-orb-fill';
    healthFill.style.height = '100%'; // Start with full health
    this.healthOrb.appendChild(healthFill);
    
    const healthText = document.createElement('div');
    healthText.className = 'orb-text';
    healthText.id = 'health-text';
    healthText.textContent = '100';
    this.healthOrb.appendChild(healthText);
    
    // Create skills container
    const skillsContainer = document.createElement('div');
    skillsContainer.className = 'skills-container';
    
    // Create 3 skill slots
    for (let i = 0; i < 3; i++) {
      const skillSlot = document.createElement('div');
      skillSlot.className = 'skill-slot';
      skillSlot.id = `skill-slot-${i}`;
      
      const skillIcon = document.createElement('div');
      skillIcon.className = 'skill-icon';
      skillIcon.id = `skill-icon-${i}`;
      skillSlot.appendChild(skillIcon);
      
      const cooldownOverlay = document.createElement('div');
      cooldownOverlay.className = 'cooldown-overlay';
      cooldownOverlay.id = `cooldown-overlay-${i}`;
      skillSlot.appendChild(cooldownOverlay);
      
      const keyHint = document.createElement('div');
      keyHint.className = 'key-hint';
      keyHint.textContent = i === 0 ? 'Q' : i === 1 ? 'W' : 'E';
      skillSlot.appendChild(keyHint);
      
      skillsContainer.appendChild(skillSlot);
      
      // Store references
      this.skillSlots.push(skillSlot);
      this.skillIcons.push(skillIcon);
      this.cooldownOverlays.push(cooldownOverlay);
    }
    
    // Create mana orb
    this.manaOrb = document.createElement('div');
    this.manaOrb.className = 'orb mana-orb';
    
    const manaFill = document.createElement('div');
    manaFill.className = 'orb-fill mana-fill';
    manaFill.id = 'mana-orb-fill';
    manaFill.style.height = '100%'; // Start with full mana
    this.manaOrb.appendChild(manaFill);
    
    const manaText = document.createElement('div');
    manaText.className = 'orb-text';
    manaText.id = 'mana-text';
    manaText.textContent = '100';
    this.manaOrb.appendChild(manaText);
    
    // Append elements to HUD
    this.hudElement.appendChild(this.healthOrb);
    this.hudElement.appendChild(skillsContainer);
    this.hudElement.appendChild(this.manaOrb);
    
    // Add HUD to the document
    document.body.appendChild(this.hudElement);
    
    // Add CSS styles
    this._addStyles();
  }

  /**
   * Add CSS styles for the HUD
   * @private
   */
  _addStyles() {
    const styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.textContent = `
      .new-hud {
        position: fixed;
        bottom: 20px;
        left: 0;
        right: 0;
        display: none;
        justify-content: center;
        align-items: center;
        gap: 20px;
        z-index: 1000;
        pointer-events: none;
      }
      
      .new-hud.visible {
        display: flex !important;
      }
      
      .orb {
        width: 100px; /* Larger orbs */
        height: 100px;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.7);
        border: 4px solid rgba(255, 255, 255, 0.7);
        box-shadow: 0 0 15px rgba(0, 0, 0, 0.7);
        position: relative;
        overflow: hidden;
        pointer-events: auto; /* Allow interaction */
        transition: transform 0.2s ease; /* Add hover effect */
      }
      
      .orb:hover {
        transform: scale(1.05);
      }
      
      .health-orb {
        border-color: rgba(255, 70, 70, 0.8);
        box-shadow: 0 0 15px rgba(255, 70, 70, 0.5);
      }
      
      .mana-orb {
        border-color: rgba(70, 70, 255, 0.8);
        box-shadow: 0 0 15px rgba(70, 70, 255, 0.5);
      }
      
      .orb-fill {
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important; /* Default to 100% - will be overridden */
        transition: height 0.3s ease-out !important;
        z-index: 1 !important;
        will-change: height !important;
      }
      
      .health-fill {
        background: linear-gradient(to top, #ff3333, #ff6666);
        box-shadow: 0 0 10px #ff3333 inset;
      }
      
      .mana-fill {
        background: linear-gradient(to top, #3333ff, #6666ff);
        box-shadow: 0 0 10px #3333ff inset;
      }
      
      .orb-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 24px; /* Larger font */
        font-weight: bold;
        text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
        user-select: none;
        z-index: 2; /* Above the orb fill */
      }
      
      .skills-container {
        display: flex;
        gap: 10px;
      }
      
      .skill-slot {
        width: 70px; /* Larger skill slots */
        height: 70px;
        background-color: rgba(0, 0, 0, 0.7);
        border: 3px solid rgba(255, 255, 255, 0.7);
        border-radius: 8px;
        position: relative;
        overflow: hidden;
        margin: 0 5px; /* Add spacing */
        transition: transform 0.2s ease; /* Add hover effect */
      }
      
      .skill-slot:hover {
        transform: scale(1.05);
      }
      
      .skill-icon {
        width: 100%;
        height: 100%;
        background-size: cover;
        background-position: center;
      }
      
      .cooldown-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 0;
        background-color: rgba(0, 0, 0, 0.6);
        clip-path: circle(140% at 50% 0%);
        transition: height 0.1s linear;
      }
      
      .key-hint {
        position: absolute;
        right: 3px;
        bottom: 3px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 12px;
        padding: 2px 5px;
        border-radius: 3px;
        user-select: none;
      }
      
      /* Class-specific skill icons */
      .skill-icon.clerk-primary {
        background-color: #4287f5;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%234287f5" stroke="white" stroke-width="2"/><circle cx="50" cy="50" r="20" fill="white" opacity="0.5"/></svg>');
      }
      
      .skill-icon.warrior-primary {
        background-color: #e74c3c;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M30,30 L70,70 M30,70 L70,30" stroke="white" stroke-width="8" stroke-linecap="round"/></svg>');
      }
      
      .skill-icon.ranger-primary {
        background-color: #2ecc71;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,20 L50,80" stroke="white" stroke-width="5"/><path d="M30,40 L70,40 L50,20 Z" fill="white"/></svg>');
      }
      
      /* Slot placeholder styles */
      .skill-slot.empty {
        background-image: linear-gradient(45deg, #444 25%, #333 25%, #333 50%, #444 50%, #444 75%, #333 75%);
        background-size: 10px 10px;
      }
    `;
    
    document.head.appendChild(styleElement);
  }

  /**
   * Update skill icons based on selected class
   * @private
   */
  _updateSkillIcons() {
    if (!this.selectedClass) return;
    
    // Clear existing classes
    this.skillIcons.forEach(icon => {
      icon.className = 'skill-icon';
    });
    
    // Set primary skill icon based on class
    if (this.selectedClass === 'CLERK') {
      this.skillIcons[0].classList.add('clerk-primary');
    } else if (this.selectedClass === 'WARRIOR') {
      this.skillIcons[0].classList.add('warrior-primary');
    } else if (this.selectedClass === 'RANGER') {
      this.skillIcons[0].classList.add('ranger-primary');
    }
    
    // Mark other slots as empty for now
    this.skillSlots[1].classList.add('empty');
    this.skillSlots[2].classList.add('empty');
  }

  /**
   * Update health display
   * @param {number} health - Current health
   * @param {number} maxHealth - Maximum health
   */
  updateHealth(health, maxHealth) {
    if (!this.isInitialized) return;
    
    // Ensure health is valid
    const validHealth = Math.max(0, Math.min(maxHealth, health));
    const percentage = Math.max(0, Math.min(100, (validHealth / maxHealth) * 100));
    
    console.log(`HUD.updateHealth: ${validHealth}/${maxHealth} (${percentage}%)`);
    
    // Update orb fill
    const healthFill = document.getElementById('health-orb-fill');
    if (healthFill) {
      console.log(`HUD: Setting health orb fill to ${percentage}% (from ${healthFill.style.height})`);
      healthFill.style.height = `${percentage}%`;
      // Use important flag to ensure style takes effect
      healthFill.setAttribute('style', `height: ${percentage}% !important`);
    } else {
      console.error('HUD: Health fill element not found');
    }
    
    // Update text
    const healthText = document.getElementById('health-text');
    if (healthText) {
      healthText.textContent = Math.round(validHealth);
    } else {
      console.error('HUD: Health text element not found');
    }
  }

  /**
   * Update mana display
   * @param {number} mana - Current mana
   * @param {number} maxMana - Maximum mana
   */
  updateMana(mana, maxMana) {
    if (!this.isInitialized) return;
    
    // Ensure mana is valid
    const validMana = Math.max(0, Math.min(maxMana, mana));
    const percentage = Math.max(0, Math.min(100, (validMana / maxMana) * 100));
    
    console.log(`HUD.updateMana: ${validMana}/${maxMana} (${percentage}%)`);
    
    // Update orb fill
    const manaFill = document.getElementById('mana-orb-fill');
    if (manaFill) {
      console.log(`HUD: Setting mana orb fill to ${percentage}% (from ${manaFill.style.height})`);
      // Use important flag to ensure style takes effect
      manaFill.setAttribute('style', `height: ${percentage}% !important`);
    } else {
      console.error('HUD: Mana fill element not found');
    }
    
    // Update text
    const manaText = document.getElementById('mana-text');
    if (manaText) {
      manaText.textContent = Math.round(validMana);
    } else {
      console.error('HUD: Mana text element not found');
    }
  }

  /**
   * Update cooldown display for a skill
   * @param {number} skillIndex - Index of the skill (0-2)
   * @param {number} remainingTime - Remaining cooldown time
   * @param {number} totalTime - Total cooldown time
   */
  updateCooldown(skillIndex, remainingTime, totalTime) {
    if (!this.isInitialized || skillIndex < 0 || skillIndex >= this.cooldownOverlays.length) return;
    
    const percentage = Math.min(100, (remainingTime / totalTime) * 100);
    
    // Update cooldown overlay
    const cooldownOverlay = this.cooldownOverlays[skillIndex];
    if (cooldownOverlay) {
      cooldownOverlay.style.height = `${percentage}%`;
    }
    
    // Also update the original cooldown bar for the primary skill
    if (skillIndex === 0) {
      const cooldownFill = document.getElementById('cooldown-fill');
      if (cooldownFill) {
        cooldownFill.style.width = `${100 - percentage}%`;
        
        if (percentage <= 0) {
          cooldownFill.style.backgroundColor = '#2ecc71'; // Green when ready
        } else {
          cooldownFill.style.backgroundColor = '#3498db'; // Blue when cooling down
        }
      }
    }
  }

  /**
   * Show the HUD
   */
  show() {
    if (this.hudElement) {
      this.hudElement.classList.add('visible');
      console.log('HUD shown!');
    } else {
      console.error('HUD element not found when trying to show it');
    }
  }

  /**
   * Hide the HUD
   */
  hide() {
    if (this.hudElement) {
      this.hudElement.classList.remove('visible');
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Remove event listeners
    eventBus.off('game.classSelected');
    
    // Remove DOM elements
    if (this.hudElement && this.hudElement.parentNode) {
      this.hudElement.parentNode.removeChild(this.hudElement);
    }
    
    this.isInitialized = false;
  }
}

export default HUD;