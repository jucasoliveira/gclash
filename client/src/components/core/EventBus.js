/**
 * EventBus - Central event system for inter-component communication
 * Implements a simple publish/subscribe pattern
 */
class EventBus {
  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   * @param {string} event - Name of the event
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
    
    // Return a function to remove the event listener
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Name of the event
   * @param {Function} callback - Original callback function
   */
  off(event, callback) {
    if (!this.events[event]) return;
    
    this.events[event] = this.events[event].filter(cb => cb !== callback);
    
    // Remove empty event arrays
    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }

  /**
   * Emit an event with data
   * @param {string} event - Name of the event
   * @param {any} data - Data to pass to subscribers
   */
  emit(event, data) {
    if (!this.events[event]) return;
    
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event ${event} handler:`, error);
      }
    });
  }

  /**
   * Subscribe to an event and unsubscribe after first emit
   * @param {string} event - Name of the event
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} - Unsubscribe function
   */
  once(event, callback) {
    const onceCallback = (data) => {
      this.off(event, onceCallback);
      callback(data);
    };
    
    return this.on(event, onceCallback);
  }

  /**
   * Remove all subscribers for an event
   * @param {string} event - Name of the event
   */
  clear(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  /**
   * Get count of subscribers for an event
   * @param {string} event - Name of the event
   * @returns {number} - Number of subscribers
   */
  listenerCount(event) {
    return this.events[event]?.length || 0;
  }
}

// Create a singleton instance
const eventBus = new EventBus();

export default eventBus;