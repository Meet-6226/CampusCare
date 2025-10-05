import { firebaseConfig } from "./firebase-Config.js";

// Initialize Firebase for FCM
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

class FCMService {
  constructor() {
    this.token = null;
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    this.functionUrl = 'https://us-central1-exam-223d0.cloudfunctions.net/sendNotification';
    this.targetedFunctionUrl = 'https://us-central1-exam-223d0.cloudfunctions.net/sendTargetedNotification';
    this.subscribeToTopicUrl = 'https://us-central1-exam-223d0.cloudfunctions.net/subscribeToTopic';
  }

  /**
   * Initialize FCM service and request notification permissions
   */
  async initialize() {
    if (!this.isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return false;
    }

    try {
      // Register service worker
      await this.registerServiceWorker();
      
      // Request notification permission
      const permission = await this.requestPermission();
      
      if (permission === 'granted') {
        // Get FCM token
        await this.getToken();
        
        // Subscribe to "all" topic for broadcast notifications
        await this.subscribeToTopic('all');
        
        // Set up token refresh listener
        this.setupTokenRefreshListener();
        
        // Set up foreground message listener
        this.setupForegroundMessageListener();
        
        console.log('FCM service initialized successfully');
        return true;
      } else {
        console.warn('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error initializing FCM service:', error);
      return false;
    }
  }

  /**
   * Register service worker for background notifications
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered successfully:', registration);
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
      }
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission() {
    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Get FCM registration token
   */
  async getToken() {
    try {
      const token = await messaging.getToken({
        vapidKey: firebaseConfig.vapidKey
      });
      
      if (token) {
        this.token = token;
        console.log('FCM Token:', token);
        
        // Store token in localStorage and Firestore
        await this.storeToken(token);
        
        return token;
      } else {
        console.log('No registration token available');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Store FCM token in Firestore for the current user
   */
  async storeToken(token) {
    try {
      const userId = localStorage.getItem('campuscareRoll');
      const userRole = localStorage.getItem('campuscareRole');
      
      if (userId) {
        const db = firebase.firestore();
        await db.collection('fcm_tokens').doc(userId).set({
          token: token,
          userId: userId,
          role: userRole || 'user',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
          }
        }, { merge: true });
        
        console.log('FCM token stored successfully');
      }
      
      // Also store in localStorage for quick access
      localStorage.setItem('fcmToken', token);
    } catch (error) {
      console.error('Error storing FCM token:', error);
    }
  }

  /**
   * Subscribe to a topic for broadcast notifications
   */
  async subscribeToTopic(topic) {
    if (!this.token) {
      console.warn('No FCM token available for topic subscription');
      return false;
    }

    try {
      // Call Cloud Function to subscribe token to topic
      const response = await fetch(this.subscribeToTopicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: this.token,
          topic: topic
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`Subscribed to topic: ${topic}`);
        
        // Also store subscription in Firestore for tracking
        const userId = localStorage.getItem('campuscareRoll');
        if (userId) {
          const db = firebase.firestore();
          await db.collection('topic_subscriptions').doc(`${userId}_${topic}`).set({
            userId: userId,
            topic: topic,
            token: this.token,
            subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        
        return true;
      } else {
        console.error(`Failed to subscribe to topic ${topic}:`, result.error);
        return false;
      }
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Set up token refresh listener
   */
  setupTokenRefreshListener() {
    // Note: onTokenRefresh is deprecated in Firebase v9+
    // Token refresh is now handled automatically by the SDK
    // If you need to handle token refresh, use getToken() periodically
    console.log('Token refresh listener setup (handled automatically by Firebase SDK)');
  }

  /**
   * Set up foreground message listener
   */
  setupForegroundMessageListener() {
    messaging.onMessage((payload) => {
      console.log('Foreground message received:', payload);
      
      // Show custom notification for foreground messages
      this.showCustomNotification(payload);
    });
  }

  /**
   * Show custom notification when app is in foreground
   */
  showCustomNotification(payload) {
    const { title, body, icon } = payload.notification || {};
    
    // Create custom notification element
    const notification = document.createElement('div');
    notification.className = 'fcm-notification';
    notification.innerHTML = `
      <div class="fcm-notification__content">
        <div class="fcm-notification__header">
          <span class="material-symbols-outlined">notifications</span>
          <strong>${title || 'CampusCare Notification'}</strong>
          <button class="fcm-notification__close">&times;</button>
        </div>
        <div class="fcm-notification__body">${body || 'New notification received'}</div>
      </div>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 350px;
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .fcm-notification__header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .fcm-notification__close {
        margin-left: auto;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.fcm-notification__close');
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });
  }

  /**
   * Send notification to all users (admin only)
   * Requires Firebase Cloud Functions to be deployed
   */
  async sendNotificationToAll(title, body, data = {}) {
    try {
      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          data
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('Notification sent successfully via Cloud Functions:', result);
        return { success: true, messageId: result.messageId };
      } else {
        console.error('Failed to send notification via Cloud Functions:', result);
        return { success: false, error: result.error || 'Unknown error occurred' };
      }
    } catch (error) {
      console.error('Error sending notification via Cloud Functions:', error);
      return { 
        success: false, 
        error: `Cloud Functions not available or not deployed. Please deploy Firebase Cloud Functions first. Error: ${error.message}` 
      };
    }
  }

  /**
   * Send targeted notification to specific users
   */
  async sendTargetedNotification(title, body, userIds, data = {}) {
    try {
      // Get tokens for specified users
      const db = firebase.firestore();
      const tokens = [];
      
      for (const userId of userIds) {
        const tokenDoc = await db.collection('fcm_tokens').doc(userId).get();
        if (tokenDoc.exists) {
          tokens.push(tokenDoc.data().token);
        }
      }

      if (tokens.length === 0) {
        return { success: false, error: 'No valid tokens found for specified users' };
      }

      const response = await fetch(this.targetedFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          tokens,
          data
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Targeted notification sent successfully:', result);
        return { 
          success: true, 
          successCount: result.successCount,
          failureCount: result.failureCount 
        };
      } else {
        console.error('Failed to send targeted notification:', result);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error sending targeted notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current FCM token
   */
  getCurrentToken() {
    return this.token || localStorage.getItem('fcmToken');
  }

  /**
   * Check if notifications are supported and enabled
   */
  isNotificationEnabled() {
    return this.isSupported && Notification.permission === 'granted' && this.token;
  }
}

// Create global instance
window.fcmService = new FCMService();

// Export for module usage
export default FCMService;
