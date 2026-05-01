"use strict";

const stateMod = require("../state");
const { extractAfterTokens } = require("../utils");

function ensureAdmin(ctx) {
  if (!stateMod.isAdmin(ctx.senderID)) {
    try {
      ctx.api.sendMessage("هذا الامر مخصص للادمنية فقط.", ctx.threadID, ctx.event.messageID);
    } catch (e) {}
    return false;
  }
  return true;
}

function scheduleAutoReply(ar, api) {
  if (ar.timer) {
    clearInterval(ar.timer);
    ar.timer = null;
  }
  const minInterval =
    (stateMod.state.config &&
      stateMod.state.config.autoReply &&
      stateMod.state.config.autoReply.minIntervalMs) ||
    1500;
  const interval = Math.max(ar.intervalMs, minInterval);

  ar.timer = setInterval(() => {
    if (!ar.running) return;
    try {
      api.sendMessage(ar.message, ar.threadID);
    } catch (e) {
      console.error(`[autoReply:${ar.threadID}] send failed:`, e.message);
    }
  }, interval);
}

function startAutoReply(ctx) {
  const ar = stateMod.getAutoReply(ctx.threadID);
  if (ar.running) {
    ctx.api.sendMessage(
      "ميزة الرد التلقائي تعمل بالفعل في هذه المجموعة.",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }
  ar.running = true;
  scheduleAutoReply(ar, ctx.api);
  ctx.api.sendMessage(
    `✓ تم تشغيل الرد التلقائي\n• الفترة: ${Math.round(ar.intervalMs / 1000)} ثانية`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function stopAutoReplyCmd(ctx) {
  const stopped = stateMod.stopAutoReply(ctx.threadID);
  if (stopped) {
    ctx.api.sendMessage("✓ تم ايقاف الرد التلقائي.", ctx.threadID, ctx.event.messageID);
  } else {
    ctx.api.sendMessage("الرد التلقائي غير شغال.", ctx.threadID, ctx.event.messageID);
  }
}

function setTime(args, ctx) {
  const seconds = Number(args[0]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    ctx.api.sendMessage(
      "اكتب الوقت بالثواني. مثال: تلقائي وقت 5",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }
  const minMs =
    (stateMod.state.config &&
      stateMod.state.config.autoReply &&
      stateMod.state.config.autoReply.minIntervalMs) ||
    1500;
  const newInterval = Math.max(seconds * 1000, minMs);
  const ar = stateMod.getAutoReply(ctx.threadID);
  ar.intervalMs = newInterval;
  if (ar.running) scheduleAutoReply(ar, ctx.api);
  ctx.api.sendMessage(
    `✓ تم تعيين فترة الرد التلقائي على ${Math.round(newInterval / 1000)} ثانية.`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function setMessage(_args, ctx) {
  const text = extractAfterTokens(ctx.raw, 2).trim();
  if (!text) {
    ctx.api.sendMessage(
      "اكتب الرسالة بعد الامر. مثال: تلقائي رسالة مرحبا",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }
  const ar = stateMod.getAutoReply(ctx.threadID);
  ar.message = text;
  ctx.api.sendMessage(
    `✓ تم تعيين رسالة الرد التلقائي (${text.length} حرف).`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function resetMessage(ctx) {
  const cfg = (stateMod.state.config && stateMod.state.config.autoReply) || {};
  const ar = stateMod.getAutoReply(ctx.threadID);
  ar.message = cfg.defaultMessage || "Auto Reply";
  ctx.api.sendMessage(
    "✓ تم استرجاع الرسالة الافتراضية.",
    ctx.threadID,
    ctx.event.messageID
  );
}

function status(ctx) {
  const ar = stateMod.getAutoReply(ctx.threadID);
  const preview = ar.message.length > 80 ? ar.message.slice(0, 80) + "..." : ar.message;
  const msg = [
    "╭━〔 حالة الرد التلقائي 〕━╮",
    `┃ الحالة: ${ar.running ? "شغال" : "متوقف"}`,
    `┃ الفترة: ${Math.round(ar.intervalMs / 1000)} ثانية`,
    `┃ الرسالة: ${preview}`,
    "╰━━━━━━━━━━━━━━━╯",
  ].join("\n");
  ctx.api.sendMessage(msg, ctx.threadID, ctx.event.messageID);
}

module.exports = {
  name: "autoreply",
  aliases: ["تلقائي", "ردود", "autoreply"],
  description: "ارسال رسالة تلقائية بفترة زمنية محددة",
  run(args, ctx) {
    if (!ensureAdmin(ctx)) return;

    const sub = (args[0] || "").toLowerCase();
    const rest = args.slice(1);

    switch (sub) {
      case "تشغيل":
      case "on":
      case "start":
        startAutoReply(ctx);
        break;
      case "ايقاف":
      case "off":
      case "stop":
        stopAutoReplyCmd(ctx);
        break;
      case "وقت":
      case "time":
      case "interval":
        setTime(rest, ctx);
        break;
      case "رسالة":
      case "msg":
      case "message":
        setMessage(rest, ctx);
        break;
      case "استرجاع":
      case "reset":
      case "افتراضي":
        resetMessage(ctx);
        break;
      case "حالة":
      case "status":
        status(ctx);
        break;
      default:
        ctx.api.sendMessage(
          "الاوامر المتوفرة:\n• تلقائي تشغيل\n• تلقائي ايقاف\n• تلقائي وقت <ثواني>\n• تلقائي رسالة <نص>\n• تلقائي استرجاع\n• تلقائي حالة",
          ctx.threadID,
          ctx.event.messageID
        );
    }
  },
};
