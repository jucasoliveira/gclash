# Death and Respawn System Documentation

## Overview

The Guild Clash death and respawn system manages player death events, death screen display, and the respawn process. This document outlines the architecture, components, and recent improvements to the system.

## Components

### Client-Side Components

#### Player.js

Handles the local player's death and respawn process.

Key methods:

- `takeDamage(amount, attackerId)`: Processes damage and triggers death if health reaches zero
- `_handleDeath(attackerId)`: Manages the death state, effects, and notifications
- `_respawn()`: Handles the respawn process, resetting health and position
- `_updateHealthUI()`: Updates the health UI display

#### OtherPlayer.js

Manages other players' death and respawn visualization.

Key methods:

- `takeDamage(amount, fromNetwork)`: Processes damage for other players
- `_showDeathEffect()`: Displays death effects when a player dies
- `_updateHealthBar()`: Updates the health bar display

#### WebSocketManager.js

Handles network communication for death and respawn events.

Key methods:

- `sendDeath(deathData)`: Sends death notification to the server
- `sendRespawn(respawnData)`: Sends respawn notification to the server
- `handleMessage(event)`: Processes incoming death and respawn messages

#### EntityManager.js

Manages entity death and respawn across the game.

Key methods:

- `_handlePlayerDied(data)`: Processes player death events
- `_handlePlayerRespawned(data)`: Processes player respawn events
- `_createRespawnEffect(position)`: Creates visual effects for respawning

#### UIManager.js

Manages the death screen and respawn UI.

Key methods:

- `showDeathScreen(attackerId)`: Displays the death screen with attacker information
- `hideDeathScreen()`: Removes the death screen when respawning

## Communication Protocol

### Client to Server Messages

#### playerDied

```javascript
{
  type: 'playerDied',
  id: 'player_id',
  attackerId: 'attacker_id'
}
```

#### playerRespawn

```javascript
{
  type: 'playerRespawn',
  id: 'player_id',
  health: 100,
  position: { x: 0, y: 0, z: 0 }
}
```

### Server to Client Messages

#### playerDied

```javascript
{
  type: 'playerDied',
  id: 'player_id',
  attackerId: 'attacker_id'
}
```

#### playerRespawn

```javascript
{
  type: 'playerRespawn',
  id: 'player_id',
  health: 100,
  position: { x: 0, y: 0, z: 0 }
}
```

## Recent Improvements

### Death System Enhancements

The death system has been enhanced to improve reliability and prevent visual glitches. The following improvements have been implemented:

#### Enhanced `takeDamage` Method in Player.js

```javascript
takeDamage(amount, attackerId) {
  // Skip if already dead
  if (this.isDead) {
    console.log(`[PLAYER] Already dead, ignoring damage`);
    return;
  }

  // Validate damage amount
  if (!amount || amount <= 0) {
    console.log(`[PLAYER] Invalid damage amount:`, amount);
    return;
  }

  // Ensure stats object is initialized
  if (!this.stats) {
    this.stats = this._getDefaultStatsForClass(this.classType);
  }

  // Ensure health is set based on class type
  if (this.health === undefined) {
    this.health = this.stats.health;
  }

  console.log(`[PLAYER] Taking ${amount} damage from ${attackerId || 'unknown'}`);

  // Apply damage
  this.health = Math.max(0, this.health - amount);

  // Update health UI
  this._updateHealthUI();

  // Log damage taken
  console.log(`[PLAYER] Health reduced to ${this.health}/${this.stats.health}`);

  // Notify server of health change
  if (window.webSocketManager) {
    window.webSocketManager.updateHealth({
      health: this.health
    });
  }

  // Check if player died
  if (this.health <= 0 && !this.isDead) {
    console.log(`[PLAYER] Player died from damage by ${attackerId}`);
    this._handleDeath(attackerId);
    return;
  }

  // Show damage effect for non-fatal damage
  this._showDamageEffect();
}
```

#### Enhanced `_handleDeath` Method in Player.js

```javascript
_handleDeath(attackerId) {
  // Prevent multiple death handling
  if (this.isDead) {
    console.log(`[PLAYER] Already dead, not handling death again`);
    return;
  }

  // Set dead flag
  this.isDead = true;
  console.log(`[PLAYER] Handling death from attacker: ${attackerId}`);

  // Ensure health is 0
  this.health = 0;
  this._updateHealthUI();

  // Show death effect
  this._showDeathEffect();

  // Hide player mesh
  if (this.mesh) {
    this.mesh.visible = false;

    // Also hide health bar
    if (this.healthBar) {
      this.healthBar.visible = false;
    }

    // Remove mesh from scene after a short delay
    setTimeout(() => {
      if (this.mesh && this.mesh.parent) {
        this.mesh.parent.remove(this.mesh);
      }
    }, 1000);
  }

  // Notify server about death
  if (window.webSocketManager) {
    window.webSocketManager.sendDeath({
      attackerId: attackerId
    });
  }

  // Show death screen after a short delay to allow effects to start
  setTimeout(() => {
    // Use event bus to show death screen
    eventBus.emit('ui.showDeathScreen', { attackerId });
  }, 200);
}
```

#### Enhanced `_updateHealthUI` Method in Player.js

```javascript
_updateHealthUI() {
  // Validate health to prevent NaN errors
  if (typeof this.health !== 'number' || isNaN(this.health)) {
    console.warn('[PLAYER] Invalid health value, resetting to 0');
    this.health = 0;
  }

  // Validate max health
  const maxHealth = (this.stats && typeof this.stats.health === 'number' && !isNaN(this.stats.health))
    ? this.stats.health
    : 100;

  // Calculate health percentage (clamped between 0-100%)
  const healthPercent = Math.max(0, Math.min(100, (this.health / maxHealth) * 100));

  // Update health bar width
  const healthBar = document.getElementById('health-bar-fill');
  if (healthBar) {
    healthBar.style.width = `${healthPercent}%`;

    // Update color based on health percentage
    if (healthPercent > 60) {
      healthBar.style.backgroundColor = '#2ecc71'; // Green
    } else if (healthPercent > 30) {
      healthBar.style.backgroundColor = '#f39c12'; // Orange
    } else {
      healthBar.style.backgroundColor = '#e74c3c'; // Red
    }
  }

  // Update health text
  const healthText = document.getElementById('player-health');
  if (healthText) {
    healthText.textContent = `${Math.round(this.health)}/${maxHealth}`;
  }

  // Update player stats display
  const statsDisplay = document.getElementById('player-stats');
  if (statsDisplay) {
    statsDisplay.textContent = `Health: ${Math.round(this.health)}/${maxHealth}`;
  }
}
```

### Respawn System Enhancements

The respawn system has been enhanced to improve reliability and prevent visual glitches. The following improvements have been implemented:

#### Enhanced `_respawn` Method in Player.js

```javascript
_respawn() {
  console.log('[PLAYER] Respawning player');

  // Reset isDead flag
  this.isDead = false;

  // Validate and initialize player stats
  if (!this.stats) {
    console.log('[PLAYER] Initializing missing stats during respawn');
    this.stats = this._getDefaultStatsForClass(this.classType);
  }

  // Set health to max
  this.health = this.stats.health;
  console.log(`[PLAYER] Reset health to ${this.health}/${this.stats.health}`);

  // Update health UI
  this._updateHealthUI();

  // Generate random respawn position
  const respawnPosition = {
    x: (Math.random() - 0.5) * 20,
    y: 0.8,
    z: (Math.random() - 0.5) * 20
  };

  // Update position
  this.position.set(respawnPosition.x, respawnPosition.y, respawnPosition.z);

  // Recreate mesh if needed
  if (!this.mesh) {
    console.log('[PLAYER] Recreating player mesh during respawn');
    this._createPlayerMesh();
  } else {
    // Make mesh visible
    this.mesh.visible = true;
    console.log('[PLAYER] Made player mesh visible during respawn');

    // Update mesh position
    this.mesh.position.copy(this.position);
  }

  // Show respawn effect
  this._showRespawnEffect();

  // Notify server about respawn
  if (window.webSocketManager) {
    window.webSocketManager.sendRespawn({
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      health: this.health
    });
  }

  console.log('[PLAYER] Player fully respawned');
}
```

#### Enhanced `showDeathScreen` Method in UIManager.js

```javascript
showDeathScreen(attackerId) {
  console.log(`[UI] Showing death screen, attacker: ${attackerId}`);

  // Prevent multiple death screens
  if (this.deathScreenShown) {
    console.log('[UI] Death screen already shown, not showing again');
    return;
  }

  // Set flag to prevent multiple death screens
  this.deathScreenShown = true;

  // Get or create death screen element
  let deathScreen = document.getElementById('death-screen');

  if (!deathScreen) {
    deathScreen = document.createElement('div');
    deathScreen.id = 'death-screen';
    deathScreen.style.position = 'absolute';
    deathScreen.style.top = '0';
    deathScreen.style.left = '0';
    deathScreen.style.width = '100%';
    deathScreen.style.height = '100%';
    deathScreen.style.backgroundColor = 'rgba(139, 0, 0, 0.7)';
    deathScreen.style.color = 'white';
    deathScreen.style.display = 'flex';
    deathScreen.style.flexDirection = 'column';
    deathScreen.style.justifyContent = 'center';
    deathScreen.style.alignItems = 'center';
    deathScreen.style.zIndex = '1000';
    deathScreen.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(deathScreen);
  }

  // Get attacker name
  let attackerName = 'Unknown';
  if (attackerId && window.game) {
    const attacker = window.game.entityManager.getEntity(attackerId);
    if (attacker) {
      attackerName = attacker.name || `Player ${attackerId}`;
    }
  }

  // Set content
  deathScreen.innerHTML = `
    <h1 style="font-size: 48px; margin-bottom: 20px;">YOU DIED</h1>
    <p style="font-size: 24px; margin-bottom: 40px;">Killed by: ${attackerName}</p>
    <p style="font-size: 20px;">Respawning in <span id="respawn-countdown">5</span> seconds...</p>
  `;

  // Set up countdown
  let countdown = 5;
  const countdownElement = document.getElementById('respawn-countdown');

  // Clear any existing interval
  if (this.countdownInterval) {
    clearInterval(this.countdownInterval);
  }

  // Start countdown
  this.countdownInterval = setInterval(() => {
    countdown--;

    if (countdownElement) {
      countdownElement.textContent = countdown;
    }

    if (countdown <= 0) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;

      // Hide death screen
      deathScreen.style.display = 'none';

      // Reset flag
      this.deathScreenShown = false;

      // Respawn player if they are dead
      if (window.game && window.game.player && window.game.player.isDead) {
        console.log('[UI] Triggering player respawn after countdown');
        window.game.player._respawn();
      } else {
        console.log('[UI] Player is not dead, not respawning');
      }
    }
  }, 1000);
}
```

### OtherPlayer Respawn Enhancements

The OtherPlayer respawn handling has been enhanced to improve reliability and prevent visual glitches. The following improvements have been implemented:

#### Enhanced Event Handling for Respawn in OtherPlayer.js

```javascript
// Listen for respawn events from network
eventBus.on(`network.playerRespawned`, (data) => {
  if (data.id === this.id) {
    console.log(
      `[OTHER_PLAYER] Player ${this.id} respawned with health=${data.health}`
    );

    // Reset isDead flag
    this.isDead = false;

    // Set health with validation
    if (typeof data.health === "number" && !isNaN(data.health)) {
      this.health = data.health;
    } else if (this.stats && typeof this.stats.health === "number") {
      this.health = this.stats.health;
      console.log(
        `[OTHER_PLAYER] Using stats.health (${this.stats.health}) for respawn`
      );
    } else {
      // Default health based on class
      const defaultHealthByClass = {
        CLERK: 80,
        WARRIOR: 120,
        RANGER: 100,
      };
      this.health = defaultHealthByClass[this.classType] || 100;
      console.log(
        `[OTHER_PLAYER] Using default health (${this.health}) for respawn`
      );
    }

    // Update position if provided
    if (data.position) {
      this.position.set(data.position.x, data.position.y, data.position.z);
      this.targetPosition.copy(this.position);
    }

    // Check if mesh exists
    if (this.mesh) {
      console.log(
        `[OTHER_PLAYER] Making existing mesh visible for player ${this.id}`
      );
      this.mesh.visible = true;

      // Update mesh position
      this.mesh.position.copy(this.position);
    } else {
      console.log(
        `[OTHER_PLAYER] Mesh doesn't exist for player ${this.id}, creating new mesh`
      );
      this._createPlayerMesh();
    }

    // Update health bar
    if (this.healthBar) {
      this.healthBar.visible = true;
      this._updateHealthBar();
    } else {
      this._createHealthBar();
    }

    console.log(
      `[OTHER_PLAYER] Player ${this.id} fully respawned with health=${this.health}`
    );
  }
});
```

## Benefits of Recent Improvements

- **Reliability**: More reliable death and respawn experience for players
- **Visual Consistency**: Elimination of visual glitches during respawn
- **Health Display**: Consistent health display across all game states
- **Multiplayer Synchronization**: Improved synchronization of death and respawn events
- **Error Handling**: Better error handling for edge cases in the combat system

These improvements ensure that the death and respawn system works reliably across all game modes, providing a consistent and enjoyable player experience.
