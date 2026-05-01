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
  name: "demote",
  aliases: ["اخفاض", "تنزيل", "demote"],
  description: "تنزيل شخص من صلاحيات ادمن البوت",
  run(args, ctx) {
    if (!stateMod.isAdmin(ctx.senderID)) {
      ctx.api.sendMessage("هذا الامر مخصص للادمنية فقط.", ctx.threadID, ctx.event.messageID);
      return;
    }

    const target = resolveTarget(args, ctx);
    if (!target) {
      ctx.api.sendMessage(
        "اكتب الايدي بعد الامر، او رد على رسالة الشخص. مثال: اخفاض 100012345678901",
        ctx.threadID,
        ctx.event.messageID
      );
      return;
    }

    if (stateMod.isSuperAdmin(target)) {
      ctx.api.sendMessage(
        "لا يمكن تنزيل مطور البوت (superadmin).",
        ctx.threadID,
        ctx.event.messageID
      );
      return;
    }

    const ok = stateMod.demote(target);
    if (!ok) {
      ctx.api.sendMessage(
        "هذا الشخص ليس ادمن اصلاً.",
        ctx.threadID,
        ctx.event.messageID
      );
      return;
    }

    ctx.api.sendMessage(
      `✓ تم تنزيل الشخص (${target}) من قائمة الادمنية.`,
      ctx.threadID,
      ctx.event.messageID
    );
  },
};
