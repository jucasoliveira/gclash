// WebRTC polyfills for browser compatibility
if (typeof window !== 'undefined') {
  window.global = window;
  window.process = { env: { DEBUG: undefined } };
  
  // Buffer polyfill
  if (!window.Buffer) {
    try {
      window.Buffer = require('buffer/').Buffer;
    } catch (e) {
      console.warn('Failed to load Buffer polyfill:', e);
    }
  }
  
  // Load SimplePeer globally
  try {
    import('simple-peer').then(({ default: SimplePeer }) => {
      window.SimplePeer = SimplePeer;
      console.log('SimplePeer loaded globally');
    }).catch(error => {
      console.error('Failed to load SimplePeer:', error);
    });
  } catch (e) {
    console.error('Error importing SimplePeer:', e);
  }
}

export default {}; 