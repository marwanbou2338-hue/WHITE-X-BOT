"use strict";

module.exports = {
  name: "commands",
  aliases: ["الاوامر", "اوامر", "commands", "help"],
  description: "عرض جميع الاوامر المتوفرة",
  run(args, ctx) {
    const lines = [];
    lines.push("╭━━━〔 الاوامر 〕━━━╮");
    lines.push("┃");
    lines.push("┃ • الاوامر — عرض هذه القائمة");
    lines.push("┃ • سيرفر / ابتيم — حالة البوت ومدة التشغيل");
    lines.push("┃");
    lines.push("┃ ▸ اوامر المحرك:");
    lines.push("┃   • محرك تشغيل");
    lines.push("┃   • محرك ايقاف");
    lines.push("┃   • محرك رسالة <النص>");
    lines.push("┃   • محرك وقت <ثواني>");
    lines.push("┃   • محرك الذكي تشغيل/ايقاف");
    lines.push("┃   • محرك حالة");
    lines.push("┃");
    lines.push("┃ ▸ اوامر الصلاحيات:");
    lines.push("┃   • رفع <ايدي او رد>");
    lines.push("┃   • اخفاض <ايدي او رد>");
    lines.push("┃");
    lines.push("┃ ▸ اوامر القفل:");
    lines.push("┃   • قفل تشغيل");
    lines.push("┃   • قفل ايقاف");
    lines.push("┃   • قفل عادي");
    lines.push("┃   • قفل الذكي");
    lines.push("┃   • قفل حالة");
    lines.push("┃");
    lines.push("┃ ▸ اوامر الرد التلقائي:");
    lines.push("┃   • تلقائي تشغيل");
    lines.push("┃   • تلقائي ايقاف");
    lines.push("┃   • تلقائي وقت <ثواني>");
    lines.push("┃   • تلقائي رسالة <نص>");
    lines.push("┃   • تلقائي استرجاع");
    lines.push("┃   • تلقائي حالة");
    lines.push("┃");
    lines.push("┃ ▸ اوامر الكنيات:");
    lines.push("┃   • كنية تعيين <نص>");
    lines.push("┃   • كنية فرد <نص> (بالرد/منشن)");
    lines.push("┃   • كنية قفل / فتح");
    lines.push("┃   • كنية ازالة");
    lines.push("┃   • كنية حالة");
    lines.push("┃");
    lines.push("┃ ▸ اوامر اسم الجروب:");
    lines.push("┃   • اسم تعيين <الاسم>");
    lines.push("┃   • اسم قفل / فتح");
    lines.push("┃   • اسم حالة");
    lines.push("┃");
    lines.push("╰━━━━━━━━━━━━━━━╯");

    try {
      ctx.api.sendMessage(lines.join("\n"), ctx.threadID, ctx.event.messageID);
    } catch (e) {
      console.error("[commands] send failed:", e.message);
    }
  },
};
