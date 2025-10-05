const logoutBtn = document.getElementById("admin-logout-btn");
import { firebaseConfig } from "../../assets/js/firebase-Config.js";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const ROLE_KEY = "campuscareRole";
const LOGIN_TS_KEY = "campuscareLoggedInAt";
const ROLL_KEY = "campuscareRoll";

// Elements
const tbody = document.getElementById("incidents-tbody");
const loadingEl = document.getElementById("incidents-loading");
const errorEl = document.getElementById("incidents-error");
const emptyEl = document.getElementById("incidents-empty");

let allIncidents = [];
let unsubscribe = null;

function ensureAdmin() {
  const role = localStorage.getItem(ROLE_KEY);
  if (role !== "admin") {
    window.location.href = "../login.html";
  }
}

function handleLogout() {
  if (!logoutBtn) return;
  logoutBtn.disabled = true;
  logoutBtn.classList.add("is-loading");
  try {
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(LOGIN_TS_KEY);
    localStorage.removeItem(ROLL_KEY);
  } finally {
    window.location.href = "../login.html";
  }
}

function fmtTime(createdAt) {
  if (!createdAt) return "—";
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return date.toLocaleString();
}

function resolveStatusToken(status) {
  const s = (status || "pending").toLowerCase();
  if (s === "resolved") return "resolved";
  if (s === "ongoing") return "ongoing";
  return "active";
}

function statusBadge(status) {
  const token = resolveStatusToken(status);
  const label = token === "resolved" ? "Resolved" : token === "ongoing" ? "Ongoing" : "Active";
  const cls = `status-pill status-pill--${token}`;
  return { label, cls, token };
}

function applyStatusSelectTheme(selectEl, status) {
  const token = resolveStatusToken(status);
  selectEl.className = `status-select status-select--${token}`;
}

function renderRows(rows) {
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");

    const incidentIdTd = document.createElement("td");
    incidentIdTd.textContent = r.incidentId || r.id || "—";

    const typeTd = document.createElement("td");
    typeTd.textContent = r.type || "—";

    const descTd = document.createElement("td");
    descTd.textContent = r.description || "—";

    const locTd = document.createElement("td");
    locTd.textContent = r.location || "—";

    const reportedTd = document.createElement("td");
    reportedTd.textContent = r.userId || r.reportedBy || "—";

    const statusTd = document.createElement("td");
    const { label, cls, token } = statusBadge(r.status);
    const badge = document.createElement("span");
    badge.className = cls;
    badge.textContent = label;
    statusTd.appendChild(badge);

    const actionTd = document.createElement("td");
    const select = document.createElement("select");
    applyStatusSelectTheme(select, token);
    select.innerHTML = `
      <option value="pending">Active</option>
      <option value="ongoing">Ongoing</option>
      <option value="resolved">Resolved</option>
    `;
    select.value = (r.status || "pending").toLowerCase();
    select.addEventListener("change", async (e) => {
      const newStatus = e.target.value;
      applyStatusSelectTheme(select, newStatus);
      await updateStatus(r._docId, newStatus, r);
    });
    actionTd.appendChild(select);

    tr.appendChild(incidentIdTd);
    tr.appendChild(typeTd);
    tr.appendChild(descTd);
    tr.appendChild(locTd);
    tr.appendChild(reportedTd);
    tr.appendChild(statusTd);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  });
}

function renderIncidents() {
  const rows = allIncidents
    .slice()
    .sort((a, b) => {
      const ta = (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)).getTime();
      const tb = (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)).getTime();
      return tb - ta; // newest first
    });

  renderRows(rows);
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  emptyEl.style.display = rows.length ? "none" : "block";
}

async function updateStatus(docId, newStatus, rowRef) {
  try {
    const updateData = {
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Track specific timestamps for status changes
    if (newStatus === "ongoing" && !rowRef.ongoingAt) {
      updateData.ongoingAt = firebase.firestore.FieldValue.serverTimestamp();
    } else if (newStatus === "resolved" && !rowRef.resolvedAt) {
      updateData.resolvedAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    await db.collection("incidents").doc(docId).update(updateData);

    // Update local model
    const idx = allIncidents.findIndex((x) => x._docId === docId);
    if (idx >= 0) {
      allIncidents[idx].status = newStatus;
      allIncidents[idx].updatedAt = new Date();
      if (updateData.ongoingAt) allIncidents[idx].ongoingAt = new Date();
      if (updateData.resolvedAt) allIncidents[idx].resolvedAt = new Date();
    }
    renderIncidents();

    if (newStatus === "resolved") {
      await notifyReporter(rowRef);
    }
  } catch (err) {
    console.error("Failed to update status", err);
    alert("Failed to update status. Please retry.");
  }
}

// Placeholder: integrate with Cloud Function or Messaging topic
async function notifyReporter(row) {
  try {
    // Example: write to a notifications collection a function could pick up
    await db.collection("notifications").add({
      userId: row.userId || null,
      reportId: row._docId,
      type: "report_resolved",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      title: "Your incident was resolved",
      body: `Incident ${row.id || row._docId} has been marked as resolved`,
    });
  } catch (e) {
    console.warn("Notification enqueue failed (non-blocking)", e);
  }
}

function listenIncidents() {
  loadingEl.style.display = "block";
  errorEl.style.display = "none";
  emptyEl.style.display = "none";

  if (unsubscribe) {
    unsubscribe();
  }

  unsubscribe = db
    .collection("incidents")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snap) => {
        allIncidents = snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
        renderIncidents();
      },
      (err) => {
        console.error("Error loading reports", err);
        loadingEl.style.display = "none";
        errorEl.style.display = "block";
        errorEl.textContent = "Failed to load incidents.";
      }
    );
}

function init() {
  ensureAdmin();
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
  listenIncidents();
}

window.addEventListener("DOMContentLoaded", init);
