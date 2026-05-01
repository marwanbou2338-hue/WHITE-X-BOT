"use strict";

const NICK_URL =
  "https://www.facebook.com/messaging/save_thread_nickname/?source=thread_settings&dpr=1";

function parseResponseBody(res) {
  if (!res || res.body == null) return null;
  let body = res.body;
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "object") return body;
  if (typeof body !== "string") return null;
  const stripped = body.replace(/^for ?\(;;\);/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch (e) {
    return { raw: stripped };
  }
}

function setNicknameHttp(api, nickname, threadID, participantID) {
  return new Promise((resolve, reject) => {
    const ctx = api.ctx;
    const defaultFuncs = api.defaultFuncs;
    if (!ctx || !defaultFuncs || typeof defaultFuncs.post !== "function") {
      return reject(new Error("ws3-fca defaultFuncs/ctx غير متاح"));
    }
    const form = {
      nickname: nickname == null ? "" : String(nickname),
      participant_id: String(participantID),
      thread_or_other_fbid: String(threadID),
    };
    defaultFuncs
      .post(NICK_URL, ctx.jar, form)
      .then((res) => {
        const data = parseResponseBody(res);
        if (data && data.error) {
          return reject(new Error(data.errorSummary || data.errorDescription || "FB error"));
        }
        resolve(data);
      })
      .catch((err) => reject(err instanceof Error ? err : new Error(String(err))));
  });
}

function changeNicknameSafe(api, nickname, threadID, participantID) {
  return new Promise((resolve, reject) => {
    setNicknameHttp(api, nickname, threadID, participantID)
      .then(() => resolve("http"))
      .catch((httpErr) => {
        if (typeof api.nickname === "function") {
          try {
            api.nickname(nickname, threadID, participantID, (err) => {
              if (err) return reject(httpErr);
              resolve("mqtt");
            });
          } catch (e) {
            reject(httpErr);
          }
        } else {
          reject(httpErr);
        }
      });
  });
}

module.exports = { changeNicknameSafe, setNicknameHttp };
