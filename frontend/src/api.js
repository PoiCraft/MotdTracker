const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function request(path, init) {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    let text = "";
    try {
      text = await response.text();
    } catch {
      text = "";
    }
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  server: {
    full(hours = 12) {
      return request(`/api/web/server?hours=${hours}`);
    },
    head(hours = 12) {
      return request(`/api/web/server/head?hours=${hours}`);
    },
    nodes() {
      return request("/api/server/nodes");
    }
  },
  node: {
    full(nodeId, hours = 12) {
      return request(`/api/web/node/${nodeId}?hours=${hours}`);
    },
    head(nodeId, hours = 12) {
      return request(`/api/web/node/${nodeId}/head?hours=${hours}`);
    }
  },
  player: {
    list() {
      return request("/api/player");
    },
    detail(name) {
      return request(`/api/player/${encodeURIComponent(name)}/detail`);
    },
    sessions(name, days = 30) {
      return request(`/api/player/${encodeURIComponent(name)}/sessions?days=${days}`);
    },
    weekly(name) {
      return request(`/api/player/${encodeURIComponent(name)}/weekly-stats`);
    }
  },
  badge: {
    nodes() {
      return request("/api/node");
    }
  }
};

export function getApiBase() {
  return API_BASE;
}