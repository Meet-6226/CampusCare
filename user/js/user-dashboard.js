import { firebaseConfig } from "../../assets/js/firebase-Config.js";
import FCMService from "../../assets/js/fcm-service.js";

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

async function getNextSosId(db) {
    try {
        const sosRef = db.collection('sosRequests');
        const snapshot = await sosRef.orderBy('requestId', 'desc').limit(1).get();

        if (snapshot.empty) {
            return 1001;
        }

        const latestData = snapshot.docs[0].data();
        const rawId = latestData?.requestId;
        const latestId = typeof rawId === 'number' ? rawId : parseInt(rawId, 10);
        if (Number.isFinite(latestId)) {
            return latestId + 1;
        }
    } catch (error) {
        console.warn('Unable to determine latest SOS ID, defaulting to seed.', error);
    }

    return 1001;
}

async function getNextIncidentId(db) {
    const incidentsRef = db.collection('incidents');
    const snapshot = await incidentsRef
        .orderBy('incidentId', 'desc')
        .limit(1)
        .get();

    if (snapshot.empty) {
        return '10001';
    }

    const latestData = snapshot.docs[0].data();
    const latestId = Number(latestData?.incidentId) || 10000;
    return String(latestId + 1).padStart(5, '0');
}

export async function reportIssue(issueData) {
    const db = firebase.firestore();
    const incidentsRef = db.collection('incidents');
    const incidentId = await getNextIncidentId(db);
    return await incidentsRef.add({
        ...issueData,
        incidentId,
    });
}

const reportForm = document.getElementById('report-issue-form');
const submitIssueBtn = document.getElementById('submit-issue-btn');
const sosButton = document.getElementById('sos-button');
const userLogoutBtn = document.getElementById('user-logout-btn');

function redirectToLogin() {
    window.location.href = '../login.html';
}

function ensureUserSession() {
    const storedRole = localStorage.getItem('campuscareRole');
    if (storedRole !== 'user') {
        redirectToLogin();
    }
}

ensureUserSession();

if (userLogoutBtn) {
    const handleLogoutClick = async () => {
        if (userLogoutBtn.disabled) {
            return;
        }

        try {
            userLogoutBtn.disabled = true;
            userLogoutBtn.classList.add('is-loading');

            localStorage.removeItem('campuscareRole');
            localStorage.removeItem('campuscareLoggedInAt');
            localStorage.removeItem('campuscareRoll');
            window.location.href = '../login.html';
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            userLogoutBtn.disabled = false;
            userLogoutBtn.classList.remove('is-loading');
        }
    };

    userLogoutBtn.addEventListener('click', handleLogoutClick);
}

if (reportForm) {
    reportForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const typeSelect = document.getElementById('issue-type');
        const descriptionInput = document.getElementById('description');
        const locationInput = document.getElementById('location');

        if (!typeSelect || !descriptionInput || !locationInput) {
            console.error('Report issue form fields are missing.');
            return;
        }

        const storedRoll = localStorage.getItem('campuscareRoll');
        const parsedRoll = storedRoll && !Number.isNaN(Number(storedRoll)) ? Number(storedRoll) : storedRoll || null;

        const issueData = {
            type: typeSelect.value?.trim() || 'Other',
            description: descriptionInput.value.trim(),
            location: locationInput.value.trim(),
            reportedBy: parsedRoll,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        if (!issueData.description || !issueData.location) {
            console.warn('Please fill in all required fields before submitting.');
            return;
        }

        try {
            if (submitIssueBtn) {
                submitIssueBtn.disabled = true;
            }

            await reportIssue(issueData);
            console.log('Issue reported successfully!');

            reportForm.reset();
            closeReportModal();
            openReportSuccessModal();
        } catch (error) {
            console.error('Error reporting issue:', error);
        } finally {
            if (submitIssueBtn) {
                submitIssueBtn.disabled = false;
            }
        }
    });
}

export async function getIncidents() {
    try {
        const db = firebase.firestore();
        const incidentsRef = db.collection('incidents');
        const snapshot = await incidentsRef.get();
        const incidents = snapshot.docs.map((doc) => doc.data());
        return incidents;
    } catch (error) {
        console.error('Error fetching incidents:', error);
        return [];
    }
}

async function getUserLocation() {
    if (!('geolocation' in navigator)) {
        return null;
    }

    return await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                resolve({ latitude, longitude, accuracy });
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
}

export async function emergencySOS(payload = {}) {
    const db = firebase.firestore();
    const sosRequestsRef = db.collection('sosRequests');
    const nextId = await getNextSosId(db);
    return await sosRequestsRef.add({
        status: 'pending',
        source: 'user-dashboard',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        requestId: nextId,
        ...payload,
    });
}

// SOS Success Modal Functions
function openSosSuccessModal() {
    const sosSuccessModal = document.getElementById('sos-success-modal');
    if (sosSuccessModal) {
        sosSuccessModal.classList.remove('hidden');
        sosSuccessModal.classList.add('flex');
        document.body.classList.add('modal-open');
    }
}

function closeSosSuccessModal() {
    const sosSuccessModal = document.getElementById('sos-success-modal');
    if (sosSuccessModal) {
        sosSuccessModal.classList.add('hidden');
        sosSuccessModal.classList.remove('flex');
        document.body.classList.remove('modal-open');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const sosSuccessModal = document.getElementById('sos-success-modal');
    const closeSosModalBtn = document.getElementById('close-sos-modal-btn');

    if (closeSosModalBtn) {
        closeSosModalBtn.addEventListener('click', closeSosSuccessModal);
    }

    if (sosSuccessModal) {
        sosSuccessModal.addEventListener('click', (event) => {
            if (event.target === sosSuccessModal) {
                closeSosSuccessModal();
            }
        });
    }
});

if (sosButton) {
    sosButton.addEventListener('click', async () => {
        if (sosButton.disabled) {
            return;
        }

        try {
            sosButton.disabled = true;
            sosButton.classList.add('is-loading');

            const location = await getUserLocation();

            const payload = {};
            if (location) {
                payload.location = location;
            }

            const storedRoll = localStorage.getItem('campuscareRoll');
            const parsedRoll = storedRoll && !Number.isNaN(Number(storedRoll)) ? Number(storedRoll) : storedRoll || null;
            if (parsedRoll) {
                payload.reportedBy = parsedRoll;
            }

            await emergencySOS(payload);
            console.log('Emergency SOS request sent successfully.');
            
            // Show success modal
            openSosSuccessModal();
        } catch (error) {
            console.error('Error sending SOS request:', error);
            alert('Failed to send SOS alert. Please try again.');
        } finally {
            sosButton.disabled = false;
            sosButton.classList.remove('is-loading');
        }
    });
}

const reportIssueBtn = document.getElementById('report-issue-btn');
const reportModal = document.getElementById('report-issue-modal');
const closeReportModalBtn = document.getElementById('close-modal-btn');
const reportSuccessModal = document.getElementById('report-success-modal');
const closeReportSuccessBtn = document.getElementById('close-report-success-btn');

function closeReportModal() {
    if (reportModal) {
        reportModal.classList.add('hidden');
        reportModal.classList.remove('flex');
        document.body.classList.remove('modal-open');
    }
}

function openReportModal() {
    if (reportModal) {
        reportModal.classList.remove('hidden');
        reportModal.classList.add('flex');
        document.body.classList.add('modal-open');
    }
}

function openReportSuccessModal() {
    if (reportSuccessModal) {
        reportSuccessModal.classList.remove('hidden');
        reportSuccessModal.classList.add('flex');
        document.body.classList.add('modal-open');
    }
}

function closeReportSuccessModal() {
    if (reportSuccessModal) {
        reportSuccessModal.classList.add('hidden');
        reportSuccessModal.classList.remove('flex');
        document.body.classList.remove('modal-open');
    }
}

if (reportIssueBtn && reportModal && closeReportModalBtn) {
    reportIssueBtn.addEventListener('click', openReportModal);
    closeReportModalBtn.addEventListener('click', closeReportModal);

    reportModal.addEventListener('click', (event) => {
        if (event.target === reportModal) {
            closeReportModal();
        }
    });
}

if (reportSuccessModal) {
    reportSuccessModal.addEventListener('click', (event) => {
        if (event.target === reportSuccessModal) {
            closeReportSuccessModal();
        }
    });
}

if (closeReportSuccessBtn) {
    closeReportSuccessBtn.addEventListener('click', closeReportSuccessModal);
}

const detailsModal = document.getElementById('issue-details-modal');

function closeDetailsModal() {
    if (detailsModal) {
        detailsModal.classList.add('hidden');
        detailsModal.classList.remove('flex');
        document.body.classList.remove('modal-open');
    }
}

function openDetailsModal() {
    if (detailsModal) {
        detailsModal.classList.remove('hidden');
        detailsModal.classList.add('flex');
        document.body.classList.add('modal-open');
    }
}

if (detailsModal) {
    detailsModal.addEventListener('click', (event) => {
        // Close modal if clicking on backdrop (not on modal panel)
        if (event.target === detailsModal) {
            closeDetailsModal();
        }
    });
}

// Fetch and display ongoing incidents
async function loadOngoingIncidents() {
    const issueListContainer = document.querySelector('.issue-list');
    
    if (!issueListContainer) {
        return;
    }

    // Show loading state
    issueListContainer.innerHTML = '<div class="issue-card"><p>Loading incidents...</p></div>';

    try {
        const db = firebase.firestore();
        const incidentsRef = db.collection('incidents');
        const snapshot = await incidentsRef
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        if (snapshot.empty) {
            issueListContainer.innerHTML = '<div class="issue-card"><p>No incidents to display.</p></div>';
            return;
        }

        // Filter only active and ongoing incidents
        const activeIncidents = [];
        snapshot.forEach((doc) => {
            const incident = doc.data();
            const status = (incident.status || 'pending').toLowerCase();
            
            // Only include pending, active, or ongoing incidents
            if (status === 'pending' || status === 'active' || status === 'ongoing') {
                activeIncidents.push({ ...incident, id: doc.id });
            }
        });

        if (activeIncidents.length === 0) {
            issueListContainer.innerHTML = '<div class="issue-card"><p>No active incidents at the moment.</p></div>';
            return;
        }

        issueListContainer.innerHTML = '';

        // Limit to 10 most recent active incidents
        activeIncidents.slice(0, 10).forEach((incident) => {
            const incidentCard = createIncidentCard(incident, incident.id);
            issueListContainer.appendChild(incidentCard);
        });

        // Attach event listeners to view details buttons
        attachDetailsButtonListeners();
    } catch (error) {
        console.error('Error loading incidents:', error);
        issueListContainer.innerHTML = '<div class="issue-card"><p style="color: var(--badge-red-text);">Error loading incidents. Please try again.</p></div>';
    }
}

function createIncidentCard(incident, docId) {
    const article = document.createElement('article');
    article.className = 'issue-card';
    article.dataset.incidentId = docId;

    const status = incident.status || 'pending';
    const badgeClass = status === 'resolved' ? 'issue-badge--resolved' : 
                       status === 'ongoing' ? 'issue-badge--progress' : 
                       'issue-badge--new';
    const badgeText = status === 'resolved' ? 'Resolved' : 
                      status === 'ongoing' ? 'In Progress' : 
                      'New';

    const createdAt = incident.createdAt?.toDate ? incident.createdAt.toDate() : new Date();
    const timeAgo = getTimeAgo(createdAt);

    article.innerHTML = `
        <div class="issue-card__header">
            <h3 class="issue-card__title">${escapeHtml(incident.type || 'Incident')}</h3>
            <span class="issue-badge ${badgeClass}">${badgeText}</span>
        </div>
        <p class="issue-card__description">${escapeHtml(incident.description || 'No description available.')}</p>
        <div class="issue-card__footer">
            <p>${escapeHtml(incident.location || 'Location not specified')} • ${timeAgo}</p>
            <button class="details-link view-details-btn" data-incident-id="${docId}">View Details</button>
        </div>
    `;

    return article;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

function attachDetailsButtonListeners() {
    const viewDetailsBtns = document.querySelectorAll('.view-details-btn');
    
    viewDetailsBtns.forEach((btn) => {
        btn.addEventListener('click', async () => {
            const incidentId = btn.dataset.incidentId;
            if (incidentId) {
                await loadIncidentDetails(incidentId);
            }
            openDetailsModal();
        });
    });
}

async function loadIncidentDetails(incidentId) {
    if (!detailsModal) return;

    try {
        const db = firebase.firestore();
        const incidentDoc = await db.collection('incidents').doc(incidentId).get();

        if (!incidentDoc.exists) {
            console.error('Incident not found');
            return;
        }

        const incident = incidentDoc.data();
        updateDetailsModal(incident, incidentId);
    } catch (error) {
        console.error('Error loading incident details:', error);
    }
}

function updateDetailsModal(incident, incidentId) {
    const status = incident.status || 'pending';
    const badgeClass = status === 'resolved' ? 'issue-badge--resolved' : 
                       status === 'ongoing' ? 'issue-badge--progress' : 
                       'issue-badge--new';
    const badgeText = status === 'resolved' ? 'Resolved' : 
                      status === 'ongoing' ? 'In Progress' : 
                      'New';

    const createdAt = incident.createdAt?.toDate ? incident.createdAt.toDate() : new Date();
    const updatedAt = incident.updatedAt?.toDate ? incident.updatedAt.toDate() : createdAt;

    const modalContent = `
        <div class="details-modal__header">
            <div class="details-modal__title">
                <h2 class="modal-title">${escapeHtml(incident.type || 'Incident Details')}</h2>
                <span class="issue-badge ${badgeClass}">${badgeText}</span>
            </div>
            <button class="modal-close details-modal__close" id="close-details-modal-btn" aria-label="Close incident details">
                <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
        </div>

        <div class="details-modal__body">
            <section class="details-section">
                <h3 class="details-section__title">Details</h3>
                <div class="details-grid">
                    <div class="details-meta">
                        <p class="details-meta__label">Incident ID</p>
                        <p class="details-meta__value">${escapeHtml(incident.incidentId || incidentId)}</p>
                    </div>
                    <div class="details-meta">
                        <p class="details-meta__label">Location</p>
                        <p class="details-meta__value">${escapeHtml(incident.location || 'Not specified')}</p>
                    </div>
                    <div class="details-meta">
                        <p class="details-meta__label">Reported By</p>
                        <p class="details-meta__value">${escapeHtml(incident.reportedBy ? String(incident.reportedBy) : 'Anonymous')}</p>
                    </div>
                    <div class="details-meta">
                        <p class="details-meta__label">Status</p>
                        <p class="details-meta__value">${badgeText}</p>
                    </div>
                    <div class="details-meta">
                        <p class="details-meta__label">Created</p>
                        <p class="details-meta__value">${formatDateTime(createdAt)}</p>
                    </div>
                    <div class="details-meta">
                        <p class="details-meta__label">Last Updated</p>
                        <p class="details-meta__value">${formatDateTime(updatedAt)}</p>
                    </div>
                </div>
            </section>

            <section class="details-section details-section--divider">
                <h3 class="details-section__title">Description</h3>
                <p class="details-description">${escapeHtml(incident.description || 'No description available.')}</p>
            </section>

            ${incident.notes ? `
            <section class="details-section details-section--divider">
                <h3 class="details-section__title">Additional Notes</h3>
                <p class="details-description">${escapeHtml(incident.notes)}</p>
            </section>
            ` : ''}

            <section class="details-section details-section--divider">
                <h3 class="details-section__title">History Log</h3>
                ${generateHistoryLog(incident, createdAt, updatedAt)}
            </section>
        </div>
    `;

    const modalPanel = detailsModal.querySelector('.modal-panel');
    if (modalPanel) {
        modalPanel.innerHTML = modalContent;
        
        // Re-attach close button listener
        const newCloseBtn = modalPanel.querySelector('#close-details-modal-btn');
        if (newCloseBtn) {
            newCloseBtn.addEventListener('click', closeDetailsModal);
        }
    }
}

function formatDateTime(date) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    };
    return date.toLocaleDateString('en-US', options);
}

function generateHistoryLog(incident, createdAt, updatedAt) {
    const historyItems = [];
    
    // Add resolved/handled timestamp
    if (incident.resolvedAt) {
        const resolvedDate = incident.resolvedAt.toDate ? incident.resolvedAt.toDate() : new Date(incident.resolvedAt);
        historyItems.push({
            date: resolvedDate,
            text: 'Handled At',
            opacity: 1
        });
    }
    
    // Add ongoing timestamp
    if (incident.ongoingAt) {
        const ongoingDate = incident.ongoingAt.toDate ? incident.ongoingAt.toDate() : new Date(incident.ongoingAt);
        historyItems.push({
            date: ongoingDate,
            text: 'Ongoing At',
            opacity: 0.7
        });
    }
    
    // Add creation timestamp - always show this
    historyItems.push({
        date: createdAt,
        text: 'Created At',
        opacity: 0.4
    });

    // Sort by date descending (newest first)
    historyItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (historyItems.length === 0) return '';

    const historyHTML = historyItems.map(item => `
        <li class="timeline-item">
            <span class="timeline-marker" style="background: rgba(96, 122, 251, ${item.opacity});"></span>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <p style="font-size: 13px; font-weight: 600; color: var(--text-regular); margin: 0;">${item.text}</p>
                <p style="font-size: 14px; color: var(--text-muted); margin: 0;">${formatDateTime(item.date)}</p>
            </div>
        </li>
    `).join('');

    return `
        <div style="border-top: 1px solid var(--primary-border); padding-top: 20px;">
            <h3 class="section-subtitle" style="font-size: 16px; margin-bottom: 16px; color: var(--text-strong);">History Log</h3>
            <ul class="timeline">
                ${historyHTML}
            </ul>
        </div>
    `;
}

// Initialize FCM for user dashboard
const initializeFCM = async () => {
  try {
    if (window.fcmService) {
      await window.fcmService.initialize();
      console.log('FCM service initialized for user dashboard');
    }
  } catch (error) {
    console.warn('FCM initialization failed in user dashboard:', error);
  }
};

// Load incidents when page loads
loadOngoingIncidents();

// Initialize FCM service
initializeFCM();

