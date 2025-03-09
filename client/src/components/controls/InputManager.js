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
      'camera.right': ['ArrowRight']
    };
    
    // Binding methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleClick = this.handleClick.bind(this);
    
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
   * Handle click events
   * @param {MouseEvent} event - Mouse event
   */
  handleClick(event) {
    // Calculate normalized device coordinates
    const ndcX = (event.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    eventBus.emit('input.click', {
      position: { x: event.clientX, y: event.clientY },
      ndc: { x: ndcX, y: ndcY },
      button: this.getButtonName(event.button),
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
   * Emit events for key bindings
   * @param {string} key - Key that was pressed/released
   * @param {boolean} isDown - Whether the key is down
   */
  emitBindingEvents(key, isDown) {
    // Check all bindings
    Object.entries(this.keyBindings).forEach(([action, keys]) => {
      if (keys.includes(key)) {
        const eventName = isDown 
          ? `input.${action}.start` 
          : `input.${action}.end`;
        
        eventBus.emit(eventName, { key, action });
      }
    });
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
    
    this.isInitialized = false;
  }
}

// Create singleton instance
const inputManager = new InputManager();

export default inputManager;