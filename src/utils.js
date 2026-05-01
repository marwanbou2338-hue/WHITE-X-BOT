"use strict";

function extractAfterTokens(raw, n) {
  if (!raw) return "";
  let i = 0;
  let count = 0;
  const len = raw.length;
  while (i < len && count < n) {
    while (i < len && /\s/.test(raw[i])) i++;
    if (i >= len) break;
    while (i < len && !/\s/.test(raw[i])) i++;
    count++;
  }
  while (i < len && /\s/.test(raw[i])) i++;
  return raw.slice(i);
}

module.exports = { extractAfterTokens };
