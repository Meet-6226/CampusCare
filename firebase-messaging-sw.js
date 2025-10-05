// Firebase Messaging Service Worker
// This file handles background push notifications

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC0GDBzC9BtxMTAXexj7aref4pUoApiQ-A",
  authDomain: "exam-223d0.firebaseapp.com",
  projectId: "exam-223d0",
  storageBucket: "exam-223d0.firebasestorage.app",
  messagingSenderId: "87768184923",
  appId: "1:87768184923:web:63fce38e8706c552aca77e",
  measurementId: "G-VSLKHNLD9B"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'CampusCare Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/favicon.ico',
    badge: payload.notification?.badge || '/favicon.ico',
    tag: 'campuscare-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open CampusCare',
        icon: '/favicon.ico'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/favicon.ico'
      }
    ],
    data: {
      ...payload.data,
      click_action: payload.data?.click_action || '/',
      timestamp: new Date().toISOString()
    }
  };

  // Show the notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Handle notification click
  const clickAction = event.notification.data?.click_action || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if CampusCare is already open
      for (const client of clientList) {
        if (client.url.includes('campuscare') || client.url.includes('exam')) {
          client.focus();
          if (clickAction !== '/') {
            client.navigate(clickAction);
          }
          return;
        }
      }
      // Open new window if not already open
      return clients.openWindow(clickAction);
    })
  );
});

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  // Optional: Track notification dismissal analytics
  // You can send this data to your analytics service
});

// Handle push events (additional layer for custom handling)
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('Push payload:', payload);
      
      // Custom handling for specific notification types
      if (payload.data?.type === 'emergency') {
        // Handle emergency notifications with higher priority
        const notificationOptions = {
          body: payload.notification?.body || 'Emergency Alert',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'emergency-alert',
          requireInteraction: true,
          silent: false,
          vibrate: [200, 100, 200, 100, 200],
          actions: [
            {
              action: 'acknowledge',
              title: 'Acknowledge',
              icon: '/favicon.ico'
            }
          ],
          data: payload.data
        };
        
        event.waitUntil(
          self.registration.showNotification(
            payload.notification?.title || 'Emergency Alert',
            notificationOptions
          )
        );
      }
    } catch (error) {
      console.error('Error parsing push payload:', error);
    }
  }
});

// Service worker installation
self.addEventListener('install', (event) => {
  console.log('Firebase Messaging Service Worker installed');
  self.skipWaiting();
});

// Service worker activation
self.addEventListener('activate', (event) => {
  console.log('Firebase Messaging Service Worker activated');
  event.waitUntil(self.clients.claim());
});
