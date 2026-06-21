// Cliente HTTP para quiniela-back
(function () {
  const TOKEN_KEY = "quiniela_token";
  const API_BASE_URL = window.QUINIELA_API_URL || "http://localhost:3000/api";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function apiFetch(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    let data = null;
    try {
      data = await response.json();
    } catch (_err) {
      data = null;
    }

    if (response.status === 401) {
      setToken(null);
      if (window.onQuinielaUnauthorized) window.onQuinielaUnauthorized();
    }

    if (!response.ok) {
      const message = data?.error || `Error ${response.status}`;
       throw new Error(message);
    }

    return data;
  }

  window.quinielaApi = {
    getToken,
    setToken,
    login(username, password) {
      return apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
    },
    logout() {
      setToken(null);
    },
    getMe() {
      return apiFetch("/auth/me");
    },
    fetchData() {
      return apiFetch("/data");
    },
    savePrediction(matchId, homeScore, awayScore) {
      return apiFetch(`/predictions/${matchId}`, {
        method: "PUT",
        body: JSON.stringify({ homeScore, awayScore })
      });
    },
    updateMatchScore(matchId, realHomeScore, realAwayScore) {
      return apiFetch(`/matches/${matchId}`, {
        method: "PUT",
        body: JSON.stringify({ realHomeScore, realAwayScore })
      });
    },
    updateMatchTeam(matchId, payload) {
      return apiFetch(`/matches/${matchId}/team`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    },
    addMatch(payload) {
      return apiFetch("/matches", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },
    syncLiveResults() {
      return apiFetch("/matches/sync-live", { method: "POST" });
    },
    getUsers() {
      return apiFetch("/users");
    },
    createUser(payload) {
      return apiFetch("/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },
    updateUser(id, payload) {
      return apiFetch(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    },
    resetUserPassword(id, password) {
      return apiFetch(`/users/${id}/password`, {
        method: "PUT",
        body: JSON.stringify(password ? { password } : {})
      });
    },
    deleteUser(id) {
      return apiFetch(`/users/${id}`, { method: "DELETE" });
    }
  };
})();
