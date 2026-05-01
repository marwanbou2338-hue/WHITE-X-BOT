"use strict";

const stateMod = require("../state");

function resolveTarget(args, ctx) {
  if (ctx.event.messageReply && ctx.event.messageReply.senderID) {
    return String(ctx.event.messageReply.senderID);
  }
  if (ctx.event.mentions) {
    const ids = Object.keys(ctx.event.mentions);
    if (ids.length > 0) return String(ids[0]);
  }
  if (args[0] && /^\d+$/.test(args[0])) return String(args[0]);
  return null;
}

module.exports = {
  name: "promote",
  aliases: ["رفع", "promote"],
  description: "رفع شخص الى ادمن البوت",
  run(args, ctx) {
    if (!stateMod.isAdmin(ctx.senderID)) {
      ctx.api.sendMessage("هذا الامر مخصص للادمنية فقط.", ctx.threadID, ctx.event.messageID);
      return;
    }

    const target = resolveTarget(args, ctx);
    if (!target) {
      ctx.api.sendMessage(
        "اكتب الايدي بعد الامر، او رد على رسالة الشخص، او منشن. مثال: رفع 100012345678901",
        ctx.threadID,
        ctx.event.messageID
      );
      return;
    }

    if (stateMod.isSuperAdmin(target)) {
      ctx.api.sendMessage("هذا الشخص مطور البوت اصلاً.", ctx.threadID, ctx.event.messageID);
      return;
    }

    if (stateMod.state.admins.has(target)) {
      ctx.api.sendMessage("هذا الشخص ادمن بالفعل.", ctx.threadID, ctx.event.messageID);
      return;
    }

    stateMod.promote(target);
    ctx.api.sendMessage(
      `✓ تم رفع الشخص (${target}) الى ادمن البوت.`,
      ctx.threadID,
      ctx.event.messageID
    );
  },
};
