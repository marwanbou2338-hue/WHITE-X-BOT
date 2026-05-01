"use strict";

const stateMod = require("../state");

function ensureAdmin(ctx) {
  if (!stateMod.isAdmin(ctx.senderID)) {
    try {
      ctx.api.sendMessage("هذا الامر مخصص للادمنية فقط.", ctx.threadID, ctx.event.messageID);
    } catch (e) {}
    return false;
  }
  return true;
}

function turnOn(ctx) {
  const lock = stateMod.state.lock;
  lock.enabled = true;
  if (!lock.smart) {
    lock.threads.add(String(ctx.threadID));
  }
  ctx.api.sendMessage(
    `✓ تم تفعيل القفل (${lock.smart ? "الذكي - جميع المجموعات" : "عادي - هذه المجموعة فقط"}).`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function turnOff(ctx) {
  const lock = stateMod.state.lock;
  if (lock.smart) {
    lock.enabled = false;
    lock.smart = false;
    lock.threads.clear();
    ctx.api.sendMessage("✓ تم ايقاف القفل في جميع المجموعات.", ctx.threadID, ctx.event.messageID);
    return;
  }
  if (lock.threads.has(String(ctx.threadID))) {
    lock.threads.delete(String(ctx.threadID));
    if (lock.threads.size === 0) lock.enabled = false;
    ctx.api.sendMessage("✓ تم ايقاف القفل في هذه المجموعة.", ctx.threadID, ctx.event.messageID);
    return;
  }
  ctx.api.sendMessage("القفل غير مفعل في هذه المجموعة.", ctx.threadID, ctx.event.messageID);
}

function setSmart(ctx) {
  const lock = stateMod.state.lock;
  lock.smart = true;
  lock.enabled = true;
  lock.threads.clear();
  ctx.api.sendMessage(
    "✓ تم تفعيل القفل الذكي — البوت يتجاهل الجميع في كل المجموعات الا الادمنية.",
    ctx.threadID,
    ctx.event.messageID
  );
}

function setNormal(ctx) {
  const lock = stateMod.state.lock;
  lock.smart = false;
  lock.enabled = true;
  lock.threads.add(String(ctx.threadID));
  ctx.api.sendMessage(
    "✓ تم تفعيل القفل العادي — البوت يتجاهل الجميع في هذه المجموعة الا الادمنية.",
    ctx.threadID,
    ctx.event.messageID
  );
}

function status(ctx) {
  const lock = stateMod.state.lock;
  const lines = [
    "╭━〔 حالة القفل 〕━╮",
    `┃ مفعل: ${lock.enabled ? "نعم" : "لا"}`,
    `┃ النوع: ${lock.smart ? "ذكي (كل المجموعات)" : "عادي (مجموعات محددة)"}`,
    `┃ المجموعات المقفلة: ${lock.smart ? "الكل" : lock.threads.size}`,
    "╰━━━━━━━━━━━━╯",
  ].join("\n");
  ctx.api.sendMessage(lines, ctx.threadID, ctx.event.messageID);
}

module.exports = {
  name: "lock",
  aliases: ["قفل", "lock"],
  description: "تفعيل/ايقاف وضع تجاهل الرسائل لغير الادمنية",
  run(args, ctx) {
    if (!ensureAdmin(ctx)) return;

    const sub = (args[0] || "").toLowerCase();

    switch (sub) {
      case "تشغيل":
      case "on":
      case "start":
        turnOn(ctx);
        break;
      case "ايقاف":
      case "off":
      case "stop":
        turnOff(ctx);
        break;
      case "الذكي":
      case "ذكي":
      case "smart":
        setSmart(ctx);
        break;
      case "عادي":
      case "normal":
        setNormal(ctx);
        break;
      case "حالة":
      case "status":
        status(ctx);
        break;
      default:
        ctx.api.sendMessage(
          "الاوامر المتوفرة:\n• قفل تشغيل\n• قفل ايقاف\n• قفل الذكي\n• قفل عادي\n• قفل حالة",
          ctx.threadID,
          ctx.event.messageID
        );
    }
  },
};
