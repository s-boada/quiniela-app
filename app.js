// Audioplace Quiniela 2026 - API REST + JWT

const api = window.quinielaApi;

const SESSION_KEY = "quiniela_current_user";
const ACTIVE_TAB_KEY = "quiniela_active_tab";
const LAST_USERNAME_KEY = "quiniela_last_username";

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

let pollingTimer = null;

const PREDICTION_LOCK_MS = 5 * 60 * 1000;

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

window.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.remove("dark-theme");
  setupNavigation();
  setupModalCloseOnOverlay();
  populateCountrySelects();
  window.onQuinielaUnauthorized = handleUnauthorized;
  await initAuth();
  startPolling();
  switchTab(state.activeTab);
});

function handleUnauthorized() {
  state.currentUser = null;
  state.isAdmin = false;
  localStorage.removeItem(SESSION_KEY);
  renderApp();
}

async function loadData() {
  if (!api.getToken()) return;
  try {
    const data = await api.fetchData();
    state.users = data.users || [];
    state.matches = data.matches || [];
    state.predictions = data.predictions || {};
    state.matches.sort((a, b) => parseMatchDateAsUTC(a.date).getTime() - parseMatchDateAsUTC(b.date).getTime());
    renderApp();
  } catch (error) {
    if (error.message !== "No autenticado" && error.message !== "Token inválido o expirado") {
      console.error("Error cargando datos:", error);
    }
  }
}

function startPolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(() => {
    if (api.getToken()) loadData();
  }, 30000);
}

async function initAuth() {
  if (!api.getToken()) {
    state.currentUser = null;
    state.isAdmin = false;
    renderApp();
    return;
  }

  try {
    const { user } = await api.getMe();
    applyCurrentUser(user);
    await loadData();
  } catch (_error) {
    api.logout();
    state.currentUser = null;
    state.isAdmin = false;
    renderApp();
  }
}

function applyCurrentUser(user) {
  state.currentUser = {
    uid: user.id,
    id: user.id,
    name: user.displayName,
    displayName: user.displayName,
    role: user.role || "user",
    avatar: user.avatar || "⚽"
  };
  state.isAdmin = state.currentUser.role === "admin";
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.currentUser));
}

function setupModalCloseOnOverlay() {
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });
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

function isMatchUndetermined(match) {
  if (!match || !match.homeTeam || !match.awayTeam) return true;
  const placeholders = ["Ganador", "Segundo", "Perdedor", "Grupo", "3ro", "3er", "Winner", "Runner-up", "3rd", "Loser"];
  return placeholders.some((p) => match.homeTeam.includes(p) || match.awayTeam.includes(p));
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
    const isLockedByTime = matchDateUTC.getTime() - Date.now() < PREDICTION_LOCK_MS;
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
  document.getElementById("loginUsername").value = localStorage.getItem(LAST_USERNAME_KEY) || "";
  document.getElementById("loginPassword").value = "";
  openModal("loginModal");
};

window.loginUser = async () => {
  const username = document.getElementById("loginUsername").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value.trim();
  if (!username || !password) return alert("Ingresa usuario y contraseña.");
  try {
    const { token, user } = await api.login(username, password);
    api.setToken(token);
    applyCurrentUser(user);
    localStorage.setItem(LAST_USERNAME_KEY, username);
    closeModal("loginModal");
    await loadData();
    renderApp();
  } catch (error) {
    alert(`No se pudo iniciar sesión: ${error.message}`);
  }
};

window.logoutUser = async () => {
  if (!confirm("¿Seguro que quieres cerrar sesión?")) return;
  api.logout();
  state.currentUser = null;
  state.isAdmin = false;
  state.users = [];
  state.matches = [];
  state.predictions = {};
  localStorage.removeItem(SESSION_KEY);
  if (state.activeTab === "predictions" || state.activeTab === "groupStage") {
    switchTab("leaderboard");
  } else {
    renderApp();
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
  if (matchDateUTC.getTime() - Date.now() < PREDICTION_LOCK_MS) return alert("El tiempo límite para guardar este pronóstico ha expirado (5 minutos antes del inicio).");
  const homeVal = document.getElementById(`home_${matchId}`).value.trim();
  const awayVal = document.getElementById(`away_${matchId}`).value.trim();
  if (homeVal === "" || awayVal === "") return alert("Ingresa ambos marcadores.");
  if (!confirm("¿Guardar este pronóstico? Luego no se podrá editar.")) return;
  try {
    await api.savePrediction(matchId, parseInt(homeVal, 10), parseInt(awayVal, 10));
    await loadData();
  } catch (error) {
    alert(`No se pudo guardar: ${error.message}`);
  }
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

  try {
    const result = await api.syncLiveResults();
    state.matches = result.matches || state.matches;
    state.matches.sort((a, b) => parseMatchDateAsUTC(a.date).getTime() - parseMatchDateAsUTC(b.date).getTime());
    renderApp();
    if (syncBtn) syncBtn.textContent = result.updates > 0 ? "✅ Actualizado" : "Sin cambios";
  } catch (_error) {
    if (syncBtn) syncBtn.textContent = "Sin conexión";
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
  try {
    await api.addMatch({
      stage,
      group,
      homeTeam: home,
      awayTeam: away,
      date: dateRaw.replace("T", " ")
    });
    await loadData();
    closeModal("addMatchModal");
  } catch (error) {
    alert(`No se pudo agregar el partido: ${error.message}`);
  }
};
