import { firebaseConfig } from "../../assets/js/firebase-Config.js";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const ROLE_KEY = "campuscareRole";
const LOGIN_TS_KEY = "campuscareLoggedInAt";
const ROLL_KEY = "campuscareRoll";

const elements = {
  logoutBtn: document.getElementById("admin-logout-btn"),
  tableBody: document.getElementById("sos-tbody"),
  loading: document.getElementById("sos-loading"),
  error: document.getElementById("sos-error"),
  empty: document.getElementById("sos-empty"),
};

const state = {
  listUnsubscribe: null,
  changing: new Set(),
};

function ensureAdmin() {
  const role = localStorage.getItem(ROLE_KEY);
  if (role !== "admin") {
    window.location.href = "../login.html";
  }
}

function formatDateTime(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString();
}

function buildLocationLabel(location) {
  if (!location) return "Location: not shared";
  const { latitude, longitude, accuracy, address } = location;
  if (address) return address;
  if (latitude && longitude) {
    const accuracyText = accuracy ? ` (±${Math.round(accuracy)}m)` : "";
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracyText}`;
  }
  return "Location: provided";
}

function resolveStatusToken(status) {
  const value = (status || "pending").toLowerCase();
  if (value === "handled") return { token: "resolved", label: "Handled" };
  if (value === "ongoing") return { token: "ongoing", label: "Ongoing" };
  return { token: "active", label: "Active" };
}

function applyStatusBadge(el, status) {
  const { token, label } = resolveStatusToken(status);
  el.className = `status-pill status-pill--${token}`;
  el.textContent = label;
  return token;
}

function applyStatusSelectTheme(selectEl, status) {
  const { token } = resolveStatusToken(status);
  selectEl.className = `status-select status-select--${token}`;
}

function setVisibility(el, visible) {
  if (!el) return;
  el.style.display = visible ? "" : "none";
}
function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

function renderRows(rows) {
  if (!elements.tableBody) return;

  elements.tableBody.innerHTML = "";

  const sortedRows = rows
    .slice()
    .sort((a, b) => {
      const aId = Number(a.sequenceId ?? a.requestId ?? 0);
      const bId = Number(b.sequenceId ?? b.requestId ?? 0);
      if (Number.isFinite(aId) && Number.isFinite(bId)) {
        return bId - aId;
      }
      return 0;
    });

  sortedRows.forEach((r, index) => {
    const tr = document.createElement("tr");

    const idTd = document.createElement("td");
    const rawId = r.sequenceId ?? r.requestId;
    const numericId = Number(rawId);
    if (Number.isFinite(numericId) && numericId >= 0) {
      idTd.textContent = numericId.toString().padStart(4, "0");
    } else if (typeof rawId === "string" && rawId) {
      idTd.textContent = rawId;
    } else {
      const fallbackId = 1000 + sortedRows.length - index;
      idTd.textContent = fallbackId.toString().padStart(4, "0");
    }

    const statusTd = document.createElement("td");
    const badge = document.createElement("span");
    const token = applyStatusBadge(badge, r.status);
    statusTd.appendChild(badge);

    const reportedByTd = document.createElement("td");
    reportedByTd.textContent = r.reportedBy || "—";

    const locationTd = document.createElement("td");
    locationTd.textContent = r.locationLabel;

    const raisedTd = document.createElement("td");
    raisedTd.textContent = r.raisedAt;

    const actionTd = document.createElement("td");
    const select = document.createElement("select");
    select.innerHTML = `
      <option value="pending">Pending</option>
      <option value="ongoing">Ongoing</option>
      <option value="handled">Handled</option>
    `;
    select.value = (r.status || "pending").toLowerCase();
    applyStatusSelectTheme(select, select.value);
    select.addEventListener("change", async (e) => {
      const previousStatus = r.status;
      const newStatus = e.target.value;

      r.status = newStatus;
      applyStatusSelectTheme(select, newStatus);
      applyStatusBadge(badge, newStatus);

      try {
        await handleUpdateStatus(r._docId, newStatus);
      } catch (error) {
        console.error("Failed to update SOS status", error);
        r.status = previousStatus;
        alert("Could not update SOS status. Please retry.");
        select.value = previousStatus;
        applyStatusSelectTheme(select, previousStatus);
        applyStatusBadge(badge, previousStatus);
      }
    });
    actionTd.appendChild(select);

    tr.appendChild(idTd);
    tr.appendChild(statusTd);
    tr.appendChild(reportedByTd);
    tr.appendChild(locationTd);
    tr.appendChild(raisedTd);
    tr.appendChild(actionTd);

    applyStatusSelectTheme(select, r.status);

    elements.tableBody.appendChild(tr);
  });
}

async function handleUpdateStatus(docId, status) {
  if (!docId) {
    throw new Error("Missing SOS request identifier");
  }

  if (state.changing.has(docId)) {
    return;
  }

  state.changing.add(docId);

  try {
    const update = { status };
    if (status === "handled") {
      update.handledAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    await db.collection("sosRequests").doc(docId).update(update);
  } finally {
    state.changing.delete(docId);
  }
}

function listenForRequests() {
  setVisibility(elements.loading, true);
  setVisibility(elements.error, false);
  setVisibility(elements.empty, false);

  if (state.listUnsubscribe) {
    state.listUnsubscribe();
  }

  state.listUnsubscribe = db
    .collection("sosRequests")
    .orderBy("createdAt", "desc")
    .limit(50)
    .onSnapshot(
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            _docId: doc.id,
            requestId: data.requestId || doc.id,
            sequenceId: typeof data.displayId === "number" ? data.displayId : undefined,
            status: (data.status || "pending").toLowerCase(),
            reportedBy:
              data.reportedBy ||
              data.rollNumber ||
              data.userRoll ||
              data.userId ||
              data.contactNumber ||
              data.phone ||
              "—",
            locationLabel: buildLocationLabel(data.location),
            raisedAt: formatDateTime(data.createdAt),
          };
        });

        setVisibility(elements.loading, false);
        setVisibility(elements.error, false);
        setVisibility(elements.empty, items.length === 0);

        if (items.length) {
          renderRows(items);
        } else if (elements.tableBody) {
          elements.tableBody.innerHTML = "";
        }
      },
      (error) => {
        console.error("Error loading SOS requests", error);
        setVisibility(elements.loading, false);
        setVisibility(elements.error, true);
        setVisibility(elements.empty, false);
        setText(elements.error, "Failed to load SOS requests.");
      }
    );
}

function handleLogout() {
  if (!elements.logoutBtn) return;
  elements.logoutBtn.disabled = true;
  elements.logoutBtn.classList.add("is-loading");
  try {
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(LOGIN_TS_KEY);
    localStorage.removeItem(ROLL_KEY);
  } finally {
    window.location.href = "../login.html";
  }
}

function init() {
  ensureAdmin();

  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener("click", handleLogout);
  }

  listenForRequests();
}

window.addEventListener("DOMContentLoaded", init);
