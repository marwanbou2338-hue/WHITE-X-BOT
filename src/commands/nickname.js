"use strict";

const stateMod = require("../state");
const { changeNicknameSafe, changeNicknamesBulk } = require("../fb-helpers");

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
  if (!participants.length) {
    ctx.api.sendMessage("تعذر جلب قائمة الاعضاء.", ctx.threadID, ctx.event.messageID);
    return;
  }

  ctx.api.sendMessage(
    `⏳ جاري تعيين الكنية لـ ${participants.length} عضو...`,
    ctx.threadID,
    ctx.event.messageID
  );

  const { ok, fail } = await changeNicknamesBulk(ctx.api, text, ctx.threadID, participants);

  if (ok > 0) {
    const n = stateMod.getNickState(ctx.threadID);
    n.defaultNickname = text;
    for (const uid of participants) {
      n.snapshot.set(String(uid), text);
    }
  }

  ctx.api.sendMessage(
    `${ok > 0 ? "✓" : "✗"} نتيجة تعيين الكنية\n• الكنية: ${text}\n• نجح: ${ok}\n• فشل: ${fail}`,
    ctx.threadID,
    ctx.event.messageID
  );
}

async function setOne(args, ctx) {
  const targetID = pickTargetID(ctx);
  if (!targetID) {
    ctx.api.sendMessage(
      "حدد العضو عن طريق الرد على رسالته او منشن.\nمثال (بالرد): كنية فرد <الكنية>",
      ctx.threadID,
      ctx.event.messageID
    );
    return;
  }

  let raw = args.join(" ").trim();
  raw = stripMention(raw, ctx);
  if (!raw) {
    ctx.api.sendMessage("اكتب الكنية بعد الامر.", ctx.threadID, ctx.event.messageID);
    return;
  }

  const n = stateMod.getNickState(ctx.threadID);
  const prevNick = n.snapshot.get(String(targetID));

  n.snapshot.set(String(targetID), raw);

  try {
    await changeNicknameSafe(ctx.api, raw, ctx.threadID, targetID);
    ctx.api.sendMessage(
      `✓ تم تعيين كنية العضو\n• الكنية: ${raw}`,
      ctx.threadID,
      ctx.event.messageID
    );
  } catch (e) {
    if (prevNick !== undefined) {
      n.snapshot.set(String(targetID), prevNick);
    } else {
      n.snapshot.delete(String(targetID));
    }
    ctx.api.sendMessage(
      `✗ فشل تعيين الكنية: ${e.message || "خطأ"}`,
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

  if (n.snapshot.size === 0) {
    ctx.api.sendMessage(
      "✓ تم تفعيل القفل\n⚠ لا توجد كنيات محفوظة حالياً\nاستخدم (كنية تعيين) اولاً لتعيين كنيات تحميها",
      ctx.threadID,
      ctx.event.messageID
    );
  } else {
    ctx.api.sendMessage(
      `✓ تم قفل الكنيات\n• محفوظ: ${n.snapshot.size} كنية\n• اي تغيير سيتم ارجاعه تلقائياً`,
      ctx.threadID,
      ctx.event.messageID
    );
  }
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

  if (!participants.length) {
    ctx.api.sendMessage("تعذر جلب قائمة الاعضاء.", ctx.threadID, ctx.event.messageID);
    return;
  }

  ctx.api.sendMessage(
    `⏳ جاري ازالة الكنيات عن ${participants.length} عضو...`,
    ctx.threadID,
    ctx.event.messageID
  );

  const { ok, fail } = await changeNicknamesBulk(ctx.api, "", ctx.threadID, participants);

  ctx.api.sendMessage(
    `${ok > 0 ? "✓" : "✗"} نتيجة ازالة الكنيات\n• نجح: ${ok}\n• فشل: ${fail}`,
    ctx.threadID,
    ctx.event.messageID
  );
}

function status(ctx) {
  const n = stateMod.getNickState(ctx.threadID);
  const lines = [
    "╭━〔 حالة الكنيات 〕━╮",
    `┃ القفل: ${n.locked ? "🔒 مفعل" : "🔓 معطل"}`,
    `┃ الكنية الافتراضية: ${n.defaultNickname || "—"}`,
    `┃ المحفوظ: ${n.snapshot.size} كنية`,
    "╰━━━━━━━━━━━━━━━╯",
  ];
  ctx.api.sendMessage(lines.join("\n"), ctx.threadID, ctx.event.messageID);
}

module.exports = {
  name: "nickname",
  aliases: ["كنية", "كنيات", "nickname"],
  description: "ادارة كنيات الاعضاء وحمايتها",
  run(args, ctx) {
    if (!ensureAdmin(ctx)) return;
    const sub = (args[0] || "").trim();
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
          [
            "〔 اوامر الكنيات 〕",
            "• كنية تعيين <نص> — تعيين للجميع",
            "• كنية فرد <نص> — تعيين لفرد (بالرد او منشن)",
            "• كنية قفل — حماية من التغيير",
            "• كنية فتح — الغاء الحماية",
            "• كنية ازالة — مسح كل الكنيات",
            "• كنية حالة — عرض الحالة",
          ].join("\n"),
          ctx.threadID,
          ctx.event.messageID
        );
    }
  },
};
