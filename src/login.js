"use strict";

const fs = require("fs");
const path = require("path");

function resolveLoginFn() {
  let mod;
  try {
    mod = require("ws3-fca");
  } catch (e) {
    try {
      mod = require("fca-unofficial");
    } catch (e2) {
      console.error("[LOGIN] No Facebook chat library found. Install ws3-fca.");
      throw e2;
    }
  }
  if (typeof mod === "function") return mod;
  if (mod && typeof mod.login === "function") return mod.login;
  if (mod && typeof mod.default === "function") return mod.default;
  if (mod && mod.default && typeof mod.default.login === "function") return mod.default.login;
  throw new Error("Could not locate login() function in fca module export.");
}

const login = resolveLoginFn();

function readAppState(appStatePath) {
  try {
    const raw = fs.readFileSync(appStatePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return null;
  } catch (e) {
    return null;
  }
}

function writeAppState(appStatePath, appState) {
  try {
    fs.writeFileSync(appStatePath, JSON.stringify(appState, null, 2));
    return true;
  } catch (e) {
    console.error("[LOGIN] Failed to save appstate:", e.message);
    return false;
  }
}

function buildLoginOptions(config) {
  const appStatePath = path.resolve(__dirname, "..", config.appStatePath || "./appstate.json");
  const appState = readAppState(appStatePath);
  if (appState) {
    return { type: "appstate", payload: { appState } };
  }
  const email = config.credentials && config.credentials.email;
  const password = config.credentials && config.credentials.password;
  if (email && password) {
    return { type: "credentials", payload: { email, password } };
  }
  return null;
}

function attemptLogin(opts) {
  return new Promise((resolve, reject) => {
    try {
      login(opts, (err, api) => {
        if (err) return reject(err);
        resolve(api);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function performLogin(config) {
  const appStatePath = path.resolve(__dirname, "..", config.appStatePath || "./appstate.json");
  const opts = buildLoginOptions(config);

  if (!opts) {
    throw new Error(
      "No appstate or credentials found. Edit bot/appstate.json or set credentials in bot/config.json."
    );
  }

  // Try appstate first if available
  if (opts.type === "appstate") {
    try {
      const api = await attemptLogin(opts.payload);
      try {
        const fresh = api.getAppState();
        if (Array.isArray(fresh) && fresh.length > 0) {
          writeAppState(appStatePath, fresh);
        }
      } catch (e) {
        // ignore
      }
      return api;
    } catch (err) {
      console.error("[LOGIN] AppState login failed:", err && err.error ? err.error : err);
      const email = config.credentials && config.credentials.email;
      const password = config.credentials && config.credentials.password;
      if (config.autoRefreshAppState && email && password) {
        console.log("[LOGIN] Falling back to credentials to refresh appstate...");
        return await loginWithCredentialsAndRefresh(email, password, appStatePath);
      }
      throw err;
    }
  }

  // Credentials login
  return await loginWithCredentialsAndRefresh(opts.payload.email, opts.payload.password, appStatePath);
}

async function loginWithCredentialsAndRefresh(email, password, appStatePath) {
  const api = await attemptLogin({ email, password });
  try {
    const fresh = api.getAppState();
    if (Array.isArray(fresh) && fresh.length > 0) {
      writeAppState(appStatePath, fresh);
      console.log("[LOGIN] AppState refreshed and saved.");
    }
  } catch (e) {
    console.error("[LOGIN] Could not extract appstate after credential login:", e.message);
  }
  return api;
}

function saveAppStatePeriodically(api, config) {
  const appStatePath = path.resolve(__dirname, "..", config.appStatePath || "./appstate.json");
  const intervalMs = config.appStateSaveIntervalMs || 5 * 60 * 1000;
  return setInterval(() => {
    try {
      const fresh = api.getAppState();
      if (Array.isArray(fresh) && fresh.length > 0) {
        writeAppState(appStatePath, fresh);
      }
    } catch (e) {
      // ignore
    }
  }, intervalMs);
}

module.exports = {
  performLogin,
  saveAppStatePeriodically,
};
