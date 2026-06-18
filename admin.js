// admin.js - resultados + gestión de usuarios via API REST

const api = window.quinielaApi;

const COUNTRY_CODES = {
  "Argelia": "dz", "Argentina": "ar", "Australia": "au", "Austria": "at", "Bélgica": "be",
  "Bosnia y Herzegovina": "ba", "Brasil": "br", "Canadá": "ca", "Cabo Verde": "cv", "Colombia": "co",
  "Croacia": "hr", "Curazao": "cw", "Curaçao": "cw", "Chequia": "cz", "RD Congo": "cd", "Ecuador": "ec",
  "Egipto": "eg", "Inglaterra": "gb-eng", "Francia": "fr", "Alemania": "de", "Ghana": "gh", "Haití": "ht",
  "Irán": "ir", "Irak": "iq", "Costa de Marfil": "ci", "Japón": "jp", "Jordania": "jo", "México": "mx",
  "Marruecos": "ma", "Países Bajos": "nl", "Nueva Zelanda": "nz", "Noruega": "no", "Panamá": "pa",
  "Paraguay": "py", "Portugal": "pt", "Catar": "qa", "Arabia Saudita": "sa", "Escocia": "gb-sct",
  "Senegal": "sn", "Sudáfrica": "za", "Corea del Sur": "kr", "España": "es", "Suecia": "se", "Suiza": "ch",
  "Túnez": "tn", "Turquía": "tr", "EE.UU.": "us", "Uruguay": "uy", "Uzbekistán": "uz"
};

let adminCurrentStage = "";
let activeAdminTab = "marcadores";
let matches = [];
let users = [];
let currentUser = null;
let pollingTimer = null;

function getCountryFlag(countryName) {
  if (!countryName) return "";
  const code = COUNTRY_CODES[countryName];
  if (!code) return "";
  return `<img src="https://flagcdn.com/w40/${code}.png" alt="Bandera de ${countryName}" style="width:20px;height:auto;border-radius:2px;vertical-align:middle;margin-right:6px;">`;
}

function formatCreatedAt(value) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function setStage(stage) {
  adminCurrentStage = stage;
  renderAdminPanel();
}
window.setStage = setStage;

function updateAdminTabUI() {
  const tabMarcadores = document.getElementById("tabMarcadores");
  const tabUsuarios = document.getElementById("tabUsuarios");
  const stageTabsContainer = document.getElementById("stageTabsContainer");
  const isMarcadores = activeAdminTab === "marcadores";

  if (tabMarcadores) {
    tabMarcadores.style.background = isMarcadores ? "var(--accent-soccer)" : "var(--bg-primary)";
    tabMarcadores.style.color = isMarcadores ? "#fff" : "var(--text-primary)";
    tabMarcadores.style.border = isMarcadores ? "none" : "1px solid var(--border-color)";
  }
  if (tabUsuarios) {
    tabUsuarios.style.background = !isMarcadores ? "var(--accent-soccer)" : "var(--bg-primary)";
    tabUsuarios.style.color = !isMarcadores ? "#fff" : "var(--text-primary)";
    tabUsuarios.style.border = !isMarcadores ? "none" : "1px solid var(--border-color)";
  }
  if (stageTabsContainer) {
    stageTabsContainer.style.display = isMarcadores ? "flex" : "none";
  }
}

window.switchAdminTab = (tabId) => {
  activeAdminTab = tabId === "usuarios" ? "usuarios" : "marcadores";
  renderAdminPanel();
};

window.adminLogout = () => {
  api.logout();
  window.location.href = "index.html";
};

function renderUnauthorized() {
  const panel = document.getElementById("adminPanel");
  panel.innerHTML = `
    <div style="max-width: 500px; margin: 30px auto; text-align: center;">
      <h2>Acceso restringido</h2>
      <p>Debes iniciar sesión con un usuario <strong>admin</strong> para gestionar resultados.</p>
      <button class="btn btn-primary" onclick="window.location.href='index.html'">Ir al inicio</button>
    </div>
  `;
}

function renderMatchesSection() {
  const filtered = adminCurrentStage ? matches.filter((m) => m.stage === adminCurrentStage) : matches;
  if (filtered.length === 0) {
    return `<p>No hay partidos para esta fase.</p>`;
  }

  let html = `<h2 style="margin-top: 0;">Actualizar Marcadores Finales</h2><div class="matches-grid">`;
  filtered.forEach((m) => {
    const home = m.realHomeScore != null ? m.realHomeScore : "";
    const away = m.realAwayScore != null ? m.realAwayScore : "";
    const isCompleted = !!m.completed;
    const disabledAttr = isCompleted ? "disabled" : "";
    html += `
      <div class="match-card ${isCompleted ? "is-completed" : ""}">
        <div class="match-header">
          <span class="match-stage">${m.stage || ""}</span>
          <span>${m.date || ""}</span>
        </div>
        <div class="match-teams-score">
          <div class="team-row">
            <div class="team-info">${getCountryFlag(m.homeTeam)}<span>${m.homeTeam}</span></div>
            <input type="number" class="score-input" id="h_${m.id}" value="${home}" min="0" ${disabledAttr}>
          </div>
          <div class="team-row">
            <div class="team-info">${getCountryFlag(m.awayTeam)}<span>${m.awayTeam}</span></div>
            <input type="number" class="score-input" id="a_${m.id}" value="${away}" min="0" ${disabledAttr}>
          </div>
        </div>
        <div class="card-footer">
          ${isCompleted
            ? `<span class="prediction-status status-saved">✓ Resultado guardado (${m.realHomeScore} - ${m.realAwayScore})</span>`
            : `<button class="btn btn-primary" onclick="saveMatchScore('${m.id}')">Guardar</button>`}
        </div>
      </div>
    `;
  });
  html += "</div>";
  return html;
}

function renderUsersSection() {
  const sortedUsers = [...users].sort((a, b) => {
    const left = (a.displayName || a.id || "").toLowerCase();
    const right = (b.displayName || b.id || "").toLowerCase();
    return left.localeCompare(right);
  });

  let html = `
    <div style="margin-top: 30px; border-top: 1px solid var(--border-color); padding-top: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;">
        <h2 style="margin: 0;">Gestión de Usuarios</h2>
        <button
          class="btn btn-primary"
          onclick="createUser()"
          style="padding: 8px 14px; border-radius: 8px; cursor: pointer;"
        >
          + Crear usuario
        </button>
      </div>
      <p style="margin-bottom: 14px; color: var(--text-secondary);">
        Los usuarios se crean con username/contraseña. Solo los admins pueden gestionar cuentas.
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
  `;

  if (sortedUsers.length === 0) {
    html += `<p style="color: var(--text-muted);">No hay usuarios registrados.</p>`;
  } else {
    sortedUsers.forEach((user) => {
      const userId = user.id || user.uid;
      const isSelf = currentUser && userId === currentUser.id;
      html += `
        <div style="border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-primary); padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <strong>${user.displayName || "Sin nombre"} ${user.avatar || ""}</strong>
              <span style="font-size: 0.9rem; color: var(--text-secondary);">Username: ${userId}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Rol: ${user.role || "user"} | Creado: ${formatCreatedAt(user.createdAt)}</span>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
              <button
                class="btn"
                style="background: var(--accent-soccer); color: #fff; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer;"
                onclick="editUser('${userId}')"
              >
                Editar
              </button>
              <button
                class="btn"
                style="background: ${isSelf ? "#9ca3af" : "#dc2626"}; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; cursor: ${isSelf ? "not-allowed" : "pointer"};"
                onclick="${isSelf ? "" : `deleteUserCompletely('${userId}')`}"
                ${isSelf ? "disabled" : ""}
              >
                ${isSelf ? "No puedes eliminarte" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      `;
    });
  }

  html += "</div></div>";
  return html;
}

function renderAdminPanel() {
  const panel = document.getElementById("adminPanel");
  if (!currentUser || currentUser.role !== "admin") {
    renderUnauthorized();
    return;
  }
  updateAdminTabUI();
  panel.innerHTML = activeAdminTab === "usuarios" ? renderUsersSection() : renderMatchesSection();
}

window.saveMatchScore = async (matchId) => {
  if (!currentUser || currentUser.role !== "admin") {
    alert("No autorizado.");
    return;
  }
  const match = matches.find((m) => m.id === matchId);
  if (match?.completed) {
    alert("Este partido ya tiene resultado guardado y no puede editarse.");
    return;
  }
  const homeEl = document.getElementById(`h_${matchId}`);
  const awayEl = document.getElementById(`a_${matchId}`);
  if (!homeEl || !awayEl) return;

  const home = homeEl.value.trim() === "" ? null : parseInt(homeEl.value, 10);
  const away = awayEl.value.trim() === "" ? null : parseInt(awayEl.value, 10);
  if (home === null || away === null || Number.isNaN(home) || Number.isNaN(away)) {
    alert("Debes ingresar ambos marcadores.");
    return;
  }

  try {
    await api.updateMatchScore(matchId, home, away);
    await loadAdminData();
  } catch (error) {
    alert(`No se pudo guardar: ${error.message}`);
  }
};

window.deleteUserCompletely = async (userId) => {
  if (!currentUser || currentUser.role !== "admin") {
    alert("No autorizado.");
    return;
  }
  if (userId === currentUser.id) {
    alert("No puedes eliminar tu propia cuenta desde este panel.");
    return;
  }

  const target = users.find((u) => (u.id || u.uid) === userId);
  const targetName = target?.displayName || userId;
  const accepted = confirm(`Vas a eliminar a "${targetName}" y todos sus pronósticos.\n\n¿Continuar?`);
  if (!accepted) return;

  try {
    await api.deleteUser(userId);
    await loadAdminData();
    alert("Usuario eliminado correctamente.");
  } catch (error) {
    alert(`No se pudo eliminar el usuario: ${error.message}`);
  }
};

window.createUser = async () => {
  if (!currentUser || currentUser.role !== "admin") {
    alert("No autorizado.");
    return;
  }

  const id = prompt("Username (id único, ej: maria):");
  if (id === null) return;
  const cleanId = id.trim().toLowerCase();
  if (!cleanId) {
    alert("El username no puede estar vacío.");
    return;
  }

  const displayName = prompt("Nombre público:");
  if (displayName === null) return;
  const cleanName = displayName.trim();
  if (!cleanName) {
    alert("El nombre no puede estar vacío.");
    return;
  }

  const roleInput = prompt("Rol (admin o user):", "user");
  if (roleInput === null) return;
  const cleanRole = roleInput.trim().toLowerCase();
  if (cleanRole !== "admin" && cleanRole !== "user") {
    alert("Rol inválido.");
    return;
  }

  try {
    const result = await api.createUser({ id: cleanId, displayName: cleanName, role: cleanRole });
    await loadAdminData();
    alert(`Usuario creado.\nUsername: ${cleanId}\nContraseña: ${result.password}`);
  } catch (error) {
    alert(`No se pudo crear el usuario: ${error.message}`);
  }
};

window.editUser = async (userId) => {
  if (!currentUser || currentUser.role !== "admin") {
    alert("No autorizado.");
    return;
  }
  const target = users.find((u) => (u.id || u.uid) === userId);
  if (!target) {
    alert("Usuario no encontrado.");
    return;
  }

  const currentName = target.displayName || "";
  const currentRole = target.role || "user";
  const currentAvatar = target.avatar || "⚽";

  const nextName = prompt("Editar nombre público:", currentName);
  if (nextName === null) return;
  const cleanName = nextName.trim();
  if (!cleanName) {
    alert("El nombre no puede estar vacío.");
    return;
  }

  const roleInput = prompt("Rol (admin o user):", currentRole);
  if (roleInput === null) return;
  const cleanRole = roleInput.trim().toLowerCase();
  if (cleanRole !== "admin" && cleanRole !== "user") {
    alert("Rol inválido. Usa 'admin' o 'user'.");
    return;
  }

  const nextAvatar = prompt("Avatar (emoji):", currentAvatar);
  if (nextAvatar === null) return;

  try {
    await api.updateUser(userId, {
      displayName: cleanName,
      role: cleanRole,
      avatar: nextAvatar.trim() || "⚽"
    });

    const shouldReset = confirm("¿Deseas generar una nueva contraseña para este usuario?");
    if (shouldReset) {
      const reset = await api.resetUserPassword(userId);
      alert(`Usuario actualizado.\nNueva contraseña: ${reset.password}`);
    } else {
      alert("Usuario actualizado correctamente.");
    }
    await loadAdminData();
  } catch (error) {
    alert(`No se pudo editar el usuario: ${error.message}`);
  }
};

async function loadAdminData() {
  if (!api.getToken()) return;
  try {
    const data = await api.fetchData();
    matches = (data.matches || []).sort((a, b) => {
      const left = new Date((a.date || "").replace(" ", "T") + "Z").getTime();
      const right = new Date((b.date || "").replace(" ", "T") + "Z").getTime();
      return left - right;
    });
    users = data.users || [];
    renderAdminPanel();
  } catch (error) {
    console.error(error);
  }
}

async function initAdmin() {
  window.onQuinielaUnauthorized = () => {
    currentUser = null;
    renderUnauthorized();
  };

  if (!api.getToken()) {
    renderUnauthorized();
    return;
  }

  try {
    const { user } = await api.getMe();
    currentUser = { id: user.id, uid: user.id, role: user.role || "user" };
    if (currentUser.role !== "admin") {
      renderUnauthorized();
      return;
    }
    await loadAdminData();
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(loadAdminData, 30000);
  } catch (_error) {
    api.logout();
    renderUnauthorized();
  }
}

initAdmin();
