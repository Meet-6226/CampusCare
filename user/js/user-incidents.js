import { firebaseConfig } from "../../assets/js/firebase-Config.js";

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
let allIncidents = [];
let currentFilter = 'all';

// Elements
const incidentsList = document.getElementById('incidents-list');
const filterBtns = document.querySelectorAll('.filter-btn');
const userLogoutBtn = document.getElementById('user-logout-btn');
const detailsModal = document.getElementById('incident-details-modal');

// Session management
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

// Logout handler
if (userLogoutBtn) {
    userLogoutBtn.addEventListener('click', async () => {
        if (userLogoutBtn.disabled) return;

        try {
            userLogoutBtn.disabled = true;
            localStorage.removeItem('campuscareRole');
            localStorage.removeItem('campuscareLoggedInAt');
            localStorage.removeItem('campuscareRoll');
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            userLogoutBtn.disabled = false;
        }
    });
}

// Modal functions
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
        if (event.target === detailsModal) {
            closeDetailsModal();
        }
    });
}

// Utility functions
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

// Create incident card
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

// Filter incidents
function filterIncidents(filter) {
    currentFilter = filter;
    
    let filteredIncidents = allIncidents;
    
    if (filter !== 'all') {
        filteredIncidents = allIncidents.filter(incident => {
            const status = (incident.status || 'pending').toLowerCase();
            if (filter === 'active') {
                return status === 'pending' || status === 'active';
            }
            return status === filter;
        });
    }
    
    renderIncidents(filteredIncidents);
}

// Render incidents
function renderIncidents(incidents) {
    if (!incidentsList) return;

    if (incidents.length === 0) {
        incidentsList.innerHTML = '<div class="issue-card"><p>No incidents found for this filter.</p></div>';
        return;
    }

    incidentsList.innerHTML = '';

    incidents.forEach((incident) => {
        const incidentCard = createIncidentCard(incident, incident.id);
        incidentsList.appendChild(incidentCard);
    });

    attachDetailsButtonListeners();
}

// Load incidents from database
async function loadIncidents() {
    if (!incidentsList) return;

    incidentsList.innerHTML = '<div class="issue-card"><p>Loading incidents...</p></div>';

    try {
        const snapshot = await db.collection('incidents')
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            incidentsList.innerHTML = '<div class="issue-card"><p>No incidents to display.</p></div>';
            return;
        }

        allIncidents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        filterIncidents(currentFilter);
    } catch (error) {
        console.error('Error loading incidents:', error);
        incidentsList.innerHTML = '<div class="issue-card"><p style="color: var(--badge-red-text);">Error loading incidents. Please try again.</p></div>';
    }
}

// Attach detail button listeners
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

// Load incident details
async function loadIncidentDetails(incidentId) {
    if (!detailsModal) return;

    try {
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

// Update details modal
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
        <div class="modal-header" style="border-bottom: 1px solid var(--primary-border); padding-bottom: 20px; margin-bottom: 24px;">
            <div style="flex: 1;">
                <h2 class="modal-title" style="margin-bottom: 8px;">${escapeHtml(incident.type || 'Incident Details')}</h2>
                <span class="issue-badge ${badgeClass}">${badgeText}</span>
            </div>
            <button class="modal-close" id="close-details-modal-btn">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 24px;">
            <div>
                <h3 class="section-subtitle" style="font-size: 16px; margin-bottom: 16px; color: var(--text-strong);">Details</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <p style="font-size: 13px; font-weight: 500; color: var(--text-soft); margin: 0;">Incident ID</p>
                        <p style="font-size: 14px; color: var(--text-regular); margin: 0;">${escapeHtml(incident.incidentId || incidentId)}</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <p style="font-size: 13px; font-weight: 500; color: var(--text-soft); margin: 0;">Location</p>
                        <p style="font-size: 14px; color: var(--text-regular); margin: 0;">${escapeHtml(incident.location || 'Not specified')}</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <p style="font-size: 13px; font-weight: 500; color: var(--text-soft); margin: 0;">Reported By</p>
                        <p style="font-size: 14px; color: var(--text-regular); margin: 0;">${escapeHtml(incident.reportedBy ? String(incident.reportedBy) : 'Anonymous')}</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <p style="font-size: 13px; font-weight: 500; color: var(--text-soft); margin: 0;">Status</p>
                        <p style="font-size: 14px; color: var(--text-regular); margin: 0;">${badgeText}</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <p style="font-size: 13px; font-weight: 500; color: var(--text-soft); margin: 0;">Created</p>
                        <p style="font-size: 14px; color: var(--text-regular); margin: 0;">${formatDateTime(createdAt)}</p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <p style="font-size: 13px; font-weight: 500; color: var(--text-soft); margin: 0;">Last Updated</p>
                        <p style="font-size: 14px; color: var(--text-regular); margin: 0;">${formatDateTime(updatedAt)}</p>
                    </div>
                </div>
            </div>
            
            <div style="border-top: 1px solid var(--primary-border); padding-top: 20px;">
                <h3 class="section-subtitle" style="font-size: 16px; margin-bottom: 12px; color: var(--text-strong);">Description</h3>
                <p style="font-size: 14px; line-height: 1.6; color: var(--text-muted); margin: 0;">${escapeHtml(incident.description || 'No description available.')}</p>
            </div>
            
            ${incident.notes ? `
            <div style="border-top: 1px solid var(--primary-border); padding-top: 20px;">
                <h3 class="section-subtitle" style="font-size: 16px; margin-bottom: 12px; color: var(--text-strong);">Additional Notes</h3>
                <p style="font-size: 14px; line-height: 1.6; color: var(--text-muted); margin: 0;">${escapeHtml(incident.notes)}</p>
            </div>
            ` : ''}
            
            ${generateHistoryLog(incident, createdAt, updatedAt)}
        </div>
    `;

    const modalPanel = detailsModal.querySelector('.modal-panel');
    if (modalPanel) {
        modalPanel.innerHTML = modalContent;
        
        const newCloseBtn = modalPanel.querySelector('#close-details-modal-btn');
        if (newCloseBtn) {
            newCloseBtn.addEventListener('click', closeDetailsModal);
        }
    }
}

// Generate history log
function generateHistoryLog(incident, createdAt, updatedAt) {
    const historyItems = [];
    
    if (incident.resolvedAt) {
        const resolvedDate = incident.resolvedAt.toDate ? incident.resolvedAt.toDate() : new Date(incident.resolvedAt);
        historyItems.push({
            date: resolvedDate,
            text: 'Handled At',
            opacity: 1
        });
    }
    
    if (incident.ongoingAt) {
        const ongoingDate = incident.ongoingAt.toDate ? incident.ongoingAt.toDate() : new Date(incident.ongoingAt);
        historyItems.push({
            date: ongoingDate,
            text: 'Ongoing At',
            opacity: 0.7
        });
    }
    
    historyItems.push({
        date: createdAt,
        text: 'Created At',
        opacity: 0.4
    });

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

// Filter button handlers
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('filter-btn--active'));
        btn.classList.add('filter-btn--active');
        
        const filter = btn.dataset.filter;
        filterIncidents(filter);
    });
});

// Load incidents on page load
loadIncidents();
