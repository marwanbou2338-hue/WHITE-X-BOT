"use strict";

const stateMod = require("../state");
const { changeNicknameSafe } = require("../fb-helpers");

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

function changeNickname(api, nickname, threadID, userID) {
  return changeNicknameSafe(api, nickname, threadID, userID);
}

function pickTargetID(ctx) {
  if (ctx.event.messageReply && ctx.event.messageReply.senderID) {
    return String(ctx.event.messageReply.senderID);
  }
  if (ctx.event.mentions) {
    const ids = Object.keys(ctx.event.mentions);
    if (ids.length) return String(ids[0]);
  }
  return null;
}

function stripMention(text, ctx) {
  if (!ctx.event.mentions) return text;
  let out = text;
  for (const tag of Object.values(ctx.event.mentions)) {
    if (typeof tag === "string") out = out.split(tag).join("");
  }
  return out.trim();
}

async function setAll(args, ctx) {
  const text = args.join(" ").trim();
  if (!text) {
    ctx.api.sendMessage(
      "اكتب الكنية. مثال: كنية تعيين 🌟 عضو",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }
  const n = stateMod.getNickState(ctx.threadID);
  n.defaultNickname = text;

  let info;
  try {
    info = await getThreadInfo(ctx.api, ctx.threadID);
  } catch (e) {
    ctx.api.sendMessage(
      `تعذر جلب معلومات الجروب: ${e.message || "خطأ"}`,
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }

  const participants = (info && info.participantIDs) || [];
  let ok = 0,
    fail = 0;
  for (const uid of participants) {
    try {
      await changeNickname(ctx.api, text, ctx.threadID, uid);
      n.snapshot.set(String(uid), text);
      ok++;
    } catch (e) {
      fail++;
    }
  }

  ctx.api.sendMessage(
    `✓ تم تعيين الكنية للجميع\n• الكنية: ${text}\n• نجح: ${ok}\n• فشل: ${fail}`,
    ctx.threadID,
    ctx.event.messageID
  );
}

async function setOne(args, ctx) {
  const targetID = pickTargetID(ctx);
  if (!targetID) {
    ctx.api.sendMessage(
      "حدد العضو عن طريق الرد على رسالته او منشن. مثال (بالرد): كنية فرد <الكنية>",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }

  let raw = args.join(" ").trim();
  raw = stripMention(raw, ctx);
  if (!raw) {
    ctx.api.sendMessage(
      "اكتب الكنية بعد الامر.",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }

  try {
    await changeNickname(ctx.api, raw, ctx.threadID, targetID);
    const n = stateMod.getNickState(ctx.threadID);
    n.snapshot.set(String(targetID), raw);
    ctx.api.sendMessage(
      `✓ تم تعيين كنية العضو ${targetID}`,
      ctx.threadID,
      ctx.event.messageID
    );
  } catch (e) {
    ctx.api.sendMessage(
      `فشل تعيين الكنية: ${e.message || "خطأ"}`,
      ctx.threadID,
      ctx.event.messageID
    );
  }
}

async function lockNicks(ctx) {
  const n = stateMod.getNickState(ctx.threadID);
  let info;
  try {
    info = await getThreadInfo(ctx.api, ctx.threadID);
  } catch (e) {
    ctx.api.sendMessage(
      `تعذر جلب معلومات الجروب: ${e.message || "خطأ"}`,
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }

  n.snapshot.clear();
  const nicks = (info && info.nicknames) || {};
  for (const [uid, nick] of Object.entries(nicks)) {
    if (nick) n.snapshot.set(String(uid), nick);
  }
  if (n.defaultNickname) {
    const participants = (info && info.participantIDs) || [];
    for (const uid of participants) {
      if (!n.snapshot.has(String(uid))) {
        n.snapshot.set(String(uid), n.defaultNickname);
      }
    }
  }

  n.locked = true;
  ctx.api.sendMessage(
    `✓ تم قفل الكنيات\n• تم حفظ ${n.snapshot.size} كنية\n• اي تغيير سيتم ارجاعه تلقائياً`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function unlockNicks(ctx) {
  const n = stateMod.getNickState(ctx.threadID);
  n.locked = false;
  ctx.api.sendMessage("✓ تم فتح قفل الكنيات.", ctx.threadID, ctx.event.messageID);
}

async function clearNicks(ctx) {
  const n = stateMod.getNickState(ctx.threadID);
  let info;
  try {
    info = await getThreadInfo(ctx.api, ctx.threadID);
  } catch (e) {
    ctx.api.sendMessage(
      `تعذر جلب معلومات الجروب: ${e.message || "خطأ"}`,
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }

  n.locked = false;
  n.snapshot.clear();
  n.defaultNickname = null;

  const participants = (info && info.participantIDs) || [];
  let ok = 0,
    fail = 0;
  for (const uid of participants) {
    try {
      await changeNickname(ctx.api, "", ctx.threadID, uid);
      ok++;
    } catch (e) {
      fail++;
    }
  }

  ctx.api.sendMessage(
    `✓ تمت ازالة الكنيات\n• نجح: ${ok}\n• فشل: ${fail}`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function status(ctx) {
  const n = stateMod.getNickState(ctx.threadID);
  const msg = [
    "╭━〔 حالة الكنيات 〕━╮",
    `┃ القفل: ${n.locked ? "مفعل" : "معطل"}`,
    `┃ الكنية الافتراضية: ${n.defaultNickname || "—"}`,
    `┃ المحفوظ: ${n.snapshot.size} كنية`,
    "╰━━━━━━━━━━━━━━━╯",
  ].join("\n");
  ctx.api.sendMessage(msg, ctx.threadID, ctx.event.messageID);
}

module.exports = {
  name: "nickname",
  aliases: ["كنية", "كنيات", "nickname"],
  description: "ادارة كنيات الاعضاء وحمايتها",
  run(args, ctx) {
    if (!ensureAdmin(ctx)) return;
    const sub = (args[0] || "").toLowerCase();
    const rest = args.slice(1);

    switch (sub) {
      case "تعيين":
      case "ضبط":
      case "set":
        setAll(rest, ctx);
        break;
      case "فرد":
      case "واحد":
      case "one":
        setOne(rest, ctx);
        break;
      case "قفل":
      case "lock":
        lockNicks(ctx);
        break;
      case "فتح":
      case "unlock":
        unlockNicks(ctx);
        break;
      case "ازالة":
      case "مسح":
      case "clear":
        clearNicks(ctx);
        break;
      case "حالة":
      case "status":
        status(ctx);
        break;
      default:
        ctx.api.sendMessage(
          "الاوامر المتوفرة:\n• كنية تعيين <نص> — تعيين للجميع\n• كنية فرد <نص> (بالرد او منشن)\n• كنية قفل — حماية من التغيير\n• كنية فتح — الغاء الحماية\n• كنية ازالة — مسح كل الكنيات\n• كنية حالة",
          ctx.threadID,
          ctx.event.messageID
        );
    }
  },
};
