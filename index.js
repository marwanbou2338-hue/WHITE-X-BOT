"use strict";

const path = require("path");
const fs = require("fs");

const config = require("./config.json");
const stateMod = require("./src/state");
const handler = require("./src/handler");
const { performLogin, saveAppStatePeriodically } = require("./src/login");

stateMod.init(config);

let saveInterval = null;
let restarting = false;

function safeStringifyError(err) {
  if (!err) return "unknown";
  if (typeof err === "string") return err;
  if (err.error) return JSON.stringify(err);
  if (err.stack) return err.stack;
  try {
    return JSON.stringify(err);
  } catch (_) {
    return String(err);
  }
}

async function startBot() {
  if (restarting) return;
  restarting = true;

  try {
    console.log("[BOOT] Logging in to Facebook...");
    const api = await performLogin(config);
    restarting = false;

    api.setOptions({
      listenEvents: !!config.listenEvents,
      selfListen: !!config.selfListen,
      autoMarkRead: !!config.autoMarkRead,
      autoMarkDelivery: !!config.autoMarkDelivery,
      online: !!config.online,
      forceLogin: true,
      updatePresence: false,
      userAgent: config.userAgent || undefined,
    });

    stateMod.setApi(api);

    if (saveInterval) clearInterval(saveInterval);
    saveInterval = saveAppStatePeriodically(api, config);

    const userId =
      typeof api.getCurrentUserID === "function" ? api.getCurrentUserID() : "unknown";
    console.log(`[READY] Logged in as ${userId}. Listening for events...`);

    let listener = null;
    const onEvent = (err, event) => {
      if (err) {
        console.error("[LISTEN] error:", safeStringifyError(err));
        if (config.reconnectOnError) {
          scheduleReconnect();
        }
        return;
      }
      try {
        handler.handle(api, event);
      } catch (e) {
        console.error("[HANDLER] error:", e && e.stack ? e.stack : e);
      }
    };

    if (typeof api.listenMqtt === "function") {
      listener = api.listenMqtt(onEvent);
    } else if (typeof api.listen === "function") {
      listener = api.listen(onEvent);
    } else {
      console.error("[LISTEN] No listener method found on api.");
      scheduleReconnect();
    }
  } catch (err) {
    restarting = false;
    console.error("[BOOT] Login failed:", safeStringifyError(err));
    if (config.reconnectOnError) {
      scheduleReconnect();
    }
  }
}

function scheduleReconnect() {
  const delay = Math.max(config.reconnectDelayMs || 10000, 5000);
  console.log(`[RECONNECT] retrying in ${delay}ms...`);
  setTimeout(() => startBot(), delay);
}

process.on("uncaughtException", (e) => {
  console.error("[UNCAUGHT]", e && e.stack ? e.stack : e);
});

process.on("unhandledRejection", (e) => {
  console.error("[REJECTION]", e && e.stack ? e.stack : e);
});

startBot();
