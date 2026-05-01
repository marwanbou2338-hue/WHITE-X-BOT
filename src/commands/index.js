"use strict";

const commandsList = require("./commands");
const uptime = require("./uptime");
const engine = require("./engine");
const promote = require("./promote");
const demote = require("./demote");
const lock = require("./lock");
const autoreply = require("./autoreply");
const nickname = require("./nickname");
const groupname = require("./groupname");

const registry = [];

function register(cmd) {
  registry.push(cmd);
}

register(commandsList);
register(uptime);
register(engine);
register(promote);
register(demote);
register(lock);
register(autoreply);
register(nickname);
register(groupname);

function findCommand(head) {
  if (!head) return null;
  const lower = head.toLowerCase();
  for (const cmd of registry) {
    const aliases = (cmd.aliases || []).map((a) => a.toLowerCase());
    if (aliases.includes(lower)) return cmd;
  }
  return null;
}

function dispatch(head, args, ctx) {
  const cmd = findCommand(head);
  if (!cmd) return;
  try {
    cmd.run(args, ctx);
  } catch (e) {
    console.error(`[CMD:${cmd.name}] error:`, e);
    try {
      ctx.api.sendMessage(`حدث خطأ في تنفيذ الامر: ${e.message}`, ctx.threadID);
    } catch (_) {}
  }
}

function listAll() {
  return registry.slice();
}

module.exports = { dispatch, listAll };
