"use strict";

const stateMod = require("../state");
const os = require("os");

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const parts = [];
  if (days) parts.push(`${days} يوم`);
  if (hours) parts.push(`${hours} ساعة`);
  if (minutes) parts.push(`${minutes} دقيقة`);
  parts.push(`${seconds} ثانية`);
  return parts.join(" و ");
}

module.exports = {
  name: "uptime",
  aliases: ["سيرفر", "ابتيم", "uptime", "ping"],
  description: "حالة البوت ومدة التشغيل",
  run(args, ctx) {
    const uptime = stateMod.getUptimeMs();
    const mem = process.memoryUsage();
    const used = (mem.rss / 1024 / 1024).toFixed(1);
    const total = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const platform = `${os.platform()} ${os.arch()}`;
    const node = process.version;

    const msg = [
      "╭━━━〔 السيرفر 〕━━━╮",
      `┃ ✔ البوت شغال`,
      `┃ ⏱ المدة: ${formatDuration(uptime)}`,
      `┃ 💾 الذاكرة: ${used} MB`,
      `┃ 🖥 النظام: ${platform}`,
      `┃ 🟢 رام السيرفر: ${total} GB`,
      `┃ ⚙️ نود: ${node}`,
      "╰━━━━━━━━━━━━━━╯",
    ].join("\n");

    try {
      ctx.api.sendMessage(msg, ctx.threadID, ctx.event.messageID);
    } catch (e) {
      console.error("[uptime] send failed:", e.message);
    }
  },
};
