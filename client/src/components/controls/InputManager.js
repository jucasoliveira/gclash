import eventBus from '../core/EventBus.js';

/**
 * InputManager - Handles keyboard and mouse input
 * Captures input events and emits them through the event bus
 */
class InputManager {
  constructor() {
    // Input state
    this.keys = {};
    this.mouse = {
      position: { x: 0, y: 0 },
      buttons: {
        left: false,
        middle: false,
        right: false
      }
    };
    
    // Key bindings - defaults
    this.keyBindings = {
      'move.forward': ['w', 'ArrowUp'],
      'move.backward': ['s', 'ArrowDown'],
      'move.left': ['a', 'ArrowLeft'],
      'move.right': ['d', 'ArrowRight'],
      'camera.up': ['ArrowUp'],
      'camera.down': ['ArrowDown'],
      'camera.left': ['ArrowLeft'],
      'camera.right': ['ArrowRight'],
      'camera.toggleFollow': ['f', 'F'],
      'action.evade': [' '], // Space bar for evade
      'skill.slot1': ['1'], // Number keys for skill slots
      'skill.slot2': ['2'],
      'skill.slot3': ['3'],
      'skill.slot4': ['4']
    };
    
    // Camera state
    this.isCameraFollowModeEnabled = false;
    
    // Binding methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleRightClick = this.handleRightClick.bind(this);
    this.toggleCameraFollowMode = this.toggleCameraFollowMode.bind(this);
    
    // Initialization flag
    this.isInitialized = false;
  }

  /**
   * Initialize the input manager
   * @returns {InputManager} - This instance for chaining
   */
  init() {
    if (this.isInitialized) return this;
    
    // Add event listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('click', this.handleClick);
    
    // Add right-click handler with preventDefault to avoid context menu
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handleRightClick(e);
      return false;
    });
    
    // Listen for camera follow mode changes
    eventBus.on('camera.followModeChanged', (data) => {
      this.isCameraFollowModeEnabled = data.isFollowing;
      console.log(`Camera follow mode ${data.isFollowing ? 'enabled' : 'disabled'}`);
    });
    
    // Set up special key handlers - use the correct event format
    eventBus.on('input.camera.toggleFollow.start', this.toggleCameraFollowMode);
    
    this.isInitialized = true;
    return this;
  }

  /**
   * Handle key down events
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyDown(event) {
    // Ignore key repeats
    if (event.repeat) return;
    
    // Record key state
    this.keys[event.key] = true;
    
    // Emit generic key event
    eventBus.emit('input.keyDown', { key: event.key, event });
    
    // Check bindings and emit binding-specific events
    this.emitBindingEvents(event.key, true);
  }

  /**
   * Handle key up events
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyUp(event) {
    // Record key state
    this.keys[event.key] = false;
    
    // Emit generic key event
    eventBus.emit('input.keyUp', { key: event.key, event });
    
    // Check bindings and emit binding-specific events
    this.emitBindingEvents(event.key, false);
  }

  /**
   * Handle mouse move events
   * @param {MouseEvent} event - Mouse event
   */
  handleMouseMove(event) {
    this.mouse.position.x = event.clientX;
    this.mouse.position.y = event.clientY;
    
    // Calculate normalized device coordinates
    const ndcX = (event.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    eventBus.emit('input.mouseMove', {
      position: { x: event.clientX, y: event.clientY },
      ndc: { x: ndcX, y: ndcY },
      event
    });
  }

  /**
   * Handle mouse down events
   * @param {MouseEvent} event - Mouse event
   */
  handleMouseDown(event) {
    this.setMouseButton(event.button, true);
    
    eventBus.emit('input.mouseDown', {
      button: this.getButtonName(event.button),
      position: { x: event.clientX, y: event.clientY },
      event
    });
  }

  /**
   * Handle mouse up events
   * @param {MouseEvent} event - Mouse event
   */
  handleMouseUp(event) {
    this.setMouseButton(event.button, false);
    
    eventBus.emit('input.mouseUp', {
      button: this.getButtonName(event.button),
      position: { x: event.clientX, y: event.clientY },
      event
    });
  }

  /**
   * Handle left click events
   * @param {MouseEvent} event - Mouse event
   */
  handleClick(event) {
    console.log('Click event target:', event.target);
    
    // Check if the click was on a character selection element
    const isCharacterSelectionClick = 
      event.target.closest('.character-class') ||
      event.target.closest('#start-game') ||
      event.target.closest('.mode-button');
    
    if (isCharacterSelectionClick) {
      console.log('Character selection click detected - not emitting event bus event');
      // Don't emit events for character selection clicks
      return;
    }
    
    // Calculate normalized device coordinates
    const ndcX = (event.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Emit both move/interact and attack events - the handler will determine which to use
    // based on whether there's a target under the cursor
    eventBus.emit('input.click', {
      position: { x: event.clientX, y: event.clientY },
      ndc: { x: ndcX, y: ndcY },
      button: 'left',
      event
    });
    
    // Also emit a move event for left click
    eventBus.emit('input.move', {
      position: { x: event.clientX, y: event.clientY },
      ndc: { x: ndcX, y: ndcY },
      event
    });
  }
  
  /**
   * Handle right click events
   * @param {MouseEvent} event - Mouse event
   */
  handleRightClick(event) {
    // Calculate normalized device coordinates
    const ndcX = (event.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Emit core skill event
    eventBus.emit('input.coreSkill', {
      position: { x: event.clientX, y: event.clientY },
      ndc: { x: ndcX, y: ndcY },
      button: 'right',
      event
    });
  }

  /**
   * Helper to set mouse button state
   * @param {number} button - Button index (0=left, 1=middle, 2=right)
   * @param {boolean} state - Button state
   */
  setMouseButton(button, state) {
    switch (button) {
      case 0:
        this.mouse.buttons.left = state;
        break;
      case 1:
        this.mouse.buttons.middle = state;
        break;
      case 2:
        this.mouse.buttons.right = state;
        break;
    }
  }

  /**
   * Helper to get button name from button index
   * @param {number} button - Button index
   * @returns {string} - Button name
   */
  getButtonName(button) {
    switch (button) {
      case 0: return 'left';
      case 1: return 'middle';
      case 2: return 'right';
      default: return 'unknown';
    }
  }

  /**
   * Emit binding events for a key
   * @param {string} key - Key that was pressed/released
   * @param {boolean} isDown - Whether the key was pressed down or released
   * @private
   */
  emitBindingEvents(key, isDown) {
    // For each binding, check if it includes this key
    for (const [action, keys] of Object.entries(this.keyBindings)) {
      if (keys.includes(key)) {
        // Skip camera controls if in follow mode
        if (this.isCameraFollowModeEnabled && action.startsWith('camera.')) {
          continue;
        }
        
        // Use the original event format that the rest of the code expects
        const eventName = isDown 
          ? `input.${action}.start` 
          : `input.${action}.end`;
        
        eventBus.emit(eventName, { key, action });
      }
    }
  }

  /**
   * Set custom keybindings
   * @param {Object} bindings - Key binding object
   */
  setKeyBindings(bindings) {
    this.keyBindings = { ...this.keyBindings, ...bindings };
    eventBus.emit('input.bindingsChanged', this.keyBindings);
  }

  /**
   * Check if a key is pressed
   * @param {string} key - Key to check
   * @returns {boolean} - True if the key is pressed
   */
  isKeyPressed(key) {
    return !!this.keys[key];
  }

  /**
   * Check if an action is active
   * @param {string} action - Action to check
   * @returns {boolean} - True if any key for the action is pressed
   */
  isActionActive(action) {
    const keys = this.keyBindings[action] || [];
    return keys.some(key => this.isKeyPressed(key));
  }

  /**
   * Process input state and emit continuous events
   * Called on each frame
   */
  update() {
    // Emit continuous events for active actions
    Object.keys(this.keyBindings).forEach(action => {
      if (this.isActionActive(action)) {
        eventBus.emit(`input.${action}`, { action });
      }
    });
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (!this.isInitialized) return;
    
    // Remove event listeners
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('click', this.handleClick);
    document.removeEventListener('contextmenu', this.handleRightClick);
    
    this.isInitialized = false;
  }

  /**
   * Toggle camera follow mode on/off
   */
  toggleCameraFollowMode() {
    // Get current game instance from window
    const game = window.game;
    if (!game || !game.player || !game.renderer) {
      console.warn('Cannot toggle camera follow mode: game, player or renderer not available');
      return;
    }
    
    // Toggle the follow mode
    const newFollowMode = !this.isCameraFollowModeEnabled;
    game.renderer.setFollowTarget(game.player, newFollowMode);
    
    // Show feedback to user
    const message = document.createElement('div');
    message.textContent = `Camera follow mode ${newFollowMode ? 'enabled' : 'disabled'}`;
    message.style.position = 'absolute';
    message.style.bottom = '20px';
    message.style.left = '50%';
    message.style.transform = 'translateX(-50%)';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    message.style.color = 'white';
    message.style.padding = '10px';
    message.style.borderRadius = '5px';
    message.style.zIndex = '1000';
    document.body.appendChild(message);
    
    // Remove message after 2 seconds
    setTimeout(() => {
      document.body.removeChild(message);
    }, 2000);
  }
}

// Create singleton instance
const inputManager = new InputManager();

export default inputManager;