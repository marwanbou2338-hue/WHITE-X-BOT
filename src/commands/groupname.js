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

function getThreadInfo(api, threadID) {
  return new Promise((resolve, reject) => {
    api.getThreadInfo(threadID, (err, info) => {
      if (err) return reject(err);
      resolve(info);
    });
  });
}

function setTitle(api, title, threadID) {
  return new Promise((resolve, reject) => {
    const fn =
      typeof api.gcname === "function"
        ? api.gcname
        : typeof api.setTitle === "function"
        ? api.setTitle
        : null;
    if (!fn) {
      return reject(new Error("api.gcname/setTitle غير متوفرة في هذه النسخة"));
    }
    fn.call(api, title, threadID, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function setName(args, ctx) {
  const text = args.join(" ").trim();
  if (!text) {
    ctx.api.sendMessage(
      "اكتب اسم الجروب. مثال: اسم تعيين فريقي",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }
  try {
    await setTitle(ctx.api, text, ctx.threadID);
    const g = stateMod.getGroupNameState(ctx.threadID);
    g.name = text;
    ctx.api.sendMessage(
      `✓ تم تعيين اسم الجروب: ${text}`,
      ctx.threadID,
      ctx.event.messageID
    );
  } catch (e) {
    ctx.api.sendMessage(
      `فشل تعيين الاسم: ${e.message || "خطأ"}`,
      ctx.threadID,
      ctx.event.messageID
    );
  }
}

async function lockName(ctx) {
  const g = stateMod.getGroupNameState(ctx.threadID);
  if (!g.name) {
    try {
      const info = await getThreadInfo(ctx.api, ctx.threadID);
      g.name = (info && (info.threadName || info.name)) || null;
    } catch (e) {}
  }
  if (!g.name) {
    ctx.api.sendMessage(
      "لم اتمكن من جلب اسم الجروب الحالي. عيّن الاسم اولاً: اسم تعيين <الاسم>",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }
  g.locked = true;
  ctx.api.sendMessage(
    `✓ تم قفل اسم الجروب\n• الاسم: ${g.name}\n• اي تغيير سيتم ارجاعه تلقائياً`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function unlockName(ctx) {
  const g = stateMod.getGroupNameState(ctx.threadID);
  g.locked = false;
  ctx.api.sendMessage("✓ تم فتح قفل اسم الجروب.", ctx.threadID, ctx.event.messageID);
}

function status(ctx) {
  const g = stateMod.getGroupNameState(ctx.threadID);
  const msg = [
    "╭━〔 حالة اسم الجروب 〕━╮",
    `┃ القفل: ${g.locked ? "مفعل" : "معطل"}`,
    `┃ الاسم المحفوظ: ${g.name || "—"}`,
    "╰━━━━━━━━━━━━━━━╯",
  ].join("\n");
  ctx.api.sendMessage(msg, ctx.threadID, ctx.event.messageID);
}

module.exports = {
  name: "groupname",
  aliases: ["اسم", "غروب", "groupname"],
  description: "تعيين اسم الجروب وحمايته من التغيير",
  run(args, ctx) {
    if (!ensureAdmin(ctx)) return;
    const sub = (args[0] || "").toLowerCase();
    const rest = args.slice(1);

    switch (sub) {
      case "تعيين":
      case "ضبط":
      case "set":
        setName(rest, ctx);
        break;
      case "قفل":
      case "lock":
        lockName(ctx);
        break;
      case "فتح":
      case "unlock":
        unlockName(ctx);
        break;
      case "حالة":
      case "status":
        status(ctx);
        break;
      default:
        ctx.api.sendMessage(
          "الاوامر المتوفرة:\n• اسم تعيين <الاسم>\n• اسم قفل — حماية من التغيير\n• اسم فتح — الغاء الحماية\n• اسم حالة",
          ctx.threadID,
          ctx.event.messageID
        );
    }
  },
};
