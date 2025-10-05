import { firebaseConfig } from "../../assets/js/firebase-Config.js";
import FCMService from "../../assets/js/fcm-service.js";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const ROLE_KEY = 'campuscareRole';
const LOGIN_TS_KEY = 'campuscareLoggedInAt';
const ROLL_KEY = 'campuscareRoll';

const redirectToLogin = () => {
  window.location.href = '../login.html';
};

const ensureAdminSession = () => {
  const storedRole = localStorage.getItem(ROLE_KEY);
  if (storedRole !== 'admin') {
    redirectToLogin();
  }
};

const state = {
  sosUnsubscribe: null,
  incidentsUnsubscribe: null,
  ongoingIncidentsUnsubscribe: null,
};

const elements = {
  logoutBtn: document.getElementById('admin-logout-btn'),
  recentIncidentsCount: document.getElementById('recent-incidents-count'),
  activeSosCount: document.getElementById('active-sos-count'),
  ongoingIncidentsBody: document.getElementById('ongoing-incidents-body'),
  ongoingIncidentsLoading: document.getElementById('ongoing-incidents-loading'),
  ongoingIncidentsError: document.getElementById('ongoing-incidents-error'),
  ongoingIncidentsEmpty: document.getElementById('ongoing-incidents-empty'),
  sosLoading: document.getElementById('sos-loading'),
  sosError: document.getElementById('sos-error'),
  sosEmpty: document.getElementById('sos-empty'),
  sosContainer: document.getElementById('sos-requests-container'),
  // Broadcast elements
  sendNotificationBtn: document.getElementById('send-notification-btn'),
  notificationModal: document.getElementById('notification-modal'),
  notificationModalClose: document.getElementById('notification-modal-close'),
  notificationModalCancel: document.getElementById('notification-modal-cancel'),
  notificationModalForm: document.getElementById('notification-modal-form'),
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) {
    return "Time unknown";
  }

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  return date.toLocaleString();
};

const buildLocationLabel = (location) => {
  if (!location) {
    return "Location: not shared";
  }

  const { latitude, longitude, accuracy } = location;
  if (latitude && longitude) {
    const accuracyText = accuracy ? ` (±${Math.round(accuracy)}m)` : "";
    return `Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracyText}`;
  }

  return "Location: provided";
};

const readInputValue = (selector) => {
  const el = document.querySelector(selector);
  return el ? el.value.trim() : '';
};

const setTextContent = (el, text) => {
  if (el) {
    el.textContent = text;
  }
};

const getIncidentStatusMeta = (status) => {
  const normalized = (status || 'pending').toLowerCase();
  if (normalized === 'ongoing') {
    return { label: 'Ongoing', pillClass: 'status-pill status-pill--ongoing' };
  }
  if (normalized === 'resolved') {
    return { label: 'Resolved', pillClass: 'status-pill status-pill--resolved' };
  }
  return { label: 'Active', pillClass: 'status-pill status-pill--active' };
};

const setOngoingIncidentsState = ({ loading = false, error = null, empty = false }) => {
  setElementVisible(elements.ongoingIncidentsLoading, loading);
  setElementVisible(elements.ongoingIncidentsError, Boolean(error));
  setElementVisible(elements.ongoingIncidentsEmpty, empty && !loading && !error);

  if (error && elements.ongoingIncidentsError) {
    elements.ongoingIncidentsError.textContent = error;
  }
};

const renderOngoingIncidents = (incidents) => {
  if (!elements.ongoingIncidentsBody) {
    return;
  }

  elements.ongoingIncidentsBody.innerHTML = '';

  incidents.forEach((incident) => {
    const row = document.createElement('tr');

    const idTd = document.createElement('td');
    idTd.textContent = incident.incidentId;

    const typeTd = document.createElement('td');
    typeTd.textContent = incident.type;

    const locationTd = document.createElement('td');
    locationTd.textContent = incident.location;

    const reportedTd = document.createElement('td');
    reportedTd.textContent = incident.reportedBy;

    const statusTd = document.createElement('td');
    const { label, pillClass } = getIncidentStatusMeta(incident.status);
    const statusPill = document.createElement('span');
    statusPill.className = pillClass;
    statusPill.textContent = label;
    statusTd.appendChild(statusPill);

    row.appendChild(idTd);
    row.appendChild(typeTd);
    row.appendChild(locationTd);
    row.appendChild(reportedTd);
    row.appendChild(statusTd);

    elements.ongoingIncidentsBody.appendChild(row);
  });
};

const listenForRecentIncidents = () => {
  if (!elements.recentIncidentsCount) {
    return;
  }

  setTextContent(elements.recentIncidentsCount, '…');

  const thirtyDaysAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoTs = firebase.firestore.Timestamp.fromDate(thirtyDaysAgoDate);

  try {
    if (state.incidentsUnsubscribe) {
      state.incidentsUnsubscribe();
    }

    state.incidentsUnsubscribe = db
      .collection('incidents')
      .where('createdAt', '>=', thirtyDaysAgoTs)
      .onSnapshot(
        (snapshot) => {
          const count = snapshot ? snapshot.size : 0;
          setTextContent(elements.recentIncidentsCount, count.toString());
        },
        (error) => {
          console.error('Error fetching recent incidents:', error);
          setTextContent(elements.recentIncidentsCount, '—');
        }
      );
  } catch (error) {
    console.error('Error setting up recent incidents listener:', error);
    setTextContent(elements.recentIncidentsCount, '—');
  }
};

const listenForOngoingIncidents = () => {
  if (!elements.ongoingIncidentsBody) {
    return;
  }

  setOngoingIncidentsState({ loading: true, error: null, empty: false });

  if (state.ongoingIncidentsUnsubscribe) {
    state.ongoingIncidentsUnsubscribe();
  }

  try {
    state.ongoingIncidentsUnsubscribe = db
      .collection('incidents')
      .orderBy('createdAt', 'desc')
      .limit(25)
      .onSnapshot(
        (snapshot) => {
          const incidents = snapshot.docs
            .map((doc) => {
              const data = doc.data();
              return {
                incidentId: data.incidentId || data.id || doc.id,
                type: data.type || '—',
                location: data.location || '—',
                reportedBy: data.userId || data.reportedBy || '—',
                status: (data.status || 'pending').toLowerCase(),
              };
            })
            .filter((incident) => {
              const status = incident.status;
              return status === 'pending' || status === 'active' || status === 'ongoing';
            });

          renderOngoingIncidents(incidents);
          setOngoingIncidentsState({ loading: false, error: null, empty: incidents.length === 0 });
        },
        (error) => {
          console.error('Error loading ongoing incidents:', error);
          if (elements.ongoingIncidentsBody) {
            elements.ongoingIncidentsBody.innerHTML = '';
          }
          setOngoingIncidentsState({ loading: false, error: 'Failed to load incidents.' });
        }
      );
  } catch (error) {
    console.error('Error setting up ongoing incidents listener:', error);
    setOngoingIncidentsState({ loading: false, error: 'Unable to load incidents.' });
  }
};

const setElementVisible = (el, visible) => {
  if (!el) return;
  el.style.display = visible ? '' : 'none';
};

const renderSosRequests = (requests) => {
  if (!elements.sosContainer) {
    return;
  }

  elements.sosContainer.innerHTML = '';

  requests.forEach((request) => {
    const item = document.createElement('div');
    item.className = 'sos-item';

    const details = document.createElement('div');
    details.className = 'sos-item__details';
    const statusEl = document.createElement('p');
    statusEl.className = 'sos-item__status';
    statusEl.textContent = request.statusLabel;

    const timeEl = document.createElement('p');
    timeEl.className = 'sos-item__time';
    timeEl.textContent = request.timeLabel;

    const locationEl = document.createElement('p');
    locationEl.className = 'sos-item__location';
    locationEl.textContent = request.locationLabel;

    details.appendChild(statusEl);
    details.appendChild(timeEl);
    details.appendChild(locationEl);

    item.appendChild(details);
    elements.sosContainer.appendChild(item);
  });
};

const normalizeSosStatus = (status) => {
  const normalized = (status || 'pending').toLowerCase();
  if (normalized === 'handled') return 'handled';
  if (normalized === 'ongoing') return 'ongoing';
  if (normalized === 'active') return 'active';
  return 'pending';
};

const updateSosState = (requests, errorMessage) => {
  const isLoading = !requests && !errorMessage;
  const hasError = Boolean(errorMessage);
  const filteredRequests = Array.isArray(requests)
    ? requests.filter((req) => {
        const status = normalizeSosStatus(req.status);
        return status === 'pending' || status === 'ongoing' || status === 'active';
      })
    : [];
  const hasRequests = filteredRequests.length > 0;

  setElementVisible(elements.sosLoading, isLoading);
  setElementVisible(elements.sosError, hasError);
  setElementVisible(elements.sosEmpty, !isLoading && !hasError && !hasRequests);
  if (hasError) {
    setTextContent(elements.sosError, errorMessage);
  }

  if (hasRequests) {
    renderSosRequests(filteredRequests);
  } else {
    if (elements.sosContainer) {
      elements.sosContainer.innerHTML = '';
    }
  }

  const activeCount = filteredRequests.length;
  setTextContent(elements.activeSosCount, activeCount.toString());
};

const listenForSosRequests = () => {
  updateSosState(null, null);

  try {
    state.sosUnsubscribe = db
      .collection('sosRequests')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          const requests = snapshot.docs.map((doc) => {
            const data = doc.data();
            const status = normalizeSosStatus(data.status);
            return {
              id: doc.id,
              status,
              statusLabel:
                status === 'pending'
                  ? 'Waiting for response'
                  : status === 'handled'
                  ? 'Handled'
                  : status.charAt(0).toUpperCase() + status.slice(1),
              timeLabel: formatTimeAgo(data.createdAt),
              locationLabel: buildLocationLabel(data.location),
            };
          });

          updateSosState(requests, null);
        },
        (error) => {
          console.error('Error fetching SOS requests:', error);
          updateSosState([], 'Failed to load SOS requests. Please try again.');
        }
      );
  } catch (error) {
    console.error('Error setting up SOS listener:', error);
    updateSosState([], 'Unable to listen for SOS requests.');
  }
};

const handleLogout = () => {
  if (!elements.logoutBtn) {
    return;
  }

  elements.logoutBtn.disabled = true;
  elements.logoutBtn.classList.add('is-loading');
  try {
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(LOGIN_TS_KEY);
    localStorage.removeItem(ROLL_KEY);
  } finally {
    redirectToLogin();
  }
};

const setupEventListeners = () => {
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', handleLogout);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !state.sosUnsubscribe) {
      listenForSosRequests();
    }
    if (document.visibilityState === 'visible' && !state.incidentsUnsubscribe) {
      listenForRecentIncidents();
    }
    if (document.visibilityState === 'visible' && !state.ongoingIncidentsUnsubscribe) {
      listenForOngoingIncidents();
    }
  });
};

// Notification Management Functions
const showNotificationModal = () => {
  if (elements.notificationModal) {
    elements.notificationModal.style.display = 'flex';
  }
};

const hideNotificationModal = () => {
  if (elements.notificationModal) {
    elements.notificationModal.style.display = 'none';
  }
};


const sendPushNotification = async (title, body, type, clickAction) => {
  try {
    const data = {
      type: type,
      timestamp: new Date().toISOString(),
      sender: localStorage.getItem(ROLL_KEY) || 'admin'
    };

    if (clickAction) {
      data.click_action = clickAction;
    }

    // Send the push notification
    const result = await window.fcmService.sendNotificationToAll(title, body, data);
    
    if (result.success) {
      // Store in alerts collection for history
      try {
        const alertDoc = {
          title: title,
          message: body,
          type: type,
          clickAction: clickAction || '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: localStorage.getItem(ROLL_KEY) || localStorage.getItem(ROLE_KEY) || 'admin',
          messageId: result.messageId,
          status: 'broadcast_sent'
        };

        await db.collection('alerts').add(alertDoc);
        console.log('Broadcast stored in alerts collection');
      } catch (dbError) {
        console.warn('Failed to store broadcast in alerts:', dbError);
      }

      console.log('Push notification sent successfully:', result);
      return { success: true, messageId: result.messageId };
    } else {
      console.error('Failed to send push notification:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
};


const setupNotificationEventListeners = () => {
  // Send notification button
  if (elements.sendNotificationBtn) {
    elements.sendNotificationBtn.addEventListener('click', showNotificationModal);
  }

  // Modal close buttons
  if (elements.notificationModalClose) {
    elements.notificationModalClose.addEventListener('click', hideNotificationModal);
  }

  if (elements.notificationModalCancel) {
    elements.notificationModalCancel.addEventListener('click', hideNotificationModal);
  }

  // Modal overlay clicks
  if (elements.notificationModal) {
    elements.notificationModal.addEventListener('click', (event) => {
      if (event.target === elements.notificationModal) {
        hideNotificationModal();
      }
    });
  }

  // Notification form submission
  if (elements.notificationModalForm) {
    elements.notificationModalForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const title = document.getElementById('notification-title').value.trim();
      const body = document.getElementById('notification-body').value.trim();
      const type = document.getElementById('notification-type').value;
      const clickAction = '';

      if (!title || !body) {
        alert('Please provide both a title and message for the notification.');
        return;
      }

      // Disable submit button
      const submitBtn = document.getElementById('notification-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('is-loading');
        const label = submitBtn.querySelector('.modal-submit__label');
        if (label) {
          label.textContent = 'Sending…';
        }
        const icon = submitBtn.querySelector('.material-symbols-outlined');
        if (icon) {
          icon.textContent = 'hourglass_empty';
        }
      }

      try {
        const result = await sendPushNotification(title, body, type, clickAction);
        
        if (result.success) {
          alert('Broadcast message sent successfully to all users!');
          hideNotificationModal();
          
          // Clear form
          document.getElementById('notification-title').value = '';
          document.getElementById('notification-body').value = '';
          document.getElementById('notification-type').value = 'general';
        } else {
          alert(`Failed to send broadcast: ${result.error}`);
        }
      } catch (error) {
        console.error('Error sending notification:', error);
        alert('An error occurred while sending the notification. Please try again.');
      } finally {
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
          const label = submitBtn.querySelector('.modal-submit__label');
          if (label) {
            label.textContent = 'Broadcast to All Users';
          }
          const icon = submitBtn.querySelector('.material-symbols-outlined');
          if (icon) {
            icon.textContent = 'campaign';
          }
        }
      }
    });
  }
};

const initializeFCM = async () => {
  try {
    if (window.fcmService) {
      await window.fcmService.initialize();
      console.log('FCM service initialized for admin dashboard');
    }
  } catch (error) {
    console.warn('FCM initialization failed in admin dashboard:', error);
  }
};

const init = () => {
  ensureAdminSession();
  setupEventListeners();
  setupNotificationEventListeners();
  listenForSosRequests();
  listenForRecentIncidents();
  listenForOngoingIncidents();
  initializeFCM();
};

window.addEventListener('DOMContentLoaded', init);