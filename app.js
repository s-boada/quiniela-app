// Audioplace Quiniela 2026 - Firebase Auth + Firestore

const { auth, db, firebase } = window.firebaseServices;

const COLLECTIONS = {
  users: "users",
  matches: "matches",
  predictions: "predictions",
  settings: "settings",
  legacyUsers: "legacy_users"
};

const SESSION_KEY = "quiniela_current_user";
const ACTIVE_TAB_KEY = "quiniela_active_tab";
const LAST_EMAIL_KEY = "quiniela_last_email";
const LAST_DISPLAY_NAME_KEY = "quiniela_last_display_name";

let state = {
  users: [],
  matches: [],
  predictions: {},
  currentUser: null,
  activeTab: localStorage.getItem(ACTIVE_TAB_KEY) || "leaderboard",
  activePredictionsStatusTab: "pending",
  activeGroupStage: "A",
  isAdmin: false
};

let selectedAvatarEmoji = "⚽";
let unsubscribeAuth = null;
let unsubscribeUsers = null;
let unsubscribeMatches = null;
let unsubscribePredictions = null;

const COUNTRY_CODES = {
  "Argelia": "dz",
  "Argentina": "ar",
  "Australia": "au",
  "Austria": "at",
  "Bélgica": "be",
  "Bosnia y Herzegovina": "ba",
  "Brasil": "br",
  "Canadá": "ca",
  "Cabo Verde": "cv",
  "Colombia": "co",
  "Croacia": "hr",
  "Curazao": "cw",
  "Curaçao": "cw",
  "Chequia": "cz",
  "RD Congo": "cd",
  "Ecuador": "ec",
  "Egipto": "eg",
  "Inglaterra": "gb-eng",
  "Francia": "fr",
  "Alemania": "de",
  "Ghana": "gh",
  "Haití": "ht",
  "Irán": "ir",
  "Irak": "iq",
  "Costa de Marfil": "ci",
  "Japón": "jp",
  "Jordania": "jo",
  "México": "mx",
  "Marruecos": "ma",
  "Países Bajos": "nl",
  "Nueva Zelanda": "nz",
  "Noruega": "no",
  "Panamá": "pa",
  "Paraguay": "py",
  "Portugal": "pt",
  "Catar": "qa",
  "Arabia Saudita": "sa",
  "Escocia": "gb-sct",
  "Senegal": "sn",
  "Sudáfrica": "za",
  "Corea del Sur": "kr",
  "España": "es",
  "Suecia": "se",
  "Suiza": "ch",
  "Túnez": "tn",
  "Turquía": "tr",
  "EE.UU.": "us",
  "Uruguay": "uy",
  "Uzbekistán": "uz"
};

const TEAM_TRANSLATIONS = {
  "Mexico": "México", "South Africa": "Sudáfrica", "South Korea": "Corea del Sur", "Czech Republic": "Chequia",
  "Canada": "Canadá", "Bosnia and Herzegovina": "Bosnia y Herzegovina", "USA": "EE.UU.", "United States": "EE.UU.",
  "Paraguay": "Paraguay", "Qatar": "Catar", "Switzerland": "Suiza", "Brazil": "Brasil", "Morocco": "Marruecos",
  "Haiti": "Haití", "Scotland": "Escocia", "Australia": "Australia", "Turkey": "Turquía", "Türkiye": "Turquía", "Germany": "Alemania",
  "Curacao": "Curazao", "Curaçao": "Curazao", "Netherlands": "Países Bajos", "Japan": "Japón", "Ivory Coast": "Costa de Marfil",
  "Ecuador": "Ecuador", "Sweden": "Suecia", "Tunisia": "Túnez", "Spain": "España", "Cape Verde": "Cabo Verde",
  "Belgium": "Bélgica", "Egypt": "Egipto", "Saudi Arabia": "Arabia Saudita", "Uruguay": "Uruguay", "Iran": "Irán",
  "New Zealand": "Nueva Zelanda", "France": "Francia", "Senegal": "Senegal", "Iraq": "Irak", "Norway": "Noruega",
  "Argentina": "Argentina", "Algeria": "Argelia", "Austria": "Austria", "Jordan": "Jordania", "Portugal": "Portugal",
  "DR Congo": "RD Congo", "Democratic Republic of the Congo": "RD Congo", "England": "Inglaterra", "Croatia": "Croacia",
  "Ghana": "Ghana", "Panama": "Panamá", "Bolivia": "Bolivia", "Colombia": "Colombia", "Uzbekistan": "Uzbekistán"
};

window.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.remove("dark-theme");
  setupNavigation();
  setupModalCloseOnOverlay();
  populateCountrySelects();
  await seedInitialDataIfNeeded();
  bindRealtimeCollections();
  bindAuth();
  switchTab(state.activeTab);
});

function setupModalCloseOnOverlay() {
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });
}

function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseMatchDateAsUTC(dateStr) {
  if (!dateStr) return new Date();
  const utcStr = dateStr.replace(" ", "T") + "Z";
  return new Date(utcStr);
}

function formatMatchDateToCaracas12h(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(parseMatchDateAsUTC(dateStr));
}

function getCountryFlag(countryName) {
  if (!countryName) return "";
  const code = COUNTRY_CODES[countryName];
  if (!code) return "";
  return `<img src="https://flagcdn.com/w40/${code}.png" alt="Bandera de ${countryName}" class="country-flag-img" style="width: 24px; height: auto; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); object-fit: contain; vertical-align: middle; display: inline-block;">`;
}

function translateTeam(engName) {
  if (!engName) return "";
  return TEAM_TRANSLATIONS[engName] || engName;
}

function translateLabel(label) {
  if (!label) return "";
  return label
    .replace(/Winner Group /g, "Ganador Grupo ")
    .replace(/Runner-up Group /g, "Segundo Grupo ")
    .replace(/3rd Group /g, "3ro Grupo ")
    .replace(/Winner Match /g, "Ganador Partido ")
    .replace(/Loser Match /g, "Perdedor Partido ");
}

function isMatchUndetermined(match) {
  if (!match || !match.homeTeam || !match.awayTeam) return true;
  const placeholders = ["Ganador", "Segundo", "Perdedor", "Grupo", "3ro", "3er", "Winner", "Runner-up", "3rd", "Loser"];
  return placeholders.some((p) => match.homeTeam.includes(p) || match.awayTeam.includes(p));
}

async function seedInitialDataIfNeeded() {
  const appSettingsRef = db.collection(COLLECTIONS.settings).doc("app");
  const settingsSnap = await appSettingsRef.get();
  if (settingsSnap.exists && settingsSnap.data().seededV1) return;

  const batch = db.batch();
  INITIAL_MATCHES.forEach((match) => {
    const ref = db.collection(COLLECTIONS.matches).doc(match.id);
    batch.set(ref, { ...match, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });

  INITIAL_USERS.forEach((legacyUser) => {
    const ref = db.collection(COLLECTIONS.legacyUsers).doc(legacyUser.id);
    batch.set(ref, {
      ...legacyUser,
      claimed: false,
      status: "available",
      role: "user",
      seededAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  Object.entries(INITIAL_PREDICTIONS).forEach(([id, pred]) => {
    const parts = id.split("_");
    const legacyUserId = parts[0];
    const matchId = parts.slice(1).join("_");
    const ref = db.collection(COLLECTIONS.predictions).doc(`legacy_${id}`);
    batch.set(ref, {
      uid: `legacy_${legacyUserId}`,
      legacyUserId,
      matchId,
      homeScore: pred.homeScore,
      awayScore: pred.awayScore,
      isLegacy: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  batch.set(appSettingsRef, {
    seededV1: true,
    seededAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();
}

async function claimLegacyByName(displayName, uid) {
  const targetName = normalizeName(displayName);
  if (!targetName) return null;

  const legacyUsersSnap = await db.collection(COLLECTIONS.legacyUsers).get();
  let matchedLegacyUser = null;
  let matchedLegacyRef = null;

  legacyUsersSnap.forEach((doc) => {
    if (matchedLegacyUser) return;
    const data = doc.data();
    const legacyName = normalizeName(data.name || "");
    const alreadyClaimed = data.claimed === true;
    if ((legacyName === targetName || legacyName.startsWith(targetName)) && !alreadyClaimed) {
      matchedLegacyUser = { id: doc.id, ...data };
      matchedLegacyRef = doc.ref;
    }
  });

  if (!matchedLegacyUser) return null;

  await db.runTransaction(async (tx) => {
    const legacyDoc = await tx.get(matchedLegacyRef);
    if (!legacyDoc.exists) {
      throw new Error("Legacy user no encontrado.");
    }
    const legacyData = legacyDoc.data();
    if (legacyData.claimed === true) {
      throw new Error("Este usuario legacy ya fue reclamado.");
    }
    tx.set(matchedLegacyRef, {
      claimed: true,
      status: "claimed",
      claimedBy: uid,
      claimedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  const legacyUid = `legacy_${matchedLegacyUser.id}`;
  const [legacyByField, legacyByUid] = await Promise.all([
    db.collection(COLLECTIONS.predictions).where("legacyUserId", "==", matchedLegacyUser.id).get(),
    db.collection(COLLECTIONS.predictions).where("uid", "==", legacyUid).get()
  ]);

  const predictionsByMatchId = new Map();
  [legacyByField, legacyByUid].forEach((snap) => {
    snap.forEach((doc) => {
      const data = doc.data();
      if (!data.matchId) return;
      if (!predictionsByMatchId.has(data.matchId)) {
        predictionsByMatchId.set(data.matchId, data);
      }
    });
  });

  const batch = db.batch();
  predictionsByMatchId.forEach((prediction, matchId) => {
    const ref = db.collection(COLLECTIONS.predictions).doc(`${uid}_${matchId}`);
    batch.set(ref, {
      uid,
      matchId,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
      migratedFromLegacy: matchedLegacyUser.id,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  if (predictionsByMatchId.size > 0) {
    await batch.commit();
  }

  return matchedLegacyUser;
}

function bindRealtimeCollections() {
  unsubscribeUsers = db.collection(COLLECTIONS.users).onSnapshot((snap) => {
    state.users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderApp();
  });

  unsubscribeMatches = db.collection(COLLECTIONS.matches).onSnapshot((snap) => {
    state.matches = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    state.matches.sort((a, b) => parseMatchDateAsUTC(a.date).getTime() - parseMatchDateAsUTC(b.date).getTime());
    renderApp();
  });

  unsubscribePredictions = db.collection(COLLECTIONS.predictions).onSnapshot((snap) => {
    const map = {};
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (!data.matchId || !data.uid) return;
      map[`${data.uid}_${data.matchId}`] = { homeScore: data.homeScore, awayScore: data.awayScore };
    });
    state.predictions = map;
    renderApp();
  });
}

function bindAuth() {
  unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
    if (!firebaseUser) {
      state.currentUser = null;
      state.isAdmin = false;
      localStorage.removeItem(SESSION_KEY);
      if (state.activeTab === "predictions" || state.activeTab === "groupStage") {
        state.activeTab = "leaderboard";
      }
      renderApp();
      return;
    }

    const userRef = db.collection(COLLECTIONS.users).doc(firebaseUser.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await auth.signOut();
      localStorage.removeItem(SESSION_KEY);
      alert("Tu cuenta no está habilitada en la quiniela. Si necesitas acceso, contacta al administrador.");
      return;
    }
    const userData = userSnap.data();
    state.currentUser = {
      uid: firebaseUser.uid,
      id: firebaseUser.uid,
      name: userData.displayName || firebaseUser.displayName || firebaseUser.email,
      email: firebaseUser.email || "",
      role: userData.role || "user",
      avatar: userData.avatar || "⚽"
    };
    state.isAdmin = state.currentUser.role === "admin";
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.currentUser));
    renderApp();
    // After rendering, ensure legacy predictions are claimed if missing
    tryClaimLegacyForCurrentUser();
  });
}

// Auto-claim legacy predictions for logged-in user if they have none
async function tryClaimLegacyForCurrentUser() {
  if (!state.currentUser) return;
  const uid = state.currentUser.uid;
  const name = state.currentUser.name || '';
  const email = state.currentUser.email || '';
  // Check if user already has predictions
  const predsSnap = await db.collection(COLLECTIONS.predictions).where('uid', '==', uid).limit(1).get();
  if (!predsSnap.empty) return; // already has predictions

  // Build possible name candidates: full name, first name, email prefix
  const candidates = [];
  if (name) candidates.push(name);
  const firstName = name.split(' ')[0];
  if (firstName && firstName !== name) candidates.push(firstName);
  if (email) {
    const emailPrefix = email.split('@')[0];
    if (emailPrefix) candidates.push(emailPrefix);
  }

  let claimed = false;
  for (const candidate of candidates) {
    const result = await claimLegacyByName(candidate, uid);
    if (result) {
      claimed = true;
      renderApp();
      break;
    }
  }

  // If not claimed by name, attempt by legacy id (e.g., uid or email prefix)
  if (!claimed) {
    const idCandidates = [];
    if (uid) idCandidates.push(uid);
    if (email) {
      const emailPrefix = email.split('@')[0];
      if (emailPrefix) idCandidates.push(emailPrefix);
    }
    for (const idCand of idCandidates) {
      const result = await claimLegacyById(idCand, uid);
      if (result) {
        renderApp();
        break;
      }
    }
  }
}

// Claim legacy predictions by legacy document id (instead of name)
async function claimLegacyById(legacyId, uid) {
  if (!legacyId) return null;
  const legacyRef = db.collection(COLLECTIONS.legacyUsers).doc(legacyId);
  const legacyDoc = await legacyRef.get();
  if (!legacyDoc.exists) return null;
  const legacyData = legacyDoc.data();
  if (legacyData.claimed) return null;

  // Mark as claimed
  await db.runTransaction(async (tx) => {
    tx.set(legacyRef, {
      claimed: true,
      status: "claimed",
      claimedBy: uid,
      claimedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  // Migrate predictions for this legacy user
  const legacyPredsSnap = await db.collection(COLLECTIONS.predictions)
    .where("legacyUserId", "==", legacyId)
    .get();
  if (legacyPredsSnap.empty) return legacyData;

  const batch = db.batch();
  legacyPredsSnap.forEach(doc => {
    const data = doc.data();
    const matchId = data.matchId;
    if (!matchId) return;
    const ref = db.collection(COLLECTIONS.predictions).doc(`${uid}_${matchId}`);
    batch.set(ref, {
      uid,
      matchId,
      homeScore: data.homeScore,
      awayScore: data.awayScore,
      migratedFromLegacy: legacyId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await batch.commit();
  return legacyData;
}




function setupNavigation() {
  window.switchTab = (tabId) => {
    state.activeTab = tabId;
    localStorage.setItem(ACTIVE_TAB_KEY, tabId);

    document.querySelectorAll(".tab-link").forEach((btn) => btn.classList.remove("active"));
    const tabBtn = Array.from(document.querySelectorAll(".tab-link")).find((btn) => btn.getAttribute("onclick")?.includes(`'${tabId}'`));
    if (tabBtn) tabBtn.classList.add("active");

    document.querySelectorAll(".tab-content").forEach((section) => section.classList.remove("active"));
    const activeSection = document.getElementById(tabId);
    if (activeSection) activeSection.classList.add("active");

    renderApp();
  };
}

function populateCountrySelects() {
  const homeSelect = document.getElementById("newMatchHome");
  const awaySelect = document.getElementById("newMatchAway");
  if (!homeSelect || !awaySelect || !window.COUNTRIES) return;
  homeSelect.innerHTML = "";
  awaySelect.innerHTML = "";
  [...COUNTRIES].sort().forEach((country) => {
    const optHome = document.createElement("option");
    optHome.value = country;
    optHome.textContent = country;
    homeSelect.appendChild(optHome);
    const optAway = document.createElement("option");
    optAway.value = country;
    optAway.textContent = country;
    awaySelect.appendChild(optAway);
  });
}

function calculateUserPoints(userId) {
  let points = 0;
  let exactCount = 0;
  let outcomeCount = 0;
  let predictedCount = 0;
  state.matches.forEach((match) => {
    if (!match.completed) return;
    const prediction = state.predictions[`${userId}_${match.id}`];
    if (!prediction) return;
    predictedCount++;
    const predHome = parseInt(prediction.homeScore, 10);
    const predAway = parseInt(prediction.awayScore, 10);
    const realHome = match.realHomeScore;
    const realAway = match.realAwayScore;
    if (Number.isNaN(predHome) || Number.isNaN(predAway) || realHome == null || realAway == null) return;
    if (predHome === realHome && predAway === realAway) {
      points += 4;
      exactCount++;
    } else if (Math.sign(predHome - predAway) === Math.sign(realHome - realAway)) {
      points += 1;
      outcomeCount++;
    }
  });
  return { totalPoints: points, exactHits: exactCount, outcomeHits: outcomeCount, totalPredicted: predictedCount };
}

function calculateMatchPoints(match, prediction) {
  if (!match || !match.completed) return null;
  if (!prediction || prediction.homeScore === "" || prediction.awayScore === "") return 0;

  const predHome = parseInt(prediction.homeScore, 10);
  const predAway = parseInt(prediction.awayScore, 10);
  const realHome = match.realHomeScore;
  const realAway = match.realAwayScore;

  if (Number.isNaN(predHome) || Number.isNaN(predAway) || realHome == null || realAway == null) return 0;
  if (predHome === realHome && predAway === realAway) return 4;
  if (Math.sign(predHome - predAway) === Math.sign(realHome - realAway)) return 1;
  return 0;
}

function renderApp() {
  updateUserBadge();
  if (state.activeTab === "leaderboard") renderLeaderboard();
  if (state.activeTab === "predictions") {
    if (!state.currentUser) {
      document.getElementById("predictionsContent").style.display = "none";
      document.getElementById("predictionsPrivateMessage").style.display = "block";
      document.getElementById("predictionsPrivateMessage").innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <h2 style="color: var(--text-dark); margin-bottom: 15px;">🔒 Acceso Privado</h2>
          <p style="color: var(--text-light); margin-bottom: 25px;">Debes iniciar sesión para ver o editar tus marcadores.</p>
          <button class="btn-primary" onclick="openLoginModal()" style="padding: 12px 30px; font-size: 1.1rem; border-radius: 8px;">Iniciar Sesión</button>
        </div>`;
      return;
    }
    document.getElementById("predictionsContent").style.display = "block";
    document.getElementById("predictionsPrivateMessage").style.display = "none";
    renderPredictions();
  }
  if (state.activeTab === "groupStage") {
    if (!state.currentUser) return switchTab("leaderboard");
    renderGroupStageTab();
  }
}

function updateUserBadge() {
  const loggedOutControls = document.getElementById("loggedOutControls");
  const loggedInControls = document.getElementById("loggedInControls");
  const nameEl = document.getElementById("currentUserName");
  const groupStageLink = document.getElementById("groupStageTabLink");
  const premiosLink = document.getElementById("premiosTabLink");
  const adminLink = document.getElementById("adminTabLink");

  if (state.currentUser) {
    if (loggedOutControls) loggedOutControls.style.display = "none";
    if (loggedInControls) loggedInControls.style.display = "flex";
    if (nameEl) nameEl.textContent = (state.currentUser.name || "Usuario").split(" ")[0];
    if (groupStageLink) groupStageLink.style.display = "inline-block";
    if (premiosLink) premiosLink.style.display = "inline-block";
    if (adminLink) adminLink.style.display = state.isAdmin ? "inline-block" : "none";
  } else {
    if (loggedOutControls) loggedOutControls.style.display = "flex";
    if (loggedInControls) loggedInControls.style.display = "none";
    if (groupStageLink) groupStageLink.style.display = "none";
    if (premiosLink) premiosLink.style.display = "inline-block";
    if (adminLink) adminLink.style.display = "none";
  }
}

function renderLeaderboard() {
  const leaderboardList = document.getElementById("leaderboardList");
  const userCountLabel = document.getElementById("userCountLabel");
  if (!leaderboardList || !userCountLabel) return;
  leaderboardList.innerHTML = "";
  userCountLabel.textContent = `${state.users.length} Participantes`;

  if (!state.currentUser) {
    leaderboardList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">Inicia sesión para ver ranking y tus pronósticos.</div>`;
    return;
  }

  const scoreboard = state.users.map((user) => ({ user, ...calculateUserPoints(user.uid || user.id) }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.exactHits - a.exactHits || (a.user.displayName || "").localeCompare(b.user.displayName || ""));

  scoreboard.forEach((row, index) => {
    const rank = index + 1;
    const userName = row.user.displayName || row.user.name || row.user.email || "Usuario";
    const isCurrent = state.currentUser && (state.currentUser.uid === row.user.uid || state.currentUser.id === row.user.id);
    const item = document.createElement("div");
    item.className = `leaderboard-item ${rank <= 3 ? `rank-${rank}` : "rank-other"} ${isCurrent ? "is-current" : ""}`;
    item.onclick = () => openUserStatsModal(row.user.uid || row.user.id);
    item.innerHTML = `
      <div class="rank-badge"><span class="rank">${rank}</span></div>
      <div>
        <div class="leaderboard-name">${userName} ${isCurrent ? '<small style="color: var(--accent-soccer);">(Tú)</small>' : ""}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Ver estadísticas</div>
      </div>
      <div class="leaderboard-stats">
        <span>Exactos: <strong>${row.exactHits}</strong></span>
        <span>Ganador: <strong>${row.outcomeHits}</strong></span>
      </div>
      <div class="leaderboard-points">${row.totalPoints} <span class="pts-label">PTS</span></div>`;
    leaderboardList.appendChild(item);
  });
}

function renderPredictions() {
  const grid = document.getElementById("predictionsGrid");
  if (!grid || !state.currentUser) return;
  grid.innerHTML = "";

  const stageVal = document.getElementById("stageFilter").value;
  const groupVal = document.getElementById("groupFilter").value;
  const currentUserId = state.currentUser.uid;

  const filteredMatches = state.matches.filter((match) => {
    if (stageVal !== "All" && match.stage !== stageVal) return false;
    if (groupVal !== "All" && match.group !== groupVal) return false;
    return true;
  });

  const tabMatches = filteredMatches.filter((match) => {
    if (state.activePredictionsStatusTab === "completed") return !!match.completed;
    return !match.completed;
  });

  if (tabMatches.length === 0) {
    const emptyText = state.activePredictionsStatusTab === "completed"
      ? "No hay partidos finalizados para los filtros aplicados."
      : "No hay partidos pendientes para los filtros aplicados.";
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">${emptyText}</div>`;
    return;
  }

  tabMatches.forEach((match) => {
    const prediction = state.predictions[`${currentUserId}_${match.id}`] || { homeScore: "", awayScore: "" };
    const hasPrediction = prediction.homeScore !== "" && prediction.awayScore !== "";
    const isLive = match.status === "IN_PLAY";
    const matchDateUTC = parseMatchDateAsUTC(match.date);
    const isLockedByTime = matchDateUTC.getTime() - Date.now() < 5 * 60 * 1000;
    const disabledAttr = (match.completed || isLive || hasPrediction || isLockedByTime || isMatchUndetermined(match)) ? "disabled" : "";

    const matchPoints = calculateMatchPoints(match, prediction);
    const pointsBadgeHtml = match.completed
      ? `<span style="
          background: ${matchPoints > 0 ? "rgba(34, 197, 94, 0.10)" : "rgba(220, 38, 38, 0.10)"};
          color: ${matchPoints > 0 ? "#16a34a" : "var(--accent-red)"};
          border: 1px solid ${matchPoints > 0 ? "rgba(34, 197, 94, 0.45)" : "rgba(220, 38, 38, 0.45)"};
          border-radius: 8px;
          padding: 4px 10px;
          font-weight: 700;
          font-size: 0.82rem;
          white-space: nowrap;
        ">
          ${matchPoints > 0 ? `+${matchPoints}` : "0"} pts
        </span>`
      : "";

    const card = document.createElement("div");
    card.className = `match-card ${match.completed ? "is-completed" : ""} ${isLive ? "is-live" : ""} ${hasPrediction ? "has-prediction" : ""}`;
    card.innerHTML = `
      <div class="match-header"><span class="match-stage">${match.stage}</span><span>${formatMatchDateToCaracas12h(match.date)}</span></div>
      <div class="match-teams-score">
        <div class="team-row"><div class="team-info">${getCountryFlag(match.homeTeam)}<span class="team-name">${match.homeTeam}</span></div><input type="number" class="score-input" id="home_${match.id}" value="${prediction.homeScore}" ${disabledAttr}></div>
        <div class="team-row"><div class="team-info">${getCountryFlag(match.awayTeam)}<span class="team-name">${match.awayTeam}</span></div><input type="number" class="score-input" id="away_${match.id}" value="${prediction.awayScore}" ${disabledAttr}></div>
      </div>
      <div class="card-footer" style="display: flex; justify-content: space-between; align-items: flex-end; gap: 10px;">
        <div>${match.completed ? `<div class="real-score-display">Real: <span class="real-score-badge">${match.realHomeScore} - ${match.realAwayScore}</span></div>` : hasPrediction ? `<span class="prediction-status status-saved">✓ Guardado</span>` : `<button class="btn btn-primary" onclick="confirmAndSavePrediction('${match.id}')">Guardar Pronóstico</button>`}</div>
        <div>${pointsBadgeHtml}</div>
      </div>`;
    grid.appendChild(card);
  });
}

window.setPredictionStatusTab = (tabId, element) => {
  state.activePredictionsStatusTab = tabId;
  const parent = document.getElementById("predictionFilterButtons");
  if (parent) parent.querySelectorAll(".btn-filter").forEach((btn) => btn.classList.remove("active"));
  if (element) element.classList.add("active");
  renderPredictions();
};

// Compatibilidad con nombre antiguo
window.setPredictionStatusFilter = (filterType, element) => {
  const mapped = filterType === "Completed" ? "completed" : "pending";
  window.setPredictionStatusTab(mapped, element);
};

window.openModal = (modalId) => document.getElementById(modalId)?.classList.add("active");
window.closeModal = (modalId) => document.getElementById(modalId)?.classList.remove("active");

window.openLoginModal = () => {
  document.getElementById("loginEmail").value = localStorage.getItem(LAST_EMAIL_KEY) || "";
  document.getElementById("loginPassword").value = "";
  openModal("loginModal");
};

window.loginUser = async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  if (!email || !password) return alert("Ingresa correo y contraseña.");
  try {
    await auth.signInWithEmailAndPassword(email, password);
    localStorage.setItem(LAST_EMAIL_KEY, email);
    closeModal("loginModal");
    window.location.reload();
  } catch (error) {
    alert(`No se pudo iniciar sesión: ${error.message}`);
  }
};

window.logoutUser = async () => {
  if (!confirm("¿Seguro que quieres cerrar sesión?")) return;
  try {
    await auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  } catch (error) {
    alert(`Error cerrando sesión: ${error.message}`);
  }
};

window.selectAvatar = (emoji, element) => {
  selectedAvatarEmoji = emoji;
  document.querySelectorAll(".avatar-option").forEach((opt) => opt.classList.remove("selected"));
  if (element) element.classList.add("selected");
};

window.openRegisterUserFromLogin = () => {
  closeModal("loginModal");
  openRegisterUserModal();
};

window.openRegisterUserModal = () => {
  document.getElementById("newUserEmail").value = localStorage.getItem(LAST_EMAIL_KEY) || "";
  document.getElementById("newUsername").value = localStorage.getItem(LAST_DISPLAY_NAME_KEY) || "";
  document.getElementById("newUserPassword").value = "";
  const firstAvatar = document.querySelector(".avatar-option");
  if (firstAvatar) selectAvatar("⚽", firstAvatar);
  openModal("registerUserModal");
};

window.registerUser = async () => {
  const email = document.getElementById("newUserEmail").value.trim();
  const name = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newUserPassword").value.trim();
  if (!email || !name || !password) return alert("Completa correo, nombre y contraseña.");
  if (password.length < 6) return alert("La contraseña debe tener mínimo 6 caracteres.");

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const matchedLegacyUser = await claimLegacyByName(name, cred.user.uid);
    const finalDisplayName = matchedLegacyUser?.name || name;
    const finalAvatar = matchedLegacyUser?.avatar || selectedAvatarEmoji;

    await cred.user.updateProfile({ displayName: finalDisplayName });
    await db.collection(COLLECTIONS.users).doc(cred.user.uid).set({
      uid: cred.user.uid,
      email,
      displayName: finalDisplayName,
      role: "user",
      avatar: finalAvatar,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    localStorage.setItem(LAST_EMAIL_KEY, email);
    localStorage.setItem(LAST_DISPLAY_NAME_KEY, finalDisplayName);
    closeModal("registerUserModal");
    switchTab("predictions");
  } catch (error) {
    console.error(error);
    alert(`No se pudo registrar: ${error.message}`);
  }
};

window.openUserStatsModal = (userId) => {
  const user = state.users.find((u) => (u.uid || u.id) === userId);
  if (!user) return;
  document.getElementById("statsModalTitle").textContent = `Pronósticos de ${user.displayName || user.name || "Usuario"}`;
  const stats = calculateUserPoints(userId);
  document.getElementById("statExactMatches").textContent = stats.exactHits;
  document.getElementById("statOutcomeMatches").textContent = stats.outcomeHits;
  document.getElementById("statTotalMatches").textContent = stats.totalPredicted;
  const listEl = document.getElementById("statsMatchList");
  listEl.innerHTML = "";
  state.matches.forEach((match) => {
    const pred = state.predictions[`${userId}_${match.id}`];
    const isOwner = state.currentUser && state.currentUser.uid === userId;
    const canShow = match.completed || isOwner;
    const predDisplay = pred ? (canShow ? `${pred.homeScore} - ${pred.awayScore}` : "🔒 Oculto") : "Sin pronosticar";
    const realDisplay = match.completed ? `${match.realHomeScore} - ${match.realAwayScore}` : (match.status === "IN_PLAY" ? `${match.liveHomeScore || 0} - ${match.liveAwayScore || 0} (${match.minute || "En Vivo"})` : "Por jugar");
    const row = document.createElement("div");
    row.className = "stats-match-row";
    row.innerHTML = `
      <div class="stats-match-team">${getCountryFlag(match.homeTeam)} ${match.homeTeam}</div>
      <div class="stats-match-scores"><span class="stats-pred-pill">Pronóstico: ${predDisplay}</span><span class="stats-real-pill">Resultado: ${realDisplay}</span></div>
      <div class="stats-match-team away">${match.awayTeam} ${getCountryFlag(match.awayTeam)}</div>`;
    listEl.appendChild(row);
  });
  openModal("userStatsModal");
};

window.confirmAndSavePrediction = async (matchId) => {
  if (!state.currentUser) return;
  const match = state.matches.find((m) => m.id === matchId);
  if (!match) return;
  if (isMatchUndetermined(match)) return alert("No puedes pronosticar este partido hasta que se definan los equipos.");
  const matchDateUTC = parseMatchDateAsUTC(match.date);
  if (matchDateUTC.getTime() - Date.now() < 60 * 60 * 1000) return alert("El tiempo límite para guardar este pronóstico ha expirado.");
  const homeVal = document.getElementById(`home_${matchId}`).value.trim();
  const awayVal = document.getElementById(`away_${matchId}`).value.trim();
  if (homeVal === "" || awayVal === "") return alert("Ingresa ambos marcadores.");
  if (!confirm("¿Guardar este pronóstico? Luego no se podrá editar.")) return;
  const uid = state.currentUser.uid;
  await db.collection(COLLECTIONS.predictions).doc(`${uid}_${matchId}`).set({
    uid,
    matchId,
    homeScore: parseInt(homeVal, 10),
    awayScore: parseInt(awayVal, 10),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
};

window.filterMatches = () => renderPredictions();

window.selectGroupTab = (groupCode, btn) => {
  state.activeGroupStage = groupCode;
  const container = document.getElementById("groupStageSelectorContainer");
  if (container) container.querySelectorAll(".btn-filter").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderGroupStageTab();
};

window.renderGroupStageTab = () => {
  const group = state.activeGroupStage || "A";
  const groupMatches = state.matches.filter((m) => m.group === group && m.stage === "Fase de Grupos");
  const teams = [...new Set(groupMatches.flatMap((m) => [m.homeTeam, m.awayTeam]))];
  const stats = {};
  teams.forEach((team) => {
    stats[team] = { name: team, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
  });
  groupMatches.forEach((m) => {
    const played = m.completed || m.status === "IN_PLAY";
    const home = m.completed ? m.realHomeScore : m.liveHomeScore;
    const away = m.completed ? m.realAwayScore : m.liveAwayScore;
    if (!played || home == null || away == null || !stats[m.homeTeam] || !stats[m.awayTeam]) return;
    stats[m.homeTeam].pj += 1; stats[m.homeTeam].gf += home; stats[m.homeTeam].gc += away;
    stats[m.awayTeam].pj += 1; stats[m.awayTeam].gf += away; stats[m.awayTeam].gc += home;
    if (home > away) { stats[m.homeTeam].pg += 1; stats[m.homeTeam].pts += 3; stats[m.awayTeam].pp += 1; }
    else if (away > home) { stats[m.awayTeam].pg += 1; stats[m.awayTeam].pts += 3; stats[m.homeTeam].pp += 1; }
    else { stats[m.homeTeam].pe += 1; stats[m.homeTeam].pts += 1; stats[m.awayTeam].pe += 1; stats[m.awayTeam].pts += 1; }
  });
  Object.values(stats).forEach((t) => { t.dg = t.gf - t.gc; });
  const sorted = Object.values(stats).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name));
  const tbody = document.getElementById("groupStandingsBody");
  if (tbody) {
    tbody.innerHTML = "";
    sorted.forEach((t, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i + 1}</td><td>${getCountryFlag(t.name)} ${t.name}</td><td>${t.pj}</td><td>${t.pg}</td><td>${t.pe}</td><td>${t.pp}</td><td>${t.gf}</td><td>${t.gc}</td><td>${t.dg}</td><td>${t.pts}</td>`;
      tbody.appendChild(tr);
    });
  }

  const list = document.getElementById("groupMatchesList");
  if (list) {
    list.innerHTML = "";
    const sortedMatches = [...groupMatches].sort((a, b) => parseMatchDateAsUTC(a.date) - parseMatchDateAsUTC(b.date));
    sortedMatches.forEach((m) => {
      const home = m.completed ? m.realHomeScore : (m.status === "IN_PLAY" ? (m.liveHomeScore ?? 0) : "-");
      const away = m.completed ? m.realAwayScore : (m.status === "IN_PLAY" ? (m.liveAwayScore ?? 0) : "-");
      const statusText = m.completed ? "Finalizado" : (m.status === "IN_PLAY" ? `En Vivo ${m.minute || ""}` : "Programado");
      const row = document.createElement("div");
      row.className = "group-match-row";
      row.innerHTML = `
        <div class="group-match-teams">
          <div class="group-match-team-line">${getCountryFlag(m.homeTeam)} ${m.homeTeam} <strong>${home}</strong></div>
          <div class="group-match-team-line">${getCountryFlag(m.awayTeam)} ${m.awayTeam} <strong>${away}</strong></div>
        </div>
        <div class="group-match-info">
          <span class="group-match-status-badge">${statusText}</span>
          <span class="group-match-date">${formatMatchDateToCaracas12h(m.date)}</span>
        </div>`;
      list.appendChild(row);
    });
  }
};

window.syncLiveResults = async () => {
  const syncBtn = document.getElementById("syncBtnText");
  if (syncBtn) syncBtn.textContent = "Actualizando...";
  if (!state.isAdmin) {
    if (syncBtn) syncBtn.textContent = "Solo admin";
    setTimeout(() => { if (syncBtn) syncBtn.textContent = "Actualizar Datos"; }, 2000);
    return alert("Solo un usuario admin puede sincronizar y guardar resultados.");
  }

  const CORS_PROXIES = [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?",
    "https://api.codetabs.com/v1/proxy?quest="
  ];
  const LIVE_API_URL = "https://worldcup26.ir/get/games";

  let games = null;
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(LIVE_API_URL), { signal: AbortSignal.timeout(8000) });
      if (!response.ok) continue;
      const data = await response.json();
      games = data.games || data;
      if (Array.isArray(games) && games.length > 0) break;
    } catch (_err) {}
  }
  if (!Array.isArray(games)) {
    if (syncBtn) syncBtn.textContent = "Sin conexión";
    setTimeout(() => { if (syncBtn) syncBtn.textContent = "Actualizar Datos"; }, 2500);
    return;
  }

  const batch = db.batch();
  let updates = 0;
  games.forEach((realMatch) => {
    const apiId = parseInt(realMatch.id, 10);
    const localMatch = state.matches.find((m) => m.apiId === apiId);
    if (!localMatch) return;
    const homeName = realMatch.home_team_name_en ? translateTeam(realMatch.home_team_name_en) : translateLabel(realMatch.home_team_label || "");
    const awayName = realMatch.away_team_name_en ? translateTeam(realMatch.away_team_name_en) : translateLabel(realMatch.away_team_label || "");
    const finished = realMatch.finished === "TRUE";
    const isLive = realMatch.time_elapsed && realMatch.time_elapsed !== "finished" && realMatch.time_elapsed !== "notstarted";
    const payload = {
      homeTeam: homeName || localMatch.homeTeam,
      awayTeam: awayName || localMatch.awayTeam,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (finished) {
      payload.realHomeScore = parseInt(realMatch.home_score, 10);
      payload.realAwayScore = parseInt(realMatch.away_score, 10);
      payload.completed = true;
      payload.status = "FINISHED";
      payload.liveHomeScore = null;
      payload.liveAwayScore = null;
      payload.minute = null;
    } else if (isLive) {
      payload.completed = false;
      payload.status = "IN_PLAY";
      payload.liveHomeScore = parseInt(realMatch.home_score, 10) || 0;
      payload.liveAwayScore = parseInt(realMatch.away_score, 10) || 0;
      payload.minute = realMatch.time_elapsed || "45'";
      payload.realHomeScore = null;
      payload.realAwayScore = null;
    }
    batch.set(db.collection(COLLECTIONS.matches).doc(localMatch.id), payload, { merge: true });
    updates++;
  });

  if (updates > 0) {
    await batch.commit();
    if (syncBtn) syncBtn.textContent = "✅ Actualizado";
  } else if (syncBtn) {
    syncBtn.textContent = "Sin cambios";
  }
  setTimeout(() => { if (syncBtn) syncBtn.textContent = "Actualizar Datos"; }, 2500);
};

window.addNewMatch = async () => {
  if (!state.isAdmin) {
    alert("Solo admin puede agregar partidos.");
    return;
  }
  const home = document.getElementById("newMatchHome")?.value;
  const away = document.getElementById("newMatchAway")?.value;
  const stage = document.getElementById("newMatchStage")?.value;
  const group = document.getElementById("newMatchGroup")?.value;
  const dateRaw = document.getElementById("newMatchDate")?.value;
  if (!home || !away || !stage || !group || !dateRaw) {
    alert("Completa todos los campos para agregar el partido.");
    return;
  }
  if (home === away) {
    alert("Los equipos local y visitante deben ser distintos.");
    return;
  }
  const newId = `m_${Date.now()}`;
  await db.collection(COLLECTIONS.matches).doc(newId).set({
    id: newId,
    stage,
    group,
    homeTeam: home,
    awayTeam: away,
    date: dateRaw.replace("T", " "),
    realHomeScore: null,
    realAwayScore: null,
    completed: false,
    status: "SCHEDULED",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  closeModal("addMatchModal");
};
