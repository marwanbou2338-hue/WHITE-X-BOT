"use strict";

const state = {
  api: null,
  config: null,
  startTime: Date.now(),
  admins: new Set(),
  superAdmins: new Set(),
  engine: new Map(),
  autoReply: new Map(),
  nicknames: new Map(),
  groupNames: new Map(),
  lock: {
    enabled: false,
    smart: false,
    threads: new Set(),
  },
};

function init(config) {
  state.config = config;
  state.superAdmins = new Set((config.superAdmins || []).map(String));
  for (const id of config.defaultAdmins || []) {
    state.admins.add(String(id));
  }
}

function setApi(api) {
  state.api = api;
}

function getApi() {
  return state.api;
}

function isSuperAdmin(uid) {
  return state.superAdmins.has(String(uid));
}

function isAdmin(uid) {
  return state.admins.has(String(uid)) || isSuperAdmin(uid);
}

function promote(uid) {
  state.admins.add(String(uid));
  return true;
}

function demote(uid) {
  if (isSuperAdmin(uid)) return false;
  return state.admins.delete(String(uid));
}

function getEngine(threadID) {
  let eng = state.engine.get(String(threadID));
  if (!eng) {
    const cfg = state.config && state.config.engine ? state.config.engine : {};
    eng = {
      threadID: String(threadID),
      running: false,
      smart: false,
      message: cfg.defaultMessage || "....",
      intervalMs: cfg.defaultIntervalMs || 5000,
      lastActivityAt: Date.now(),
      timer: null,
    };
    state.engine.set(String(threadID), eng);
  }
  return eng;
}

function stopEngine(threadID) {
  const eng = state.engine.get(String(threadID));
  if (!eng) return false;
  if (eng.timer) {
    clearInterval(eng.timer);
    eng.timer = null;
  }
  eng.running = false;
  return true;
}

function getAutoReply(threadID) {
  let ar = state.autoReply.get(String(threadID));
  if (!ar) {
    const cfg = state.config && state.config.autoReply ? state.config.autoReply : {};
    ar = {
      threadID: String(threadID),
      running: false,
      message: cfg.defaultMessage || "Auto Reply",
      intervalMs: cfg.defaultIntervalMs || 5000,
      timer: null,
    };
    state.autoReply.set(String(threadID), ar);
  }
  return ar;
}

function stopAutoReply(threadID) {
  const ar = state.autoReply.get(String(threadID));
  if (!ar) return false;
  if (ar.timer) {
    clearInterval(ar.timer);
    ar.timer = null;
  }
  ar.running = false;
  return true;
}

function getNickState(threadID) {
  let n = state.nicknames.get(String(threadID));
  if (!n) {
    n = {
      threadID: String(threadID),
      locked: false,
      defaultNickname: null,
      snapshot: new Map(),
    };
    state.nicknames.set(String(threadID), n);
  }
  return n;
}

function getGroupNameState(threadID) {
  let g = state.groupNames.get(String(threadID));
  if (!g) {
    g = {
      threadID: String(threadID),
      locked: false,
      name: null,
    };
    state.groupNames.set(String(threadID), g);
  }
  return g;
}

function getUptimeMs() {
  return Date.now() - state.startTime;
}

module.exports = {
  state,
  init,
  setApi,
  getApi,
  isSuperAdmin,
  isAdmin,
  promote,
  demote,
  getEngine,
  stopEngine,
  getAutoReply,
  stopAutoReply,
  getNickState,
  getGroupNameState,
  getUptimeMs,
};
