"use strict";

const stateMod = require("./state");
const commands = require("./commands");
const { changeNicknameSafe } = require("./fb-helpers");

function handle(api, event) {
  try {
    trackActivity(event);
  } catch (e) {
    // ignore
  }

  try {
    handleProtectionEvents(api, event);
  } catch (e) {
    console.error("[PROTECT] error:", e && e.message ? e.message : e);
  }

  try {
    handleNewMembers(api, event);
  } catch (e) {
    console.error("[NEWMEMBER] error:", e && e.message ? e.message : e);
  }

  if (!event) return;
  if (event.type !== "message" && event.type !== "message_reply") return;
  if (!event.body) return;

  const senderID = String(event.senderID);
  const threadID = String(event.threadID);

  // Lock check: when locked, ignore everyone except admins/superadmins
  if (stateMod.state.lock.enabled) {
    const inLock =
      stateMod.state.lock.smart || stateMod.state.lock.threads.has(threadID);
    if (inLock && !stateMod.isAdmin(senderID)) {
      return;
    }
  }

  const prefix = stateMod.state.config.prefix || "";
  let text = String(event.body).trim();
  if (prefix) {
    if (!text.startsWith(prefix)) return;
    text = text.slice(prefix.length).trim();
  }
  if (!text) return;

  const tokens = text.split(/\s+/);
  const head = tokens[0];
  const rest = tokens.slice(1);

  commands.dispatch(head, rest, {
    api,
    event,
    senderID,
    threadID,
    body: event.body,
    raw: text,
  });
}

function trackActivity(event) {
  if (!event || !event.threadID) return;
  const threadID = String(event.threadID);
  const eng = stateMod.state.engine.get(threadID);
  if (!eng || !eng.smart) return;

  const trackedTypes = new Set([
    "message",
    "message_reply",
    "event",
    "change_thread_name",
    "change_thread_image",
    "change_thread_nickname",
    "change_thread_color",
    "change_thread_emoji",
    "log:thread-name",
    "log:user-nickname",
    "log:thread-image",
  ]);
  if (
    trackedTypes.has(event.type) ||
    (event.logMessageType && trackedTypes.has(event.logMessageType))
  ) {
    eng.lastActivityAt = Date.now();
  }
}

function getBotID(api) {
  try {
    return String(api.getCurrentUserID());
  } catch (e) {
    return "";
  }
}

function handleProtectionEvents(api, event) {
  if (!event || !event.threadID) return;
  const threadID = String(event.threadID);
  const logType = event.logMessageType;
  if (!logType) return;

  const author = event.author ? String(event.author) : null;
  const botID = getBotID(api);
  if (author && botID && author === botID) return;

  if (logType === "log:user-nickname") {
    const n = stateMod.getNickState(threadID);
    if (!n.locked) return;

    const data = event.logMessageData || {};
    const targetID = String(data.participant_id || "");
    const newNick = data.nickname == null ? "" : String(data.nickname);
    if (!targetID) return;

    let restoreTo = n.snapshot.get(targetID);
    if (restoreTo === undefined && n.defaultNickname) {
      restoreTo = n.defaultNickname;
    }
    if (restoreTo === undefined) return;
    if (restoreTo === newNick) return;

    changeNicknameSafe(api, restoreTo, threadID, targetID).catch((err) => {
      console.error(`[PROTECT] revert nickname failed:`, err.message || err);
    });
    return;
  }

  if (logType === "log:thread-name") {
    const g = stateMod.getGroupNameState(threadID);
    if (!g.locked || !g.name) return;

    const data = event.logMessageData || {};
    const newName = data.name == null ? "" : String(data.name);
    if (newName === g.name) return;

    const titleFn =
      typeof api.gcname === "function"
        ? api.gcname
        : typeof api.setTitle === "function"
        ? api.setTitle
        : null;
    if (!titleFn) return;
    titleFn.call(api, g.name, threadID, (err) => {
      if (err) console.error(`[PROTECT] revert title failed:`, err.message || err);
    });
  }
}

function handleNewMembers(api, event) {
  if (!event || event.logMessageType !== "log:subscribe") return;
  const threadID = String(event.threadID || "");
  if (!threadID) return;

  const n = stateMod.getNickState(threadID);
  if (!n.defaultNickname) return;

  const data = event.logMessageData || {};
  const added = data.addedParticipants || [];
  for (const p of added) {
    const uid = String(p.userFbId || p.userID || p.id || "");
    if (!uid) continue;
    changeNicknameSafe(api, n.defaultNickname, threadID, uid)
      .then(() => {
        n.snapshot.set(uid, n.defaultNickname);
      })
      .catch((err) => {
        console.error(`[NEWMEMBER] set nickname failed:`, err.message || err);
      });
  }
}

module.exports = { handle };
