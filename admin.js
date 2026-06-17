// admin.js - resultados + gestion de usuarios con Firebase Auth + Firestore

const { auth, db, firebase } = window.firebaseServices;

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

function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getCountryFlag(countryName) {
  if (!countryName) return "";
  const code = COUNTRY_CODES[countryName];
  if (!code) return "";
  return `<img src="https://flagcdn.com/w40/${code}.png" alt="Bandera de ${countryName}" style="width:20px;height:auto;border-radius:2px;vertical-align:middle;margin-right:6px;">`;
}

function formatCreatedAt(ts) {
  if (!ts || typeof ts.toDate !== "function") return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(ts.toDate());
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

window.adminLogout = async () => {
  await auth.signOut();
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
    html += `
      <div class="match-card">
        <div class="match-header">
          <span class="match-stage">${m.stage || ""}</span>
          <span>${m.date || ""}</span>
        </div>
        <div class="match-teams-score">
          <div class="team-row">
            <div class="team-info">${getCountryFlag(m.homeTeam)}<span>${m.homeTeam}</span></div>
            <input type="number" class="score-input" id="h_${m.id}" value="${home}" min="0">
          </div>
          <div class="team-row">
            <div class="team-info">${getCountryFlag(m.awayTeam)}<span>${m.awayTeam}</span></div>
            <input type="number" class="score-input" id="a_${m.id}" value="${away}" min="0">
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-primary" onclick="saveMatchScore('${m.id}')">Guardar</button>
        </div>
      </div>
    `;
  });
  html += "</div>";
  return html;
}

function renderUsersSection() {
  const sortedUsers = [...users].sort((a, b) => {
    const left = (a.displayName || a.email || "").toLowerCase();
    const right = (b.displayName || b.email || "").toLowerCase();
    return left.localeCompare(right);
  });

  let html = `
    <div style="margin-top: 30px; border-top: 1px solid var(--border-color); padding-top: 24px;">
      <h2 style="margin-top: 0;">Gestión de Usuarios</h2>
      <p style="margin-bottom: 14px; color: var(--text-secondary);">
        El botón elimina datos del usuario en Firestore (<code>users</code> + <code>predictions</code>).
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
  `;

  if (sortedUsers.length === 0) {
    html += `<p style="color: var(--text-muted);">No hay usuarios registrados.</p>`;
  } else {
    sortedUsers.forEach((user) => {
      const isSelf = currentUser && user.uid === currentUser.uid;
      html += `
        <div style="border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-primary); padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <strong>${user.displayName || "Sin nombre"}</strong>
              <span style="font-size: 0.9rem; color: var(--text-secondary);">${user.email || "Sin correo"}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">UID: ${user.uid}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Rol: ${user.role || "user"} | Creado: ${formatCreatedAt(user.createdAt)}</span>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
              <button
                class="btn"
                style="background: var(--accent-soccer); color: #fff; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer;"
                onclick="editUser('${user.uid}')"
              >
                Editar
              </button>
              <button
                class="btn"
                style="background: ${isSelf ? "#9ca3af" : "#dc2626"}; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; cursor: ${isSelf ? "not-allowed" : "pointer"};"
                onclick="${isSelf ? "" : `deleteUserCompletely('${user.uid}')`}"
                ${isSelf ? "disabled" : ""}
              >
                ${isSelf ? "No puedes eliminarte" : "Eliminar Usuario Completo"}
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
  const homeEl = document.getElementById(`h_${matchId}`);
  const awayEl = document.getElementById(`a_${matchId}`);
  if (!homeEl || !awayEl) return;

  const home = homeEl.value.trim() === "" ? null : parseInt(homeEl.value, 10);
  const away = awayEl.value.trim() === "" ? null : parseInt(awayEl.value, 10);
  if (home === null || away === null || Number.isNaN(home) || Number.isNaN(away)) {
    alert("Debes ingresar ambos marcadores.");
    return;
  }

  await db.collection("matches").doc(matchId).set({
    realHomeScore: home,
    realAwayScore: away,
    completed: true,
    status: "FINISHED",
    liveHomeScore: null,
    liveAwayScore: null,
    minute: null
  }, { merge: true });
};

async function deletePredictionsByUid(uid) {
  const snap = await db.collection("predictions").where("uid", "==", uid).get();
  if (snap.empty) return 0;

  const docs = snap.docs;
  let deleted = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

window.deleteUserCompletely = async (uid) => {
  if (!currentUser || currentUser.role !== "admin") {
    alert("No autorizado.");
    return;
  }
  if (uid === currentUser.uid) {
    alert("No puedes eliminar tu propia cuenta desde este panel.");
    return;
  }

  const target = users.find((u) => u.uid === uid);
  const targetName = target?.displayName || target?.email || uid;
  const accepted = confirm(`Vas a eliminar datos de "${targetName}".\n\nSe borrará:\n- users/${uid}\n- predictions con uid=${uid}\n\nNota: la cuenta de Auth/OAuth debe eliminarse manualmente en Firebase Console (Authentication > Users).\n\n¿Continuar?`);
  if (!accepted) return;

  try {
    const deletedPreds = await deletePredictionsByUid(uid);
    await db.collection("users").doc(uid).delete();

    alert(`Usuario eliminado en Firestore.\nPredicciones borradas: ${deletedPreds}\n\nRecuerda eliminar su cuenta en Firebase Authentication manualmente.`);
  } catch (error) {
    console.error(error);
    alert(`No se pudo eliminar el usuario: ${error.message}`);
  }
};

async function claimLegacyForUser(uid, legacyUser) {
  const legacyRef = db.collection("legacy_users").doc(legacyUser.id);

  await db.runTransaction(async (tx) => {
    const legacySnap = await tx.get(legacyRef);
    if (!legacySnap.exists) {
      throw new Error("El usuario legacy ya no existe.");
    }
    const data = legacySnap.data() || {};
    if (data.claimed === true) {
      throw new Error("Ese usuario legacy ya fue reclamado.");
    }
    tx.set(legacyRef, {
      claimed: true,
      status: "claimed",
      claimedBy: uid,
      claimedByAdmin: currentUser.uid,
      claimedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  const legacyUid = `legacy_${legacyUser.id}`;
  const [legacyByFieldSnap, legacyByUidSnap, existingUserPredictionsSnap] = await Promise.all([
    db.collection("predictions").where("legacyUserId", "==", legacyUser.id).get(),
    db.collection("predictions").where("uid", "==", legacyUid).get(),
    db.collection("predictions").where("uid", "==", uid).get()
  ]);

  const existingMatchIds = new Set();
  existingUserPredictionsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.matchId) existingMatchIds.add(data.matchId);
  });

  const legacyPredictionsMap = new Map();
  [legacyByFieldSnap, legacyByUidSnap].forEach((snap) => {
    snap.forEach((doc) => {
      const data = doc.data();
      if (!data.matchId) return;
      if (!legacyPredictionsMap.has(data.matchId)) {
        legacyPredictionsMap.set(data.matchId, data);
      }
    });
  });

  const batch = db.batch();
  let importedCount = 0;
  legacyPredictionsMap.forEach((pred, matchId) => {
    if (existingMatchIds.has(matchId)) return;
    const targetRef = db.collection("predictions").doc(`${uid}_${matchId}`);
    batch.set(targetRef, {
      uid,
      matchId,
      homeScore: pred.homeScore,
      awayScore: pred.awayScore,
      migratedFromLegacy: legacyUser.id,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    importedCount += 1;
  });

  if (importedCount > 0) {
    await batch.commit();
  }
  return importedCount;
}

window.editUser = async (uid) => {
  if (!currentUser || currentUser.role !== "admin") {
    alert("No autorizado.");
    return;
  }
  const target = users.find((u) => u.uid === uid);
  if (!target) {
    alert("Usuario no encontrado.");
    return;
  }

  const currentName = target.displayName || "";
  const currentEmail = target.email || "";
  const currentRole = target.role || "user";

  const nextName = prompt("Editar nombre público:", currentName);
  if (nextName === null) return;
  const cleanName = nextName.trim();
  if (!cleanName) {
    alert("El nombre no puede estar vacío.");
    return;
  }

  const nextEmail = prompt("Editar email de perfil (solo Firestore):", currentEmail);
  if (nextEmail === null) return;
  const cleanEmail = nextEmail.trim();

  const roleInput = prompt("Rol (admin o user):", currentRole);
  if (roleInput === null) return;
  const cleanRole = roleInput.trim().toLowerCase();
  if (cleanRole !== "admin" && cleanRole !== "user") {
    alert("Rol inválido. Usa 'admin' o 'user'.");
    return;
  }

  try {
    await db.collection("users").doc(uid).set({
      displayName: cleanName,
      email: cleanEmail,
      role: cleanRole,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const normalized = normalizeName(cleanName);
    const legacySnap = await db.collection("legacy_users").get();
    let legacyMatch = null;
    legacySnap.forEach((doc) => {
      if (legacyMatch) return;
      const data = doc.data() || {};
      if (data.claimed === true) return;
      if (normalizeName(data.name || "") === normalized) {
        legacyMatch = { id: doc.id, ...data };
      }
    });

    if (legacyMatch) {
      const shouldClaim = confirm(
        `El nombre coincide con legacy user "${legacyMatch.name}".\n\n¿Deseas reclamarlo e importar sus predicciones legacy a este usuario?`
      );
      if (shouldClaim) {
        const imported = await claimLegacyForUser(uid, legacyMatch);
        alert(`Usuario actualizado y legacy reclamado.\nPredicciones importadas: ${imported}`);
        return;
      }
    }

    alert("Usuario actualizado correctamente.");
  } catch (error) {
    console.error(error);
    alert(`No se pudo editar el usuario: ${error.message}`);
  }
};

function initAdmin() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      currentUser = null;
      renderUnauthorized();
      return;
    }

    const userSnap = await db.collection("users").doc(user.uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    currentUser = { uid: user.uid, role: userData.role || "user" };
    renderAdminPanel();
  });

  db.collection("matches").onSnapshot((snap) => {
    matches = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const left = new Date((a.date || "").replace(" ", "T") + "Z").getTime();
        const right = new Date((b.date || "").replace(" ", "T") + "Z").getTime();
        return left - right;
      });
    renderAdminPanel();
  });

  db.collection("users").onSnapshot((snap) => {
    users = snap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
    renderAdminPanel();
  });
}

initAdmin();
