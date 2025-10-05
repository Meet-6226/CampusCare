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
  tableBody: document.getElementById("alerts-tbody"),
  loading: document.getElementById("alerts-loading"),
  error: document.getElementById("alerts-error"),
  empty: document.getElementById("alerts-empty"),
};

const state = {
  unsubscribe: null,
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

function setVisibility(el, visible) {
  if (!el) return;
  el.style.display = visible ? "" : "none";
}

function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

function renderAlerts(rows) {
  if (!elements.tableBody) return;

  elements.tableBody.innerHTML = "";

  rows.forEach((alert) => {
    const tr = document.createElement("tr");

    const titleTd = document.createElement("td");
    titleTd.textContent = alert.title || "Untitled";

    const messageTd = document.createElement("td");
    messageTd.textContent = alert.message || "—";

    const createdByTd = document.createElement("td");
    createdByTd.textContent = alert.createdBy || "—";

    const createdAtTd = document.createElement("td");
    createdAtTd.textContent = alert.createdAtLabel;

    tr.appendChild(titleTd);
    tr.appendChild(messageTd);
    tr.appendChild(createdByTd);
    tr.appendChild(createdAtTd);

    elements.tableBody.appendChild(tr);
  });
}

function listenForAlerts() {
  setVisibility(elements.loading, true);
  setVisibility(elements.error, false);
  setVisibility(elements.empty, false);

  if (state.unsubscribe) {
    state.unsubscribe();
  }

  state.unsubscribe = db
    .collection("alerts")
    .orderBy("createdAt", "desc")
    .limit(50)
    .onSnapshot(
      (snapshot) => {
        const alerts = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title,
            message: data.message,
            createdBy: data.createdBy,
            createdAtLabel: formatDateTime(data.createdAt),
          };
        });

        setVisibility(elements.loading, false);
        setVisibility(elements.error, false);
        setVisibility(elements.empty, alerts.length === 0);

        if (alerts.length) {
          renderAlerts(alerts);
        } else if (elements.tableBody) {
          elements.tableBody.innerHTML = "";
        }
      },
      (error) => {
        console.error("Failed to load alerts", error);
        setVisibility(elements.loading, false);
        setVisibility(elements.error, true);
        setVisibility(elements.empty, false);
        setText(elements.error, "Failed to load alerts. Please try again.");
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

  listenForAlerts();
}

window.addEventListener("DOMContentLoaded", init);
