// Call Timer Helper for Android WebView Integration
class CallTimer {
  constructor() {
    this.startTime = null;
    this.timerInterval = null;
    this.isTimerRunning = false;
  }

  startCall() {
    if (this.isTimerRunning) return;
    
    this.startTime = Date.now();
    this.isTimerRunning = true;
    
    // Notify Android for audio setup
    if (window.Android) {
      // Determine call type based on current page or UI state
      const isVideoCall = this.isVideoCall(); // You need to implement this logic
      if (isVideoCall) {
        window.Android.startCall();
      } else {
        window.Android.startAudioCall();
      }
    }
    
    // Start updating the timer display
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 1000);
    
    console.log('Call timer started');
  }

  endCall() {
    if (!this.isTimerRunning) return;
    
    this.isTimerRunning = false;
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    // Notify Android to restore normal audio
    if (window.Android) {
      window.Android.endCall();
    }
    
    // Log final call duration
    const duration = this.getFormattedDuration();
    console.log('Call ended. Duration:', duration);
    
    if (window.Android) {
      window.Android.logCallEvent(`Call ended. Duration: ${duration}`);
    }
    
    this.startTime = null;
  }

  updateTimerDisplay() {
    if (!this.isTimerRunning || !this.startTime) return;
    
    const duration = this.getFormattedDuration();
    
    // Update timer display elements - more comprehensive selector
    const timerSelectors = [
      '.call-timer', 
      '.call-duration', 
      '[data-call-timer]',
      '.timer',
      '.duration',
      '[class*="timer"]',
      '[class*="duration"]',
      '.call-time',
      '.call-length',
      '[data-timer]',
      '.time-display'
    ];
    
    timerSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element && element.textContent !== undefined) {
          element.textContent = duration;
        }
      });
    });
    
    // Also update any elements containing time-related text
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      if (element.children.length === 0 && element.textContent) {
        const text = element.textContent;
        if (text.includes(':') && (text.includes('00:00') || text.includes('00:'))) {
          element.textContent = duration;
        }
      }
    });
  }

  getFormattedDuration() {
    if (!this.startTime) return '00:00';
    
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  isVideoCall() {
    // Logic to determine if it's a video call
    // Check URL, UI elements, or other indicators
    const url = window.location.href;
    const hasVideoElement = document.querySelector('video') !== null;
    const hasVideoButton = document.querySelector('[class*="video"], [data-video]') !== null;
    const hasVideoContainer = document.querySelector('[class*="video-container"], [class*="video-call"]') !== null;
    
    return url.includes('video') || hasVideoElement || hasVideoButton || hasVideoContainer;
  }

  toggleSpeakerphone() {
    if (window.Android) {
      const isSpeakerOn = this.isSpeakerOn();
      if (isSpeakerOn) {
        window.Android.disableSpeakerphone();
      } else {
        window.Android.enableSpeakerphone();
      }
      return !isSpeakerOn;
    }
    return false;
  }

  isSpeakerOn() {
    // This would need to be tracked in state or detected from UI
    return false;
  }

  // Auto-initialize when page loads
  static initialize() {
    const timer = new CallTimer();
    
    // Auto-detect call start/end based on DOM changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Look for call UI elements being added/removed
        const addedNodes = Array.from(mutation.addedNodes);
        const hasCallStart = addedNodes.some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return node.matches('.call-active, [class*="calling"], [data-call-active]') ||
                   node.querySelector('.call-active, [class*="calling"], [data-call-active]') ||
                   node.matches('[class*="call-connected"], [data-call-connected]') ||
                   node.querySelector('[class*="call-connected"], [data-call-connected]');
          }
          return false;
        });
        
        const hasCallEnd = addedNodes.some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return node.matches('.call-ended, [class*="end-call"], [data-call-ended]') ||
                   node.querySelector('.call-ended, [class*="end-call"], [data-call-ended]') ||
                   node.matches('[class*="call-disconnected"], [data-call-disconnected]') ||
                   node.querySelector('[class*="call-disconnected"], [data-call-disconnected]');
          }
          return false;
        });
        
        if (hasCallStart && !timer.isTimerRunning) {
          timer.startCall();
        } else if (hasCallEnd && timer.isTimerRunning) {
          timer.endCall();
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Make timer globally accessible
    window.callTimer = timer;
    
    console.log('Call timer initialized');
    return timer;
  }
}

// Handle external login from Android custom URL scheme
function handleExternalLogin(data) {
  console.log('External login received:', data);
  
  if (data.token) {
    // Store the token
    localStorage.setItem('tdp_tokens', JSON.stringify({
      accessToken: data.token,
      refreshToken: data.token
    }));
    
    if (data.email) {
      localStorage.setItem('tdp_user', JSON.stringify({
        id: data.email,
        email: data.email,
        name: data.name || data.email
      }));
    }
    
    // Reload the page to apply login
    window.location.reload();
  }
}

// Make the function globally available
window.handleExternalLogin = handleExternalLogin;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    CallTimer.initialize();
  });
} else {
  CallTimer.initialize();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CallTimer;
}
