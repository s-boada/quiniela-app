// Lógica de Negocio y Estado - Audioplace Quiniela 2026

// Estado global de la aplicación
let state = {
  users: [],
  matches: [],
  predictions: {},
  currentUser: null,
  activeTab: 'leaderboard',
  currentPredictionFilter: 'All',
  activeGroupStage: 'A',
  isAdmin: false
};

let selectedAvatarEmoji = '⚽';

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
  return `<img src="https://flagcdn.com/w40/${code}.png" alt="Bandera de ${countryName}" class="country-flag-img" style="width: 24px; height: auto; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); object-fit: contain; vertical-align: middle; display: inline-block;">`;
}

function isMatchUndetermined(match) {
  if (!match || !match.homeTeam || !match.awayTeam) return true;
  const placeholders = ["Ganador", "Segundo", "Perdedor", "Grupo", "3ro", "3er", "Winner", "Runner-up", "3rd", "Loser"];
  const homePlaceholder = placeholders.some(p => match.homeTeam.includes(p));
  const awayPlaceholder = placeholders.some(p => match.awayTeam.includes(p));
  return homePlaceholder || awayPlaceholder;
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

// Convertir fecha de partido UTC (de la base de datos) a objeto Date
function parseMatchDateAsUTC(dateStr) {
  if (!dateStr) return new Date();
  const utcStr = dateStr.replace(' ', 'T') + 'Z';
  return new Date(utcStr);
}

// Formatear la fecha del partido (almacenada en UTC) al horario de Caracas (UTC-4) y formato 12h (AM/PM)
function formatMatchDateToCaracas12h(dateStr) {
  if (!dateStr) return "";
  const utcDate = parseMatchDateAsUTC(dateStr);
  
  const formatter = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return formatter.format(utcDate);
}

// ==========================================
// CONFIGURACIÓN DE API (MUNDIAL 2026)
// ==========================================
const API_CONFIG = {
  // Simulador de API en Vivo (conectado a fuente de datos en tiempo real)
  URL: './live_api.json'
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  // Force light theme as default; remove any dark mode class
  document.body.classList.remove('dark-theme');
  initLocalStorage();
  setupNavigation();
  populateCountrySelects();
  switchTab(state.activeTab); // Mantener la pestaña activa tras recarga
  
  // Sincronizar marcadores finalizados en segundo plano al cargar
  syncLiveResults();
  
  // Sincronizar automáticamente cada 1 minuto (para actualización inmediata al finalizar)
  setInterval(syncLiveResults, 1 * 60 * 1000);
});

// Inicializar tema al cargar
function initTheme() {
  const savedTheme = localStorage.getItem('quiniela_theme');
  const body = document.body;
  const icon = document.getElementById('themeToggleIcon');
  if (savedTheme === 'dark') {
    body.classList.add('dark-theme');
    if (icon) icon.textContent = '☀️';
  } else {
    body.classList.remove('dark-theme');
    if (icon) icon.textContent = '🌙';
  }
}

// Alternar entre modo oscuro y claro
window.toggleTheme = () => {
  const body = document.body;
  const icon = document.getElementById('themeToggleIcon');
  body.classList.toggle('dark-theme');
  const isDark = body.classList.contains('dark-theme');
  localStorage.setItem('quiniela_theme', isDark ? 'dark' : 'light');
  if (icon) {
    icon.textContent = isDark ? '☀️' : '🌙';
  }
};

// Función de normalización de nombres para vinculación automática
// Remueve acentos y espacios adicionales, y convierte a minúsculas
function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remueve marcas de acentuación
}

// Inicializar almacenamiento local con semillas si no existen datos previos
function initLocalStorage() {
  // VERSIÓN DE DATOS: Si la versión almacenada no coincide, resetear a datos frescos
  const DATA_VERSION = 'v2026_104_names'; // Bump a 104_names: Fase de grupos completa + eliminatorias y nombres de usuarios completos
  const storedVersion = localStorage.getItem('quiniela_data_version');
  
  if (storedVersion !== DATA_VERSION) {
    // Solo resetear los partidos para actualizar marcadores/simulaciones sin borrar los PINs ni pronósticos de los usuarios
    localStorage.removeItem('quiniela_matches');
    localStorage.setItem('quiniela_data_version', DATA_VERSION);
  }

  // Cargar Partidos
  const storedMatches = localStorage.getItem('quiniela_matches');
  if (storedMatches) {
    state.matches = JSON.parse(storedMatches);
  } else {
    state.matches = [...INITIAL_MATCHES];
    localStorage.setItem('quiniela_matches', JSON.stringify(state.matches));
  }

  // Cargar Usuarios
  const storedUsers = localStorage.getItem('quiniela_users');
  if (storedUsers) {
    state.users = JSON.parse(storedUsers);
    // Actualizar nombres pre-cargados a sus versiones completas conservando PIN y avatar
    INITIAL_USERS.forEach(initUser => {
      const existing = state.users.find(u => u.id === initUser.id);
      if (existing) {
        existing.name = initUser.name;
      } else {
        state.users.push(initUser);
      }
    });
    localStorage.setItem('quiniela_users', JSON.stringify(state.users));
  } else {
    state.users = [...INITIAL_USERS];
    localStorage.setItem('quiniela_users', JSON.stringify(state.users));
  }

  // Cargar Pronósticos
  const storedPredictions = localStorage.getItem('quiniela_predictions');
  if (storedPredictions) {
    state.predictions = JSON.parse(storedPredictions);
  } else {
    state.predictions = { ...INITIAL_PREDICTIONS };
    localStorage.setItem('quiniela_predictions', JSON.stringify(state.predictions));
  }

  // Cargar Usuario Activo
  const storedCurrentUser = localStorage.getItem('quiniela_current_user');
  if (storedCurrentUser) {
    const parsed = JSON.parse(storedCurrentUser);
    // Validar que el usuario guardado sigue existiendo
    if (parsed === 'admin' || state.users.find(u => u.id === parsed?.id)) {
      state.currentUser = parsed;
    } else {
      state.currentUser = null;
    }
  } else {
    // Iniciar siempre desconectado
    state.currentUser = null;
    localStorage.removeItem('quiniela_current_user');
  }

  // Cargar estado admin
  const storedAdmin = localStorage.getItem('quiniela_is_admin');
  state.isAdmin = storedAdmin === 'true';

  // Cargar Pestaña Activa
  const storedActiveTab = localStorage.getItem('quiniela_active_tab');
  if (storedActiveTab) {
    state.activeTab = storedActiveTab;
  } else {
    state.activeTab = 'leaderboard';
  }
}

// Guardar estado en LocalStorage
function saveStateToStorage() {
  localStorage.setItem('quiniela_matches', JSON.stringify(state.matches));
  localStorage.setItem('quiniela_predictions', JSON.stringify(state.predictions));
  localStorage.setItem('quiniela_users', JSON.stringify(state.users));
  localStorage.setItem('quiniela_current_user', JSON.stringify(state.currentUser));
  localStorage.setItem('quiniela_is_admin', state.isAdmin ? 'true' : 'false');
}

// ==========================================
// ==========================================
// SINCRONIZACIÓN AUTOMÁTICA CON INTERNET
// ==========================================

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

function translateTeam(engName) {
  if (!engName) return "";
  return TEAM_TRANSLATIONS[engName] || engName;
}

async function syncLiveResults() {
  const syncBtn = document.getElementById('syncBtnText');
  if (syncBtn) syncBtn.textContent = 'Actualizando marcadores...';

  let changesMade = false;
  let internetSuccess = false;

  // ═══════════════════════════════════════════════════════════════
  // PASO 1: INTENTAR API DE INTERNET (PRIORIDAD - Datos en vivo)
  // ═══════════════════════════════════════════════════════════════
  const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ];
  const LIVE_API_URL = 'https://worldcup26.ir/get/games';

  for (const proxy of CORS_PROXIES) {
    if (internetSuccess) break;
    try {
      const internetResp = await fetch(proxy + encodeURIComponent(LIVE_API_URL), { signal: AbortSignal.timeout(8000) });
      if (!internetResp.ok) continue;
      const internetData = await internetResp.json();
      const games = internetData.games || internetData;
      
      if (games && Array.isArray(games) && games.length > 0) {
        games.forEach(realMatch => {
          let homeName = "";
          if (realMatch.home_team_name_en) {
            homeName = translateTeam(realMatch.home_team_name_en);
          } else if (realMatch.home_team_label) {
            homeName = translateLabel(realMatch.home_team_label);
          }
          
          let awayName = "";
          if (realMatch.away_team_name_en) {
            awayName = translateTeam(realMatch.away_team_name_en);
          } else if (realMatch.away_team_label) {
            awayName = translateLabel(realMatch.away_team_label);
          }
          
          let localMatch = null;
          const apiId = parseInt(realMatch.id);
          if (!isNaN(apiId)) {
            localMatch = state.matches.find(m => m.apiId === apiId);
          }
          if (!localMatch) {
            localMatch = state.matches.find(m => 
              normalizeName(m.homeTeam) === normalizeName(homeName) && 
              normalizeName(m.awayTeam) === normalizeName(awayName)
            );
          }
          
          if (localMatch) {
            // Update team names dynamically if they changed from placeholders to actual teams
            if (homeName && localMatch.homeTeam !== homeName) {
              localMatch.homeTeam = homeName;
              changesMade = true;
            }
            if (awayName && localMatch.awayTeam !== awayName) {
              localMatch.awayTeam = awayName;
              changesMade = true;
            }

            const finished = realMatch.finished === "TRUE";
            const isLive = realMatch.time_elapsed && realMatch.time_elapsed !== "finished" && realMatch.time_elapsed !== "notstarted";
            
            if (finished) {
              const hScore = parseInt(realMatch.home_score);
              const aScore = parseInt(realMatch.away_score);
              if (!isNaN(hScore) && !isNaN(aScore)) {
                if (!localMatch.completed || localMatch.realHomeScore !== hScore || localMatch.realAwayScore !== aScore) {
                  localMatch.realHomeScore = hScore;
                  localMatch.realAwayScore = aScore;
                  localMatch.completed = true;
                  localMatch.status = 'FINISHED';
                  localMatch.liveHomeScore = null;
                  localMatch.liveAwayScore = null;
                  localMatch.minute = null;
                  changesMade = true;
                }
              }
            } else if (isLive) {
              const hScore = parseInt(realMatch.home_score) || 0;
              const aScore = parseInt(realMatch.away_score) || 0;
              if (localMatch.status !== 'IN_PLAY' || localMatch.liveHomeScore !== hScore || localMatch.liveAwayScore !== aScore) {
                localMatch.status = 'IN_PLAY';
                localMatch.liveHomeScore = hScore;
                localMatch.liveAwayScore = aScore;
                localMatch.minute = realMatch.time_elapsed || "45'";
                localMatch.completed = false;
                localMatch.realHomeScore = null;
                localMatch.realAwayScore = null;
                changesMade = true;
              }
            }
          }
        });
        internetSuccess = true;
        console.log("✅ Sincronización en vivo desde worldcup26.ir exitosa.");
      }
    } catch (netErr) {
      console.warn(`⚠️ Proxy ${proxy} falló:`, netErr.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 2: RESPALDO LOCAL (live_api.json) - Solo si internet falló
  // ═══════════════════════════════════════════════════════════════
  if (!internetSuccess) {
    try {
      const response = await fetch(API_CONFIG.URL);
      if (response.ok) {
        const data = await response.json();
        if (data && data.matches && Array.isArray(data.matches)) {
          data.matches.forEach(realMatch => {
            let localMatch = null;
            const apiId = parseInt(realMatch.id);
            if (!isNaN(apiId)) {
              localMatch = state.matches.find(m => m.apiId === apiId);
            }
            if (!localMatch) {
              localMatch = state.matches.find(m => 
                normalizeName(m.homeTeam) === normalizeName(realMatch.homeTeam.shortName || '') && 
                normalizeName(m.awayTeam) === normalizeName(realMatch.awayTeam.shortName || '')
              );
            }
            
            if (localMatch) {
              const homeName = realMatch.homeTeam?.shortName;
              const awayName = realMatch.awayTeam?.shortName;
              if (homeName && localMatch.homeTeam !== homeName) {
                localMatch.homeTeam = homeName;
                changesMade = true;
              }
              if (awayName && localMatch.awayTeam !== awayName) {
                localMatch.awayTeam = awayName;
                changesMade = true;
              }

              if (realMatch.status === 'FINISHED') {
                const hScore = realMatch.score.fullTime.home;
                const aScore = realMatch.score.fullTime.away;
                if (!localMatch.completed || localMatch.realHomeScore !== hScore || localMatch.realAwayScore !== aScore) {
                  localMatch.realHomeScore = hScore;
                  localMatch.realAwayScore = aScore;
                  localMatch.completed = true;
                  localMatch.status = 'FINISHED';
                  localMatch.liveHomeScore = null;
                  localMatch.liveAwayScore = null;
                  localMatch.minute = null;
                  changesMade = true;
                }
              } else if (realMatch.status === 'IN_PLAY') {
                const hScore = realMatch.score.fullTime.home !== null ? realMatch.score.fullTime.home : 0;
                const aScore = realMatch.score.fullTime.away !== null ? realMatch.score.fullTime.away : 0;
                if (localMatch.status !== 'IN_PLAY' || localMatch.liveHomeScore !== hScore || localMatch.liveAwayScore !== aScore) {
                  localMatch.status = 'IN_PLAY';
                  localMatch.liveHomeScore = hScore;
                  localMatch.liveAwayScore = aScore;
                  localMatch.minute = realMatch.minute || "45'";
                  localMatch.completed = false;
                  localMatch.realHomeScore = null;
                  localMatch.realAwayScore = null;
                  changesMade = true;
                }
              }
            }
          });
          console.log("📁 Sincronización desde live_api.json local (respaldo).");
        }
      }
    } catch (err) {
      console.error("❌ Error en sincronización local:", err.message);
    }
  }

  if (changesMade) {
    saveStateToStorage();
    renderApp();
  }
  
  if (syncBtn) syncBtn.textContent = internetSuccess ? '✅ Datos Actualizados' : '⚠️ Sin conexión (datos locales)';
  setTimeout(() => { if (syncBtn) syncBtn.textContent = 'Actualizar Datos'; }, 3000);
}


// ==========================================
// CÁLCULO DE PUNTOS
// ==========================================
// Poblar los selects del formulario de agregar partidos
function populateCountrySelects() {
  const homeSelect = document.getElementById('newMatchHome');
  const awaySelect = document.getElementById('newMatchAway');
  
  if (!homeSelect || !awaySelect) return;
  
  // Limpiar
  homeSelect.innerHTML = '';
  awaySelect.innerHTML = '';
  
  // Agregar cada país
  COUNTRIES.sort().forEach(country => {
    const optHome = document.createElement('option');
    optHome.value = country;
    optHome.textContent = country;
    homeSelect.appendChild(optHome);
    
    const optAway = document.createElement('option');
    optAway.value = country;
    optAway.textContent = country;
    awaySelect.appendChild(optAway);
  });
  
  // Configurar valores por defecto distintos
  if (homeSelect.options.length > 0) homeSelect.selectedIndex = 0;
  if (awaySelect.options.length > 1) awaySelect.selectedIndex = 1;
}

// Configurar comportamiento de pestañas y botones de navegación
function setupNavigation() {
  window.switchTab = (tabId) => {
    state.activeTab = tabId;
    localStorage.setItem('quiniela_active_tab', tabId);
    
    // Quitar clase activa a botones de pestañas y agregar a la seleccionada
    document.querySelectorAll('.tab-link').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Activar el botón correspondiente
    const eventButton = Array.from(document.querySelectorAll('.tab-link')).find(btn => {
      return btn.getAttribute('onclick').includes(`'${tabId}'`);
    });
    if (eventButton) eventButton.classList.add('active');
    
    // Mostrar/ocultar paneles
    document.querySelectorAll('.tab-content').forEach(section => {
      section.classList.remove('active');
    });
    const activeSection = document.getElementById(tabId);
    if (activeSection) activeSection.classList.add('active');
    
    // Renderizar contenidos dinámicos
    renderApp();
  };
}

// ==========================================
// MÓDULO DE CÁLCULO DE PUNTUACIONES
// ==========================================

// Calcula los puntos acumulados por un usuario bajo el sistema:
// - Acierto tendencia (ganador/empate): 1 punto
// - Acierto exacto (marcador y goles): 4 puntos
function calculateUserPoints(userId) {
  let points = 0;
  let exactCount = 0;
  let outcomeCount = 0;
  let predictedCount = 0;

  state.matches.forEach(match => {
    // Solo se puntúan partidos completados por el admin
    if (!match.completed) return;

    const prediction = state.predictions[`${userId}_${match.id}`];
    if (!prediction) return;
    
    predictedCount++;
    const predHome = parseInt(prediction.homeScore);
    const predAway = parseInt(prediction.awayScore);
    const realHome = match.realHomeScore;
    const realAway = match.realAwayScore;

    if (isNaN(predHome) || isNaN(predAway) || realHome === null || realAway === null) return;

    // Caso 1: Marcador Exacto (4 Puntos)
    if (predHome === realHome && predAway === realAway) {
      points += 4;
      exactCount++;
    } 
    // Caso 2: Acertar Ganador o Empate sin marcador exacto (1 Punto)
    else if (Math.sign(predHome - predAway) === Math.sign(realHome - realAway)) {
      points += 1;
      outcomeCount++;
    }
  });

  return {
    totalPoints: points,
    exactHits: exactCount,
    outcomeHits: outcomeCount,
    totalPredicted: predictedCount
  };
}

// ==========================================
// RENDERIZADO DE VISTAS DINÁMICAS
// ==========================================

function renderApp() {
  // Existing render logic remains unchanged

  updateUserBadge();
  
  if (state.activeTab === 'leaderboard') {
    renderLeaderboard();
  } else if (state.activeTab === 'predictions') {
    // Verificar acceso a "Mis Marcadores" (tab predictions)
    if (!state.currentUser) {
      document.getElementById('predictionsContent').style.display = 'none';
      document.getElementById('predictionsPrivateMessage').style.display = 'block';
      document.getElementById('predictionsPrivateMessage').innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <h2 style="color: var(--text-dark); margin-bottom: 15px;">🔒 Acceso Privado</h2>
          <p style="color: var(--text-light); margin-bottom: 25px;">Debes iniciar sesión con tu usuario y PIN para ver o editar tus marcadores.</p>
          <button class="btn-primary" onclick="openLoginModal()" style="padding: 12px 30px; font-size: 1.1rem; border-radius: 8px;">Iniciar Sesión</button>
        </div>
      `;
      return;
    }
    document.getElementById('predictionsContent').style.display = 'block';
    document.getElementById('predictionsPrivateMessage').style.display = 'none';
    renderPredictions();
  } else if (state.activeTab === 'groupStage') {
    if (!state.currentUser) {
      switchTab('leaderboard');
      return;
    }
    renderGroupStageTab();
  } else if (state.activeTab === 'premios') {
    renderPremiosTab();
  }
}

// Actualizar barra de estado del usuario actual en la cabecera
function updateUserBadge() {
  const loggedOutControls = document.getElementById('loggedOutControls');
  const loggedInControls = document.getElementById('loggedInControls');
  const nameEl = document.getElementById('currentUserName');
  const avatarEl = document.getElementById('currentUserAvatar');
  const groupStageLink = document.getElementById('groupStageTabLink');
  const premiosLink = document.getElementById('premiosTabLink');
  
  if (state.currentUser) {
    if (loggedOutControls) loggedOutControls.style.display = 'none';
    if (loggedInControls) loggedInControls.style.display = 'flex';
    if (nameEl) {
      const simpleName = state.currentUser.name.split(' ')[0];
      nameEl.textContent = simpleName;
    }
    if (avatarEl) avatarEl.textContent = state.currentUser.avatar || '⚽';
    if (groupStageLink) groupStageLink.style.display = 'inline-block';
    if (premiosLink) premiosLink.style.display = 'inline-block';
  } else {
    if (loggedOutControls) loggedOutControls.style.display = 'flex';
    if (loggedInControls) loggedInControls.style.display = 'none';
    if (groupStageLink) groupStageLink.style.display = 'none';
    if (premiosLink) premiosLink.style.display = 'inline-block';
  }
}

// Renderizar tabla de clasificación general
function renderLeaderboard() {
  const leaderboardSection = document.getElementById('leaderboard');
  if (!leaderboardSection) return;

  if (!state.currentUser) {
    leaderboardSection.innerHTML = `
      <div class="welcome-container" style="text-align: center; padding: 40px 20px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--border-color); box-shadow: var(--shadow-glow); max-width: 800px; margin: 20px auto 0 auto;">
        <span style="font-size: 4rem; display: block; margin-bottom: 20px; animation: float 3s ease-in-out infinite;">🏆</span>
        <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 15px; background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-soccer) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          ¡Bienvenido a Audioplace Quiniela 2026!
        </h2>
        <p style="color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 20px; line-height: 1.6;">
          Compite con tus amigos prediciendo los resultados del Mundial 2026. 
          Los marcadores y tiempos de juego se actualizan automáticamente en tiempo real.
        </p>
        
        <div class="quote-container" style="font-style: italic; color: var(--text-secondary); margin: 20px auto 25px auto; padding: 15px 20px; border-left: 4px solid var(--accent-soccer); background: rgba(2, 86, 214, 0.02); max-width: 600px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; text-align: left;">
          <p style="font-size: 1.1rem; font-weight: 500; margin-bottom: 5px; color: var(--text-primary);">
            "El que sabe sabe y el que no sabe, que sepa"
          </p>
          <cite style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600; display: block; text-align: right;">
            — Nicotósteles
          </cite>
        </div>

        <div style="background: rgba(251, 191, 36, 0.03); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: var(--radius-sm); padding: 25px; margin-bottom: 35px; text-align: left;">
          <h3 style="font-weight: 700; margin-bottom: 15px; color: var(--accent-gold); display: flex; align-items: center; gap: 8px;">
            🎁 Premios de la Quiniela:
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
            <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 15px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.01);">
              <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent-gold);">🏆 1er Lugar</div>
              <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary);">100$</div>
            </div>
            <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 15px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.01);">
              <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent-silver);">🥈 2do Lugar</div>
              <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary);">50$</div>
            </div>
            <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 15px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.01);">
              <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent-bronze);">🥉 3er Lugar</div>
              <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary);">20$</div>
            </div>
          </div>
          
          <div style="margin-top: 20px; text-align: center; font-size: 0.95rem; color: var(--text-secondary); font-weight: 600; padding-top: 15px; border-top: 1px dashed var(--border-color); opacity: 0.85;">
            ¿Quedaste después del 3er lugar? Muchas gracias por participar, sigue intentando.
          </div>
        </div>
        
        <div style="background: rgba(2, 86, 214, 0.04); border: 1px solid rgba(2, 86, 214, 0.1); border-radius: var(--radius-sm); padding: 25px; margin-bottom: 35px; text-align: left;">
          <h3 style="font-weight: 700; margin-bottom: 15px; color: var(--accent-soccer); display: flex; align-items: center; gap: 8px;">
            📋 Reglas del Juego:
          </h3>
          <ul style="list-style: none; display: flex; flex-direction: column; gap: 12px; font-size: 0.95rem; padding: 0;">
            <li style="display: flex; align-items: center; gap: 10px;">⚽ <strong>4 Puntos (Marcador Exacto):</strong> Aciertas al ganador/empate y los goles exactos de ambos equipos.</li>
            <li style="display: flex; align-items: center; gap: 10px;">🏃‍♂️ <strong>1 Punto (Tendencia):</strong> Aciertas si gana el local, visitante o hay empate, pero con goles distintos.</li>
            <li style="display: flex; align-items: center; gap: 10px;">❌ <strong>0 Puntos:</strong> No aciertas la tendencia del partido.</li>
          </ul>
        </div>
        
        <div style="background: var(--bg-primary); border-radius: var(--radius-sm); padding: 25px; border: 1px dashed var(--border-color);">
          <h4 style="font-weight: 700; margin-bottom: 10px; font-size: 1.1rem;">🔑 ¡Comienza ahora mismo!</h4>
          <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 25px;">
            Regístrate ingresando tu <strong>Nombre</strong> y establece tu propio <strong>PIN privado</strong> para proteger tus predicciones.
          </p>
          <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="openRegisterUserModal()" style="padding: 12px 25px; font-size: 1rem;">
              Registrarse con Nombre y PIN
            </button>
            <button class="btn btn-outline" onclick="openLoginModal()" style="padding: 12px 25px; font-size: 1rem;">
              Ya tengo PIN (Iniciar Sesión)
            </button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Restaurar estructura original de la pestaña Ranking si fue sobrescrita
  leaderboardSection.innerHTML = `
    <div class="leaderboard-container">
      <div class="leaderboard-header">
        <h2>Ranking General</h2>
        <span class="filter-label" id="userCountLabel"></span>
      </div>
      <div class="leaderboard-list" id="leaderboardList">
        <!-- Dinámico en JS -->
      </div>
    </div>
  `;

  const leaderboardList = document.getElementById('leaderboardList');
  const userCountLabel = document.getElementById('userCountLabel');
  
  if (!leaderboardList) return;
  
  leaderboardList.innerHTML = '';
  
  // Calcular puntajes de todos los usuarios
  const scoreboard = state.users.map(user => {
    const stats = calculateUserPoints(user.id);
    return {
      user,
      ...stats
    };
  });
  
  // Ordenar de mayor a menor puntaje (criterio desempate: mayor número de hits exactos, luego alfabético)
  scoreboard.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (b.exactHits !== a.exactHits) {
      return b.exactHits - a.exactHits;
    }
    return a.user.name.localeCompare(b.user.name);
  });
  
  userCountLabel.textContent = `${state.users.length} Participantes`;
  
  if (scoreboard.length === 0) {
    leaderboardList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <p style="font-size: 1.2rem;">Aún no hay usuarios registrados.</p>
        <button class="btn btn-primary" style="margin-top: 15px;" onclick="openRegisterUserModal()">
          Registrar el Primer Usuario
        </button>
      </div>
    `;
    return;
  }
  
  scoreboard.forEach((row, index) => {
    const rank = index + 1;
    const isCurrent = state.currentUser && state.currentUser.id === row.user.id;
    
    let rankClass = `rank-${rank}`;
    if (rank > 3) rankClass = 'rank-other';
    
    const item = document.createElement('div');
    item.className = `leaderboard-item ${rankClass} ${isCurrent ? 'is-current' : ''}`;
    item.onclick = () => openUserStatsModal(row.user.id);
    
    // Obtener los detalles visuales de los aciertos
    item.innerHTML = `
      <div class="rank-badge">
        <span class="rank">${rank}</span>
      </div>
      <div>
        <div class="leaderboard-name">${row.user.name} ${isCurrent ? '<small style="color: var(--accent-soccer); font-weight: normal; margin-left: 5px;">(Tú)</small>' : ''}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">Ver estadísticas de juego</div>
      </div>
      <div class="leaderboard-stats">
        <span>Exactos (4pts): <strong>${row.exactHits}</strong></span>
        <span>Ganador (1pt): <strong>${row.outcomeHits}</strong></span>
      </div>
      <div class="leaderboard-points">
        ${row.totalPoints} <span class="pts-label">PTS</span>
      </div>
    `;
    
    leaderboardList.appendChild(item);
  });
}

// Renderizar grilla de pronósticos del usuario actual
function renderPredictions() {
  const grid = document.getElementById('predictionsGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (!state.currentUser) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <p style="font-size: 1.2rem; color: var(--text-secondary); margin-bottom: 20px;">
          Debes iniciar sesión para ingresar pronósticos.
        </p>
      </div>
    `;
    return;
  }
  
  const currentUserId = state.currentUser.id;
  const stageVal = document.getElementById('stageFilter').value;
  const groupVal = document.getElementById('groupFilter').value;
  
  // Filtrar los partidos
  const filteredMatches = state.matches.filter(match => {
    if (stageVal !== 'All' && match.stage !== stageVal) return false;
    if (groupVal !== 'All' && match.group !== groupVal) return false;
    
    const predictionKey = `${currentUserId}_${match.id}`;
    const prediction = state.predictions[predictionKey];
    const hasPred = prediction && prediction.homeScore !== null && prediction.homeScore !== '' && prediction.awayScore !== null && prediction.awayScore !== '';
    
    if (state.currentPredictionFilter === 'Pending') {
      return !hasPred && !match.completed;
    }
    if (state.currentPredictionFilter === 'Completed') {
      return hasPred || match.completed;
    }
    return true;
  });
  
  // Ordenar cronológicamente de forma estricta
  filteredMatches.sort((a, b) => {
    return parseMatchDateAsUTC(a.date).getTime() - parseMatchDateAsUTC(b.date).getTime();
  });
  
  if (filteredMatches.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        No se encontraron partidos para los filtros aplicados.
      </div>
    `;
    return;
  }
  
  // Renderizar cada tarjeta de partido
  filteredMatches.forEach(match => {
    const card = document.createElement('div');
    const predictionKey = `${currentUserId}_${match.id}`;
    const prediction = state.predictions[predictionKey] || { homeScore: '', awayScore: '' };
    
    const hasPrediction = prediction.homeScore !== '' && prediction.awayScore !== '';
    
    const isLive = match.status === 'IN_PLAY';
    card.className = `match-card ${match.completed ? 'is-completed' : ''} ${isLive ? 'is-live' : ''} ${hasPrediction ? 'has-prediction' : ''}`;
    
    // Calcular puntos obtenidos si el partido ya terminó
    let pointsHtml = '';
    if (match.completed && hasPrediction) {
      const predHome = parseInt(prediction.homeScore);
      const predAway = parseInt(prediction.awayScore);
      const realHome = match.realHomeScore;
      const realAway = match.realAwayScore;
      
      if (predHome === realHome && predAway === realAway) {
        pointsHtml = `<span class="match-points-awarded">+4 pts (Exacto)</span>`;
      } else if (Math.sign(predHome - predAway) === Math.sign(realHome - realAway)) {
        pointsHtml = `<span class="match-points-awarded outcome">+1 pt (Ganador)</span>`;
      } else {
        pointsHtml = `<span class="match-points-awarded miss">0 pts (Fallo)</span>`;
      }
    } else if (match.completed) {
      pointsHtml = `<span class="match-points-awarded miss">Sin pronosticar</span>`;
    } else if (isLive) {
      pointsHtml = `<span class="match-points-awarded live-badge" style="background: rgba(220, 38, 38, 0.08); color: var(--accent-red); border-color: rgba(220, 38, 38, 0.2);">Partido en curso</span>`;
    }
    
    // Calcular si falta menos de 1 hora para el partido (basado en marcas de tiempo universales)
    const matchDateUTC = parseMatchDateAsUTC(match.date);
    const now = new Date();
    const timeDiff = matchDateUTC.getTime() - now.getTime();
    const isLockedByTime = timeDiff < (60 * 60 * 1000); // Menos de 1 hora (3600000 ms)
    const isUndetermined = isMatchUndetermined(match);
    
    // Deshabilitar inputs si el partido ya se jugó, está en curso, ya tiene un pronóstico guardado, está fuera de tiempo o está indeterminado
    const disabledAttr = (match.completed || isLive || hasPrediction || isLockedByTime || isUndetermined) ? 'disabled' : '';
    
    // Formato de fecha en horario Caracas (12 horas)
    const matchDateFormatted = formatMatchDateToCaracas12h(match.date);
    
    card.innerHTML = `
      <div class="match-header">
        <span class="match-stage">${match.stage}</span>
        ${isLive 
          ? `<span class="match-live-tag" style="background: var(--accent-red); color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;"><span class="live-dot" style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%;"></span> EN VIVO</span>` 
          : `<span>${matchDateFormatted}</span>`
        }
      </div>
      
      <div class="match-teams-score">
        <!-- Equipo Local -->
        <div class="team-row">
          <div class="team-info">
            <span style="font-size: 1.2rem; margin-right: 6px;">${getCountryFlag(match.homeTeam)}</span>
            <span class="team-name">${match.homeTeam}</span>
          </div>
          <div class="score-inputs">
            <input type="number" class="score-input" min="0" max="99" 
              id="home_${match.id}" value="${prediction.homeScore}" ${disabledAttr} 
              placeholder="-">
          </div>
        </div>
        
        <!-- Equipo Visitante -->
        <div class="team-row">
          <div class="team-info">
            <span style="font-size: 1.2rem; margin-right: 6px;">${getCountryFlag(match.awayTeam)}</span>
            <span class="team-name">${match.awayTeam}</span>
          </div>
          <div class="score-inputs">
            <input type="number" class="score-input" min="0" max="99" 
              id="away_${match.id}" value="${prediction.awayScore}" ${disabledAttr} 
              placeholder="-">
          </div>
        </div>
      </div>
      
      <div class="card-footer">
        <div>
          ${match.completed ? `
            <div class="real-score-display">
              Real: <span class="real-score-badge">${match.realHomeScore} - ${match.realAwayScore}</span>
            </div>
          ` : isLive ? `
            <div class="real-score-display live" style="color: var(--accent-red); font-weight: bold; display: flex; align-items: center; gap: 6px;">
              Real: <span class="real-score-badge" style="background: rgba(220, 38, 38, 0.08); border-color: rgba(220, 38, 38, 0.2); color: var(--accent-red);">${match.liveHomeScore} - ${match.liveAwayScore}</span>
              <span class="live-minute" style="font-size: 0.8rem; background: var(--text-primary); color: #fff; padding: 2px 6px; border-radius: 4px;">${match.minute}</span>
            </div>
          ` : hasPrediction ? `
            <span class="prediction-status status-saved" style="background: rgba(2, 86, 214, 0.05); color: var(--accent-soccer); border: 1px solid rgba(2, 86, 214, 0.15);">
              ✓ Guardado (Bloqueado)
            </span>
          ` : isLockedByTime ? `
            <span class="prediction-status status-locked" style="background: rgba(220, 38, 38, 0.05); color: var(--accent-red); border: 1px solid rgba(220, 38, 38, 0.15);">
              ❌ Cerrado (Fuera de tiempo)
            </span>
          ` : isUndetermined ? `
            <span class="prediction-status status-undetermined" style="background: rgba(148, 163, 184, 0.05); color: var(--text-muted); border: 1px solid rgba(148, 163, 184, 0.15); font-size: 0.8rem; padding: 6px 12px; border-radius: 6px; font-weight: 600;">
              Esperando equipos
            </span>
          ` : `
            <button class="btn btn-primary" onclick="confirmAndSavePrediction('${match.id}')" style="font-size: 0.8rem; padding: 8px 16px; border-radius: var(--radius-sm); font-weight: 600; cursor: pointer;">
              Guardar Pronóstico
            </button>
          `}
        </div>
        <div>
          ${pointsHtml}
        </div>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

// ==========================================
// ACCIONES Y LOGICA DE PARTICIPANTES
// ==========================================

// Guardar pronóstico temporal del participante logueado
window.savePrediction = (matchId, team, value) => {
  if (!state.currentUser) return;
  
  const currentUserId = state.currentUser.id;
  const predictionKey = `${currentUserId}_${matchId}`;
  
  if (!state.predictions[predictionKey]) {
    state.predictions[predictionKey] = { homeScore: '', awayScore: '' };
  }
  
  if (team === 'home') {
    state.predictions[predictionKey].homeScore = value !== '' ? parseInt(value) : '';
  } else {
    state.predictions[predictionKey].awayScore = value !== '' ? parseInt(value) : '';
  }
  
  saveStateToStorage();
  
  // Agregar micro-interacción para actualizar visualmente la tarjeta si ya tiene ambos marcadores
  const cardEl = Array.from(document.querySelectorAll('.match-card')).find(card => {
    return card.innerHTML.includes(`savePrediction('${matchId}'`);
  });
  
  if (cardEl) {
    const hasPred = state.predictions[predictionKey].homeScore !== '' && state.predictions[predictionKey].awayScore !== '';
    if (hasPred) {
      cardEl.classList.add('has-prediction');
      const statusEl = cardEl.querySelector('.prediction-status');
      if (statusEl) {
        statusEl.className = 'prediction-status status-saved';
        statusEl.textContent = '✓ Guardado';
      }
    } else {
      cardEl.classList.remove('has-prediction');
      const statusEl = cardEl.querySelector('.prediction-status');
      if (statusEl) {
        statusEl.className = 'prediction-status status-empty';
        statusEl.textContent = '⚽ Sin pronóstico';
      }
    }
  }
};

// Filtro de estado de las predicciones
window.setPredictionStatusFilter = (filterType, element) => {
  state.currentPredictionFilter = filterType;
  
  // Cambiar clases activas en botones
  const parent = document.getElementById('predictionFilterButtons');
  if (parent) {
    parent.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
  }
  element.classList.add('active');
  
  renderPredictions();
};

// ==========================================
// CONTROL DE HEADER
// ==========================================

window.openModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
};

window.closeModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
};

// Abrir Modal de Inicio de Sesión
window.openLoginModal = () => {
  // Pre-llenar con el último usuario logueado si existe
  const lastUser = localStorage.getItem('quiniela_last_username') || '';
  document.getElementById('loginUsername').value = lastUser;
  document.getElementById('loginPin').value = '';
  openModal('loginModal');
};

// Autenticar Usuario
window.loginUser = () => {
  const usernameInput = document.getElementById('loginUsername').value.trim();
  const pinInput = document.getElementById('loginPin').value.trim();
  
  if (!usernameInput || !pinInput) {
    alert("Por favor ingresa tu nombre de usuario y PIN.");
    return;
  }

  const cleanId = normalizeName(usernameInput);
  const user = state.users.find(u => {
    const userIdMatch = u.id === cleanId;
    const fullNameMatch = normalizeName(u.name) === cleanId;
    const firstNameMatch = normalizeName(u.name.split(' ')[0]) === cleanId;
    return userIdMatch || fullNameMatch || firstNameMatch;
  });

  if (!user) {
    alert("Usuario no encontrado.");
    return;
  }

  const simpleName = user.name.split(' ')[0];

  if (user.pin === null) {
    alert(`Hola ${simpleName}. Tu usuario está precargado en el sistema, pero aún no has establecido tu PIN secreto. Haz clic en "¿Eres nuevo? Crea tu usuario aquí" para registrar tu PIN por primera vez.`);
    return;
  }

  if (user.pin !== pinInput) {
    alert("PIN incorrecto.");
    return;
  }

  // Éxito
  state.currentUser = user;
  localStorage.setItem('quiniela_last_username', simpleName); // Guardar último usuario como nombre simple
  saveStateToStorage();
  closeModal('loginModal');
  switchTab('predictions'); // Ir directamente a mis marcadores
};

// Cerrar sesión
window.logoutUser = () => {
  if (confirm("¿Estás seguro de que quieres cerrar sesión?")) {
    if (state.currentUser) {
      const simpleName = state.currentUser.name.split(' ')[0];
      localStorage.setItem('quiniela_last_username', simpleName);
    }
    state.currentUser = null;
    localStorage.removeItem('quiniela_current_user');
    // Si estaba en pestañas privadas, regresarlo al ranking
    if (state.activeTab === 'predictions' || state.activeTab === 'groupStage') {
      switchTab('leaderboard');
    } else {
      renderApp();
    }
  }
};

// Selector de Avatar
window.selectAvatar = (emoji, element) => {
  selectedAvatarEmoji = emoji;
  document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
  if (element) element.classList.add('selected');
};

// Navegar de login a registro
window.openRegisterUserFromLogin = () => {
  closeModal('loginModal');
  openRegisterUserModal();
};

// Abrir registro de usuario
window.openRegisterUserModal = () => {
  // Limpiar campo input
  document.getElementById('newUsername').value = '';
  document.getElementById('newUserPin').value = '';
  // Reiniciar selección de avatar a la opción por defecto (⚽)
  const firstAvatar = document.querySelector('.avatar-option');
  if (firstAvatar) {
    selectAvatar('⚽', firstAvatar);
  }
  openModal('registerUserModal');
};

window.registerUser = () => {
  const nameInput = document.getElementById('newUsername');
  const pinInput = document.getElementById('newUserPin');
  const name = nameInput.value.trim();
  const pin = pinInput.value.trim();
  
  if (!name || !pin) {
    alert("Por favor introduce un nombre válido y un PIN.");
    return;
  }
  
  const cleanId = normalizeName(name);
  
  // Vincular a usuario existente si ya estaba en el ranking
  const existingUser = state.users.find(u => {
    const userIdMatch = u.id === cleanId;
    const fullNameMatch = normalizeName(u.name) === cleanId;
    const firstNameMatch = normalizeName(u.name.split(' ')[0]) === cleanId;
    return userIdMatch || fullNameMatch || firstNameMatch;
  });
  if (existingUser) {
    const simpleName = existingUser.name.split(' ')[0];
    if (existingUser.pin) {
      // Si el usuario ya tiene PIN registrado, no puede volver a registrarse
      alert("Este usuario ya está registrado en el sistema y tiene un PIN. Si eres tú, debes ir a Iniciar Sesión.");
      return;
    } else {
      // Es un usuario pre-cargado que establece su PIN por primera vez
      existingUser.pin = pin;
      existingUser.avatar = selectedAvatarEmoji;
      state.currentUser = existingUser;
      localStorage.setItem('quiniela_last_username', simpleName); // Guardar último usuario como nombre simple
      saveStateToStorage();
      closeModal('registerUserModal');
      alert(`¡Hola ${simpleName}! Has reclamado tu cuenta. Tu nuevo PIN privado ha sido guardado. Iniciando sesión...`);
      switchTab('predictions');
      return;
    }
  }
  
  // Si es un usuario completamente nuevo
  const newUser = {
    id: cleanId,
    name: name,
    pin: pin,
    avatar: selectedAvatarEmoji
  };
  
  state.users.push(newUser);
  state.currentUser = newUser;
  const simpleName = name.split(' ')[0];
  localStorage.setItem('quiniela_last_username', simpleName); // Guardar último usuario como nombre simple
  saveStateToStorage();
  closeModal('registerUserModal');
  
  alert(`¡Cuenta creada con éxito! Bienvenido a Audioplace Quiniela 2026, ${simpleName}.`);
  switchTab('predictions');
};

// Modal detalle de estadísticas de usuario (Respetando Privacidad)
window.openUserStatsModal = (userId) => {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  
  document.getElementById('statsModalTitle').textContent = `Pronósticos de ${user.name}`;
  
  const stats = calculateUserPoints(userId);
  document.getElementById('statExactMatches').textContent = stats.exactHits;
  document.getElementById('statOutcomeMatches').textContent = stats.outcomeHits;
  document.getElementById('statTotalMatches').textContent = stats.totalPredicted;
  
  const listEl = document.getElementById('statsMatchList');
  listEl.innerHTML = '';
  
  state.matches.forEach(match => {
    const predictionKey = `${userId}_${match.id}`;
    const pred = state.predictions[predictionKey];
    
    // Regla de privacidad:
    // 1. Mostrar predicción si el partido está completado.
    // 2. O si el usuario consultado es el mismo que está logueado en este momento.
    // En caso contrario, ocultar.
    const isOwner = state.currentUser && state.currentUser.id === userId;
    const canShow = match.completed || isOwner;
    
    let predDisplay = '-';
    let rowStyle = '';
    
    if (pred && pred.homeScore !== '' && pred.awayScore !== '') {
      if (canShow) {
        predDisplay = `${pred.homeScore} - ${pred.awayScore}`;
      } else {
        predDisplay = '🔒 Oculto';
        rowStyle = 'color: var(--text-muted);';
      }
    } else {
      predDisplay = 'Sin pronosticar';
      rowStyle = 'color: var(--text-muted);';
    }
    
    // Real score display
    let realDisplay = '-';
    let pointsIndicator = '';
    
    if (match.completed) {
      realDisplay = `${match.realHomeScore} - ${match.realAwayScore}`;
      
      if (pred && pred.homeScore !== '' && pred.awayScore !== '') {
        const predHome = parseInt(pred.homeScore);
        const predAway = parseInt(pred.awayScore);
        const realHome = match.realHomeScore;
        const realAway = match.realAwayScore;
        
        if (predHome === realHome && predAway === realAway) {
          pointsIndicator = '<span style="color: var(--accent-soccer); font-weight: 700; margin-left: 8px;">+4 pts</span>';
        } else if (Math.sign(predHome - predAway) === Math.sign(realHome - realAway)) {
          pointsIndicator = '<span style="color: var(--accent-blue); font-weight: 700; margin-left: 8px;">+1 pt</span>';
        } else {
          pointsIndicator = '<span style="color: var(--accent-red); font-weight: 700; margin-left: 8px;">+0 pts</span>';
        }
      }
    } else if (match.status === 'IN_PLAY') {
      realDisplay = `${match.liveHomeScore} - ${match.liveAwayScore} (🔴 En Vivo ${match.minute})`;
    } else {
      realDisplay = 'Por jugar';
    }
    
    const row = document.createElement('div');
    row.className = 'stats-match-row';
    row.style = rowStyle;
    
    row.innerHTML = `
      <div class="stats-match-team" style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 1.1rem; line-height: 1;">${getCountryFlag(match.homeTeam)}</span>
        <span>${match.homeTeam}</span>
      </div>
      <div class="stats-match-scores">
        <span class="stats-pred-pill">Pronóstico: ${predDisplay} ${pointsIndicator}</span>
        <span class="stats-real-pill">Resultado: ${realDisplay}</span>
      </div>
      <div class="stats-match-team away" style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
        <span>${match.awayTeam}</span>
        <span style="font-size: 1.1rem; line-height: 1;">${getCountryFlag(match.awayTeam)}</span>
      </div>
    `;
    
    listEl.appendChild(row);
  });
  
  openModal('userStatsModal');
};

// ==========================================
// MÓDULO ADMINISTRADOR (CONTROL DE PARTIDOS)
// ==========================================

window.renderAdminPanel = () => {
  const grid = document.getElementById('adminGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  state.matches.forEach(match => {
    const card = document.createElement('div');
    const isLive = match.status === 'IN_PLAY';
    card.className = `match-card ${match.completed ? 'is-completed' : ''} ${isLive ? 'is-live' : ''}`;
    
    const homeVal = match.realHomeScore !== null ? match.realHomeScore : '';
    const awayVal = match.realAwayScore !== null ? match.realAwayScore : '';
    
    card.innerHTML = `
      <div class="match-header">
        <span class="match-stage">${match.stage}</span>
        ${isLive ? `<span style="color: var(--accent-red); font-weight: bold;">🔴 EN VIVO (${match.minute})</span>` : `<span>${match.date}</span>`}
      </div>
      <div class="match-teams-score">
        <div class="team-row">
          <span class="team-name" style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 1.1rem; line-height: 1;">${getCountryFlag(match.homeTeam)}</span>
            <span>${match.homeTeam}</span>
          </span>
          <input type="number" class="score-input" id="adminHome_${match.id}" value="${homeVal}" placeholder="-" style="width: 50px; height: 35px; font-size: 1.1rem;">
        </div>
        <div class="team-row">
          <span class="team-name" style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 1.1rem; line-height: 1;">${getCountryFlag(match.awayTeam)}</span>
            <span>${match.awayTeam}</span>
          </span>
          <input type="number" class="score-input" id="adminAway_${match.id}" value="${awayVal}" placeholder="-" style="width: 50px; height: 35px; font-size: 1.1rem;">
        </div>
      </div>
      <div style="margin-top: 15px; display: flex; gap: 8px;">
        <button class="btn btn-primary" onclick="saveAdminMatchScore('${match.id}')" style="flex: 1; font-size: 0.85rem; padding: 6px;">
          Guardar
        </button>
        <button class="btn btn-outline" onclick="toggleAdminMatchLive('${match.id}')" style="font-size: 0.85rem; padding: 6px;">
          ${isLive ? 'Detener En Vivo' : 'Poner En Vivo'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
};

window.saveAdminMatchScore = (matchId) => {
  const homeEl = document.getElementById(`adminHome_${matchId}`);
  const awayEl = document.getElementById(`adminAway_${matchId}`);
  if (!homeEl || !awayEl) return;
  
  const homeVal = homeEl.value !== '' ? parseInt(homeEl.value) : null;
  const awayVal = awayEl.value !== '' ? parseInt(awayEl.value) : null;
  
  const match = state.matches.find(m => m.id === matchId);
  if (match) {
    match.realHomeScore = homeVal;
    match.realAwayScore = awayVal;
    match.completed = homeVal !== null && awayVal !== null;
    if (match.completed) {
      match.status = 'FINISHED';
      match.liveHomeScore = null;
      match.liveAwayScore = null;
      match.minute = null;
    }
    saveStateToStorage();
    renderApp();
    alert('Marcador guardado con éxito.');
  }
};

window.toggleAdminMatchLive = (matchId) => {
  const match = state.matches.find(m => m.id === matchId);
  if (match) {
    if (match.status === 'IN_PLAY') {
      match.status = 'SCHEDULED';
      match.liveHomeScore = null;
      match.liveAwayScore = null;
      match.minute = null;
    } else {
      match.status = 'IN_PLAY';
      match.liveHomeScore = match.realHomeScore !== null ? match.realHomeScore : 0;
      match.liveAwayScore = match.realAwayScore !== null ? match.realAwayScore : 0;
      match.minute = "1'";
      match.completed = false;
      match.realHomeScore = null;
      match.realAwayScore = null;
    }
    saveStateToStorage();
    renderApp();
  }
};

window.renderAdminSelectUserDropdown = () => {
  const select = document.getElementById('adminSelectUser');
  if (!select) return;
  select.innerHTML = '<option value="">-- Seleccionar --</option>';
  
  state.users.forEach(user => {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.name;
    select.appendChild(opt);
  });
  
  const optNew = document.createElement('option');
  optNew.value = 'NEW_USER';
  optNew.textContent = '+ Registrar Usuario Nuevo';
  select.appendChild(optNew);
};

window.toggleAdminNewUserField = () => {
  const select = document.getElementById('adminSelectUser');
  const group = document.getElementById('adminNewUserGroup');
  if (select && group) {
    group.style.display = select.value === 'NEW_USER' ? 'block' : 'none';
  }
};

window.loadParticipantPredictionsAdmin = () => {
  const select = document.getElementById('adminSelectUser');
  if (!select || !select.value) return;
  
  let userId = select.value;
  let userName = "";
  
  if (userId === 'NEW_USER') {
    const nameInput = document.getElementById('adminNewUserText');
    if (!nameInput || !nameInput.value.trim()) {
      alert("Introduce un nombre para el nuevo usuario.");
      return;
    }
    const name = nameInput.value.trim();
    const cleanId = normalizeName(name);
    
    let existing = state.users.find(u => u.id === cleanId);
    if (!existing) {
      existing = { id: cleanId, name: name, pin: null, avatar: '⚽' };
      state.users.push(existing);
      saveStateToStorage();
    }
    userId = cleanId;
    userName = name;
  } else {
    const user = state.users.find(u => u.id === userId);
    userName = user ? user.name : userId;
  }
  
  const container = document.getElementById('adminParticipantPredictionsContainer');
  const title = document.getElementById('adminParticipantNameTitle');
  const grid = document.getElementById('adminParticipantPredictionsGrid');
  
  if (container && title && grid) {
    title.textContent = `Editando Pronósticos de: ${userName}`;
    container.style.display = 'block';
    
    grid.innerHTML = '';
    state.matches.forEach(match => {
      const predictionKey = `${userId}_${match.id}`;
      const pred = state.predictions[predictionKey] || { homeScore: '', awayScore: '' };
      
      const card = document.createElement('div');
      card.className = 'match-card';
      card.style.padding = '10px';
      
      card.innerHTML = `
        <div style="font-size: 0.8rem; font-weight: bold; margin-bottom: 5px; display: flex; align-items: center; gap: 4px;">
          <span>${getCountryFlag(match.homeTeam)}</span>
          <span>${match.homeTeam}</span>
          <span>vs</span>
          <span>${getCountryFlag(match.awayTeam)}</span>
          <span>${match.awayTeam}</span>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="number" class="score-input" id="adminPredHome_${match.id}" value="${pred.homeScore}" placeholder="-" style="width: 40px; height: 35px; font-size: 1rem;">
          <span>-</span>
          <input type="number" class="score-input" id="adminPredAway_${match.id}" value="${pred.awayScore}" placeholder="-" style="width: 40px; height: 35px; font-size: 1rem;">
          <button class="btn btn-primary" onclick="saveAdminParticipantPrediction('${userId}', '${match.id}')" style="padding: 4px 10px; font-size: 0.8rem;">
            Guardar
          </button>
        </div>
      `;
      grid.appendChild(card);
    });
  }
};

window.saveAdminParticipantPrediction = (userId, matchId) => {
  const homeEl = document.getElementById(`adminPredHome_${matchId}`);
  const awayEl = document.getElementById(`adminPredAway_${matchId}`);
  if (!homeEl || !awayEl) return;
  
  const homeVal = homeEl.value !== '' ? parseInt(homeEl.value) : '';
  const awayVal = awayEl.value !== '' ? parseInt(awayEl.value) : '';
  
  const predictionKey = `${userId}_${matchId}`;
  state.predictions[predictionKey] = { homeScore: homeVal, awayScore: awayVal };
  saveStateToStorage();
  renderApp();
  alert('Pronóstico del usuario guardado con éxito.');
};

window.closeAdminParticipantGrid = () => {
  const container = document.getElementById('adminParticipantPredictionsContainer');
  if (container) container.style.display = 'none';
};

window.openAddMatchModal = () => {
  openModal('addMatchModal');
};

window.addNewMatch = () => {
  const home = document.getElementById('newMatchHome').value;
  const away = document.getElementById('newMatchAway').value;
  const stage = document.getElementById('newMatchStage').value;
  const group = document.getElementById('newMatchGroup').value;
  const date = document.getElementById('newMatchDate').value;
  
  if (home === away) {
    alert("Los equipos local y visitante deben ser distintos.");
    return;
  }
  
  const newId = `m_${Date.now()}`;
  const newMatch = {
    id: newId,
    stage: stage,
    group: group,
    homeTeam: home,
    awayTeam: away,
    date: date.replace('T', ' '),
    realHomeScore: null,
    realAwayScore: null,
    completed: false
  };
  
  state.matches.push(newMatch);
  saveStateToStorage();
  closeModal('addMatchModal');
  renderApp();
  alert('Partido agregado con éxito.');
};

// ==========================================
// RENDERIZADO DE FASE DE GRUPOS Y PREMIOS
// ==========================================

window.selectGroupTab = (groupCode, btn) => {
  state.activeGroupStage = groupCode;
  
  const container = document.getElementById('groupStageSelectorContainer');
  if (container) {
    container.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
  }
  if (btn) {
    btn.classList.add('active');
  }
  
  renderGroupStageTab();
};

window.renderGroupStageTab = () => {
  if (!state.activeGroupStage) {
    state.activeGroupStage = 'A';
  }
  const group = state.activeGroupStage;
  
  // Sincronizar clases activas en los botones de grupo
  const groupContainer = document.getElementById('groupStageSelectorContainer');
  if (groupContainer) {
    groupContainer.querySelectorAll('.btn-filter').forEach(btn => {
      const isCurrent = btn.getAttribute('onclick').includes(`'${group}'`);
      if (isCurrent) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  
  const groupMatches = state.matches.filter(m => m.group === group && m.stage === "Fase de Grupos");
  
  // Obtener equipos del grupo de forma dinámica
  const teamsSet = new Set();
  groupMatches.forEach(m => {
    teamsSet.add(m.homeTeam);
    teamsSet.add(m.awayTeam);
  });
  const teams = Array.from(teamsSet);
  
  // Inicializar estadísticas
  const stats = {};
  teams.forEach(team => {
    stats[team] = {
      name: team,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      pts: 0
    };
  });
  
  // Computar posiciones
  groupMatches.forEach(m => {
    let homeScore = null;
    let awayScore = null;
    let played = false;
    
    if (m.completed) {
      homeScore = m.realHomeScore;
      awayScore = m.realAwayScore;
      played = true;
    } else if (m.status === 'IN_PLAY') {
      homeScore = m.liveHomeScore;
      awayScore = m.liveAwayScore;
      played = true;
    }
    
    if (played && homeScore !== null && awayScore !== null) {
      stats[m.homeTeam].pj += 1;
      stats[m.homeTeam].gf += homeScore;
      stats[m.homeTeam].gc += awayScore;
      
      stats[m.awayTeam].pj += 1;
      stats[m.awayTeam].gf += awayScore;
      stats[m.awayTeam].gc += homeScore;
      
      if (homeScore > awayScore) {
        stats[m.homeTeam].pg += 1;
        stats[m.homeTeam].pts += 3;
        stats[m.awayTeam].pp += 1;
      } else if (homeScore < awayScore) {
        stats[m.awayTeam].pg += 1;
        stats[m.awayTeam].pts += 3;
        stats[m.homeTeam].pp += 1;
      } else {
        stats[m.homeTeam].pe += 1;
        stats[m.homeTeam].pts += 1;
        stats[m.awayTeam].pe += 1;
        stats[m.awayTeam].pts += 1;
      }
    }
  });
  
  // Calcular diferencia
  Object.values(stats).forEach(t => {
    t.dg = t.gf - t.gc;
  });
  
  // Ordenar posiciones
  const sortedTeams = Object.values(stats).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });
  
  // Pintar tabla
  const tbody = document.getElementById('groupStandingsBody');
  if (tbody) {
    tbody.innerHTML = '';
    sortedTeams.forEach((t, i) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';
      tr.innerHTML = `
        <td style="padding: 12px 5px; font-weight: 700;">${i + 1}</td>
        <td style="padding: 12px 5px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.1rem; line-height: 1;">${getCountryFlag(t.name)}</span>
          <span>${t.name}</span>
        </td>
        <td style="text-align: center; padding: 12px 5px;">${t.pj}</td>
        <td style="text-align: center; padding: 12px 5px;">${t.pg}</td>
        <td style="text-align: center; padding: 12px 5px;">${t.pe}</td>
        <td style="text-align: center; padding: 12px 5px;">${t.pp}</td>
        <td style="text-align: center; padding: 12px 5px;">${t.gf}</td>
        <td style="text-align: center; padding: 12px 5px;">${t.gc}</td>
        <td style="text-align: center; padding: 12px 5px; color: ${t.dg > 0 ? 'var(--accent-soccer)' : t.dg < 0 ? 'var(--accent-red)' : 'var(--text-muted)'}; font-weight: 600;">
          ${t.dg > 0 ? '+' : ''}${t.dg}
        </td>
        <td style="text-align: center; padding: 12px 5px; font-weight: 800; color: var(--accent-soccer);">${t.pts}</td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  // Pintar partidos
  const matchesList = document.getElementById('groupMatchesList');
  if (matchesList) {
    matchesList.innerHTML = '';
    if (groupMatches.length === 0) {
      matchesList.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">No hay partidos en este grupo.</p>`;
    } else {
      const sortedMatches = [...groupMatches].sort((a, b) => parseMatchDateAsUTC(a.date) - parseMatchDateAsUTC(b.date));
      
      sortedMatches.forEach(m => {
        const isLive = m.status === 'IN_PLAY';
        const isCompleted = m.completed;
        
        let scoreHome = '-';
        let scoreAway = '-';
        let statusText = 'Programado';
        let statusClass = 'scheduled';
        
        if (isCompleted) {
          scoreHome = m.realHomeScore;
          scoreAway = m.realAwayScore;
          statusText = 'Finalizado';
          statusClass = 'completed';
        } else if (isLive) {
          scoreHome = m.liveHomeScore;
          scoreAway = m.liveAwayScore;
          statusText = `🔴 En Vivo ${m.minute}`;
          statusClass = 'live';
        }
        
        const matchDateFormatted = formatMatchDateToCaracas12h(m.date);
        
        const row = document.createElement('div');
        row.className = 'group-match-row';
        row.innerHTML = `
          <div class="group-match-teams">
            <div class="group-match-team-line">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 1.1rem; line-height: 1;">${getCountryFlag(m.homeTeam)}</span>
                <span>${m.homeTeam}</span>
              </span>
              <span class="group-match-score-pill ${isLive ? 'live' : ''}">${scoreHome}</span>
            </div>
            <div class="group-match-team-line">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 1.1rem; line-height: 1;">${getCountryFlag(m.awayTeam)}</span>
                <span>${m.awayTeam}</span>
              </span>
              <span class="group-match-score-pill ${isLive ? 'live' : ''}">${scoreAway}</span>
            </div>
          </div>
          <div class="group-match-info">
            <span class="group-match-status-badge ${statusClass}">${statusText}</span>
            <span class="group-match-date">${matchDateFormatted}</span>
          </div>
        `;
        matchesList.appendChild(row);
      });
    }
  }
};

window.renderPremiosTab = () => {
  // Los premios se renderizan a través de la estructura premium estática en index.html
};

window.pressPinKey = (key) => {
  const pinInput = document.getElementById('loginPin');
  if (!pinInput) return;
  
  if (key === 'clear') {
    pinInput.value = '';
  } else if (key === 'backspace') {
    pinInput.value = pinInput.value.slice(0, -1);
  } else {
    pinInput.value += key;
  }
};

window.pressRegisterPinKey = (key) => {
  const pinInput = document.getElementById('newUserPin');
  if (!pinInput) return;
  
  if (key === 'clear') {
    pinInput.value = '';
  } else if (key === 'backspace') {
    pinInput.value = pinInput.value.slice(0, -1);
  } else {
    pinInput.value += key;
  }
};

window.confirmAndSavePrediction = (matchId) => {
  if (!state.currentUser) return;
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;
  
  if (isMatchUndetermined(match)) {
    alert("No puedes pronosticar este partido hasta que se definan los equipos participantes.");
    return;
  }
  
  const matchDateUTC = parseMatchDateAsUTC(match.date);
  const now = new Date();
  const timeDiff = matchDateUTC.getTime() - now.getTime();
  if (timeDiff < (60 * 60 * 1000)) {
    alert("El tiempo límite para guardar este pronóstico ha expirado (máximo 1 hora antes del partido en horario de Caracas).");
    return;
  }
  
  const homeInput = document.getElementById(`home_${matchId}`);
  const awayInput = document.getElementById(`away_${matchId}`);
  if (!homeInput || !awayInput) return;
  
  const homeVal = homeInput.value.trim();
  const awayVal = awayInput.value.trim();
  
  if (homeVal === '' || awayVal === '') {
    alert("Por favor ingresa ambos marcadores antes de guardar.");
    return;
  }
  
  const confirmMsg = "¿Estás seguro de guardar este pronóstico? Recuerda que una vez guardado NO se podrá volver a editar.";
  if (confirm(confirmMsg)) {
    const currentUserId = state.currentUser.id;
    const predictionKey = `${currentUserId}_${matchId}`;
    state.predictions[predictionKey] = {
      homeScore: parseInt(homeVal),
      awayScore: parseInt(awayVal)
    };
    saveStateToStorage();
    renderApp();
  }
};

window.filterMatches = () => {
  renderPredictions();
};
