# 🛡️ CampusCare - Intelligent Campus Safety Platform

A real-time campus safety alert system built to protect every student. CampusCare connects students and campus safety teams through instant SOS alerts, incident reporting, and comprehensive monitoring dashboards.

## ✨ Features

- **🚨 Instant SOS Alerts** - One-tap emergency alerts with real-time location sharing
- **📊 Real-time Dashboard** - Monitor all incidents and alerts in one place
- **📱 Mobile Responsive** - Optimized for all devices (375px - desktop)
- **🔔 Push Notifications** - Firebase Cloud Messaging for instant alerts
- **👥 User & Admin Roles** - Separate interfaces for students and administrators
- **📍 Location Tracking** - Precise geolocation for emergency responses
- **📈 Incident Management** - Track, update, and resolve incidents efficiently
- **🌙 24/7 Monitoring** - Continuous safety coverage day and night


## 🛠️ Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom styling with CSS variables
- **JavaScript (ES6+)** - Modern vanilla JS
- **Material Symbols** - Google's icon library

### Backend
- **Firebase Firestore** - NoSQL database
- **Firebase Cloud Functions** - Serverless backend
- **Firebase Cloud Messaging (FCM)** - Push notifications
- **Firebase Authentication** - User authentication (ready)

### Deployment
- **Firebase** - Backend services

## 📋 Prerequisites

Before you begin, ensure you have:

- Node.js (v16 or higher)
- npm or yarn
- Firebase account
- Vercel account (for deployment)
- Git

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Meet-6226/CampusCare.git
cd CampusCare
```

### 2. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Firestore Database
4. Enable Cloud Messaging
5. Register a web app

#### Configure Firebase
1. Copy your Firebase config from Project Settings
2. Update `assets/js/firebase-Config.js`:

```javascript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

3. Update `firebase-messaging-sw.js` with the same config

#### Setup Firestore Database

Create the following collections:

**users**
```javascript
{
  RollNo: "string or number",
  password: "string",
  type: "user" or "admin",
  name: "string",
  email: "string"
}
```

**incidents**
```javascript
{
  type: "string",
  description: "string",
  location: "string",
  status: "pending" | "ongoing" | "resolved",
  reportedBy: "string",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**sosRequests**
```javascript
{
  requestId: "string",
  displayId: number,
  status: "pending" | "ongoing" | "handled",
  reportedBy: "string",
  location: {
    latitude: number,
    longitude: number,
    accuracy: number,
    address: "string"
  },
  createdAt: timestamp,
  handledAt: timestamp (optional)
}
```

**alerts**
```javascript
{
  title: "string",
  message: "string",
  type: "emergency" | "warning" | "info",
  createdAt: timestamp,
  sentBy: "string"
}
```

#### Deploy Firebase Functions

```bash
cd functions
npm install
firebase login
firebase init functions
firebase deploy --only functions
```

### 3. FCM Setup (Push Notifications)

1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Generate a new Web Push certificate (VAPID key)
3. Copy the key pair
4. Update `assets/js/fcm-service.js` with your VAPID key:

```javascript
const vapidKey = 'YOUR_VAPID_KEY_HERE';
```

5. Enable Cloud Messaging API in Google Cloud Console


## 📁 Project Structure

```
campuscare/
├── admin/                      # Admin dashboard
│   ├── admin-dashboard.html
│   ├── incidents.html
│   ├── alerts.html
│   ├── sos-requests.html
│   └── js/
│       ├── admin-dashboard.js
│       ├── incidents.js
│       ├── alerts.js
│       └── sos-requests.js
├── user/                       # User dashboard
│   ├── user-dashboard.html
│   ├── user-incidents.html
│   └── js/
│       ├── user-dashboard.js
│       └── user-incidents.js
├── assets/
│   ├── css/
│   │   ├── index.css          # Landing page styles
│   │   ├── login.css          # Login page styles
│   │   ├── user-dashboard.css # User dashboard styles
│   │   └── admin-dashboard.css
│   └── js/
│       ├── firebase-Config.js  # Firebase configuration
│       ├── fcm-service.js      # Push notification service
│       └── login.js            # Login logic
├── functions/                  # Firebase Cloud Functions
│   ├── index.js               # Cloud Functions code
│   └── package.json
├── index.html                 # Landing page
├── login.html                 # Login page
├── firebase-messaging-sw.js   # Service worker for FCM
├── vercel.json               # Vercel configuration
├── .gitignore
└── README.md
```

## 🔐 Default Login Credentials

Create test users in Firestore:

**Student Account**
```
Roll Number: 2021001
Password: student123
Type: user
```

**Admin Account**
```
Roll Number: admin
Password: admin123
Type: admin
```

## 🎨 Customization

### Branding
- Update colors in CSS variables (`assets/css/index.css`)
- Replace logo/icons in HTML files
- Modify text content in HTML files

### Features
- Add new incident types in `user/js/user-dashboard.js`
- Customize alert templates in `admin/js/alerts.js`
- Modify dashboard metrics in respective JS files

## 📱 Mobile Optimization

The application is fully responsive with breakpoints at:
- **375px** - Small phones (iPhone SE)
- **480px** - Standard phones
- **600px** - Large phones
- **768px** - Tablets
- **1024px** - Small desktops

## 🔔 Push Notifications

### Testing Notifications
1. Allow notifications when prompted
2. Token will be saved to Firestore
3. Send test notification from Admin → Alerts
4. Check browser notifications

### Troubleshooting
- Ensure HTTPS (required for FCM)
- Check browser notification permissions
- Verify VAPID key is correct
- Check service worker registration


## Troubleshooting

### Firebase Connection Issues
- Verify Firebase config is correct
- Check Firestore rules allow read/write
- Ensure Firebase project is active

### Notifications Not Working
- HTTPS is required for FCM
- Check browser notification permissions
- Verify service worker is registered
- Check VAPID key configuration

### Login Issues
- Verify user exists in Firestore
- Check password matches exactly
- Ensure `type` field is set correctly

- Firebase for backend infrastructure
- Vercel for hosting
- Material Symbols for icons
- Google Fonts for typography
- 

**Built with ❤️ for Campus Safety**