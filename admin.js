// admin.js - Enhanced admin panel with user/password login (Usuario: Admin, Password: 3696)
// Runs on admin.html and manipulates localStorage state.

// Country code map (same as in app.js)
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

function getCountryFlag(countryName) {
  if (!countryName) return "";
  const code = COUNTRY_CODES[countryName];
  if (!code) return "";
  return `<img src="https://flagcdn.com/w40/${code}.png" alt="Bandera de ${countryName}" class="country-flag-img" style="width:24px;height:auto;border-radius:2px;vertical-align:middle;margin-right:4px;">`;
}

// Admin credentials
const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = '3696';

function getState() {
  const matches = JSON.parse(localStorage.getItem('quiniela_matches') || '[]');
  return { matches };
}

function saveState(state) {
  localStorage.setItem('quiniela_matches', JSON.stringify(state.matches));
  // Preserve admin flag
  localStorage.setItem('quiniela_is_admin', 'true');
  // Notify other windows of the change so scores recalculate automatically
  window.dispatchEvent(new Event('storage'));
}

let adminTestMode = false;
let adminCurrentStage = '';

function toggleAdminTestMode(flag) {
  adminTestMode = flag;
}

function setStage(stage) {
  adminCurrentStage = stage;
  renderAdmin();
}
// expose to global scope for HTML onclick
window.setStage = setStage;

function adminLogout() {
  // Clear admin flag and redirect to home page
  localStorage.setItem('quiniela_is_admin', 'false');
  // Also update in-memory state if needed
  if (window.state) {
    window.state.isAdmin = false;
  }
  window.location.href = 'index.html';
}

function renderLogin() {
  const panel = document.getElementById('adminPanel');
  panel.innerHTML = `
    <div style="max-width:400px;margin:auto;">
      <h2>Acceso Administrador</h2>
      <input type="text" id="adminUser" placeholder="Usuario" value="${ADMIN_USERNAME}" style="width:100%;padding:8px;margin:10px 0;" disabled />
      <input type="password" id="adminPass" placeholder="Contraseña" style="width:100%;padding:8px;margin:10px 0;" />
      <button onclick="attemptLogin()" style="padding:8px 16px;background:var(--accent-soccer);color:#fff;border:none;border-radius:6px;cursor:pointer;">Entrar</button>
      <div id="loginMsg" style="color:var(--accent-red);margin-top:8px;display:none;">Usuario o contraseña incorrectos</div>
    </div>`;
}

function attemptLogin() {
  const user = document.getElementById('adminUser').value.trim();
  const pass = document.getElementById('adminPass').value;
  if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
    localStorage.setItem('quiniela_is_admin', 'true');
    renderAdmin();
  } else {
    const msg = document.getElementById('loginMsg');
    msg.style.display = 'block';
  }
}

function renderAdmin() {
  const { matches } = getState();
  // Reset match 73 to default values
  ensureDefaultMatch73(matches);
  const panel = document.getElementById('adminPanel');
  let html = '<h2>Actualizar Marcadores Finales</h2>';
  // Use the same grid layout as the main page for responsiveness
  html += '<div class="matches-grid">';
  // Iterate over all matches but render only those matching the selected stage (if any)
  matches.forEach((m, idx) => {
    if (adminCurrentStage && m.stage !== adminCurrentStage) return;
    const realHome = m.realHomeScore != null ? m.realHomeScore : '';
    const realAway = m.realAwayScore != null ? m.realAwayScore : '';
    const isCompleted = !!m.completed;
    html += `
    <div class="match-card">
      <div class="match-header">
        <span class="match-stage">${m.stage || ''}</span>
      </div>
      <div class="match-teams-score">
        <div class="team-row">
          <div class="team-info">
            ${getCountryFlag(m.homeTeam)}
            <input type="text" id="hn${idx}" value="${m.homeTeam}" class="input-text" placeholder="País Local" />
          </div>
          <input type="number" class="score-input" id="h${idx}" value="${realHome}" min="0" ${isCompleted ? 'disabled' : ''} />
        </div>
        <div class="team-row">
          <div class="team-info">
            ${getCountryFlag(m.awayTeam)}
            <input type="text" id="an${idx}" value="${m.awayTeam}" class="input-text" placeholder="País Visitante" />
          </div>
          <input type="number" class="score-input" id="a${idx}" value="${realAway}" min="0" ${isCompleted ? 'disabled' : ''} />
        </div>
      </div>
      <div class="card-footer">
        ${!isCompleted ? `<button class="btn" onclick="saveMatch(${idx})">Guardar</button>` : '<span style="color:green;font-weight:bold;">✓ Finalizado</span>'}
      </div>
    </div>`;
  });
  html += '</div>';
  panel.innerHTML = html;
}

function saveMatch(idx) {
  const { matches } = getState();
  const hVal = document.getElementById(`h${idx}`).value;
  const aVal = document.getElementById(`a${idx}`).value;
  const hnVal = document.getElementById(`hn${idx}`).value;
  const anVal = document.getElementById(`an${idx}`).value;
  const homeScore = hVal === '' ? null : parseInt(hVal);
  const awayScore = aVal === '' ? null : parseInt(aVal);
  if (homeScore !== null && awayScore !== null && hnVal.trim() !== '' && anVal.trim() !== '') {
    const match = matches[idx];
    const oldHome = match.homeTeam;
    const oldAway = match.awayTeam;
    match.homeTeam = hnVal.trim();
    match.awayTeam = anVal.trim();
    match.realHomeScore = homeScore;
    match.realAwayScore = awayScore;
    match.completed = true;
    match.status = 'FINISHED';
    // Update team name in all other matches
    matches.forEach(m => {
      if (m !== match) {
        if (m.homeTeam === oldHome) m.homeTeam = match.homeTeam;
        if (m.awayTeam === oldAway) m.awayTeam = match.awayTeam;
      }
    });
    if (!adminTestMode) {
      saveState({ matches });
    }
    renderAdmin();
  } else {
    alert('Introduce ambos marcadores y nombres de equipo');
  }
}

// Ensure match 73 is set to its default values on each admin load
function ensureDefaultMatch73(matches) {
  const defaultM73 = {
    id: "m73",
    apiId: 73,
    stage: "Dieciseisavos de Final",
    group: "R32",
    homeTeam: "Segundo Grupo A",
    awayTeam: "Segundo Grupo B",
    date: "2026-06-28 19:00",
    realHomeScore: null,
    realAwayScore: null,
    completed: false,
    status: undefined
  };
  matches.forEach(m => {
    if (m.id === "m73") {
      Object.assign(m, defaultM73);
    }
  });
}

// Call this in renderAdmin before rendering

// Initialize admin panel
function initAdmin(){
  const isAdmin = localStorage.getItem('quiniela_is_admin') === 'true';
  if (isAdmin) {
    renderAdmin();
  } else {
    renderLogin();
  }
}
initAdmin();
