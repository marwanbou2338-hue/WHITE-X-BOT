"use strict";

const stateMod = require("../state");
const { extractAfterTokens } = require("../utils");

const SMART_INACTIVITY_MS = 60 * 1000;

function ensureAdmin(ctx) {
  if (!stateMod.isAdmin(ctx.senderID)) {
    try {
      ctx.api.sendMessage("هذا الامر مخصص للادمنية فقط.", ctx.threadID, ctx.event.messageID);
    } catch (e) {}
    return false;
  }
  return true;
}

function sendEngineMessage(eng, api) {
  try {
    api.sendMessage(eng.message, eng.threadID, (err) => {
      if (err) {
        console.error(`[engine:${eng.threadID}] send failed:`, err.message || err);
      } else {
        eng.lastSentAt = Date.now();
      }
    });
  } catch (e) {
    console.error(`[engine:${eng.threadID}] send threw:`, e.message || e);
  }
}

function scheduleEngine(eng, api) {
  if (eng.timer) {
    clearInterval(eng.timer);
    eng.timer = null;
  }
  const minInterval =
    (stateMod.state.config && stateMod.state.config.engine && stateMod.state.config.engine.minIntervalMs) ||
    1500;
  const interval = Math.max(eng.intervalMs, minInterval);

  eng.timer = setInterval(() => {
    if (!eng.running) return;
    if (eng.smart) {
      const idle = Date.now() - eng.lastActivityAt;
      if (idle > SMART_INACTIVITY_MS) {
        return;
      }
    }
    sendEngineMessage(eng, api);
  }, interval);
}

function startEngine(ctx) {
  const eng = stateMod.getEngine(ctx.threadID);
  if (eng.running) {
    ctx.api.sendMessage("المحرك يعمل بالفعل في هذه المجموعة.", ctx.threadID, ctx.event.messageID);
    return;
  }
  if (!eng.message || !String(eng.message).trim()) {
    ctx.api.sendMessage(
      "لم يتم تعيين رسالة للمحرك بعد. مثال: محرك رسالة مرحبا",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }
  eng.running = true;
  eng.lastActivityAt = Date.now();
  ctx.api.sendMessage(
    `✓ تم تشغيل المحرك\n• الفترة: ${Math.round(eng.intervalMs / 1000)} ثانية\n• الوضع الذكي: ${
      eng.smart ? "مفعل" : "معطل"
    }`,
    ctx.threadID,
    ctx.event.messageID,
    () => {
      sendEngineMessage(eng, ctx.api);
      scheduleEngine(eng, ctx.api);
    }
  );
}

function stopEngine(ctx) {
  const stopped = stateMod.stopEngine(ctx.threadID);
  if (stopped) {
    ctx.api.sendMessage("✓ تم ايقاف المحرك.", ctx.threadID, ctx.event.messageID);
  } else {
    ctx.api.sendMessage("المحرك غير شغال.", ctx.threadID, ctx.event.messageID);
  }
}

function setMessage(_args, ctx) {
  const text = extractAfterTokens(ctx.raw, 2).trim();
  if (!text) {
    ctx.api.sendMessage(
      "اكتب الرسالة بعد الامر. مثال: محرك رسالة مرحبا",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }
  const eng = stateMod.getEngine(ctx.threadID);
  eng.message = text;
  ctx.api.sendMessage(`✓ تم تعيين رسالة المحرك (${text.length} حرف).`, ctx.threadID, ctx.event.messageID);
}

function setTime(args, ctx) {
  const seconds = Number(args[0]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    ctx.api.sendMessage(
      "اكتب الوقت بالثواني. مثال: محرك وقت 5",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }
  const minMs =
    (stateMod.state.config && stateMod.state.config.engine && stateMod.state.config.engine.minIntervalMs) ||
    1500;
  const newInterval = Math.max(seconds * 1000, minMs);
  const eng = stateMod.getEngine(ctx.threadID);
  eng.intervalMs = newInterval;
  if (eng.running) scheduleEngine(eng, ctx.api);
  const note = newInterval > seconds * 1000 ? " (تم تعديلها للحد الادنى)" : "";
  ctx.api.sendMessage(
    `✓ تم تعيين فترة المحرك على ${Math.round(newInterval / 1000)} ثانية${note}.`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function setSmart(args, ctx) {
  const eng = stateMod.getEngine(ctx.threadID);
  const arg = (args[0] || "").toLowerCase();
  let enable;
  if (["تشغيل", "on", "فعل", "تفعيل", "1", "true"].includes(arg)) enable = true;
  else if (["ايقاف", "off", "تعطيل", "0", "false"].includes(arg)) enable = false;
  else enable = !eng.smart;

  eng.smart = enable;
  if (enable) eng.lastActivityAt = Date.now();
  ctx.api.sendMessage(
    `✓ الوضع الذكي للمحرك: ${enable ? "مفعل (يرسل فقط عند وجود نشاط)" : "معطل"}`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function status(ctx) {
  const eng = stateMod.getEngine(ctx.threadID);
  const preview = eng.message
    ? eng.message.length > 60
      ? eng.message.slice(0, 60) + "..."
      : eng.message
    : "—";
  const lastSent = eng.lastSentAt
    ? `${Math.round((Date.now() - eng.lastSentAt) / 1000)} ثانية`
    : "لم يُرسل بعد";
  const msg = [
    "╭━〔 حالة المحرك 〕━╮",
    `┃ الحالة: ${eng.running ? "شغال" : "متوقف"}`,
    `┃ الفترة: ${Math.round(eng.intervalMs / 1000)} ثانية`,
    `┃ الذكي: ${eng.smart ? "مفعل" : "معطل"}`,
    `┃ اخر ارسال: ${lastSent}`,
    `┃ الرسالة: ${preview}`,
    "╰━━━━━━━━━━━━━━━╯",
  ].join("\n");
  ctx.api.sendMessage(msg, ctx.threadID, ctx.event.messageID);
}

module.exports = {
  name: "engine",
  aliases: ["محرك", "engine"],
  description: "تشغيل/ايقاف وضبط محرك الرسائل",
  run(args, ctx) {
    if (!ensureAdmin(ctx)) return;

    const sub = (args[0] || "").toLowerCase();
    const rest = args.slice(1);

    switch (sub) {
      case "تشغيل":
      case "on":
      case "start":
        startEngine(ctx);
        break;
      case "ايقاف":
      case "off":
      case "stop":
        stopEngine(ctx);
        break;
      case "رسالة":
      case "msg":
      case "message":
        setMessage(rest, ctx);
        break;
      case "وقت":
      case "time":
      case "interval":
        setTime(rest, ctx);
        break;
      case "الذكي":
      case "ذكي":
      case "smart":
        setSmart(rest, ctx);
        break;
      case "حالة":
      case "status":
        status(ctx);
        break;
      default:
        ctx.api.sendMessage(
          "الاوامر المتوفرة:\n• محرك تشغيل\n• محرك ايقاف\n• محرك رسالة <نص>\n• محرك وقت <ثواني>\n• محرك الذكي تشغيل/ايقاف\n• محرك حالة",
          ctx.threadID,
          ctx.event.messageID
        );
    }
  },
};
