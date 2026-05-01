"use strict";

const NICK_URL =
  "https://www.facebook.com/messaging/save_thread_nickname/?source=thread_settings&dpr=1";

const CALL_DELAY_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseResponseBody(res) {
  if (!res) return null;
  const statusCode = res.statusCode || res.status;
  if (statusCode && statusCode !== 200) {
    return { _httpError: statusCode };
  }
  let body = res.body != null ? res.body : res.data;
  if (body == null) return null;
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "object") return body;
  if (typeof body !== "string") return null;
  const stripped = body.replace(/^for ?\(;;\);/, "").trim();
  if (!stripped) return {};
  try {
    return JSON.parse(stripped);
  } catch (e) {
    return { _raw: stripped };
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
        if (data && data._httpError) {
          return reject(new Error(`FB رفض الطلب (HTTP ${data._httpError})`));
        }
        if (data && data.error) {
          return reject(
            new Error(data.errorSummary || data.errorDescription || `FB error ${data.error}`)
          );
        }
        resolve(data);
      })
      .catch((err) => reject(err instanceof Error ? err : new Error(String(err))));
  });
}

async function changeNicknameSafe(api, nickname, threadID, participantID) {
  try {
    await setNicknameHttp(api, nickname, threadID, participantID);
    return "http";
  } catch (httpErr) {
    if (typeof api.nickname === "function") {
      try {
        await new Promise((resolve, reject) => {
          api.nickname(nickname, threadID, participantID, (err) => {
            if (err) return reject(httpErr);
            resolve();
          });
        });
        return "mqtt";
      } catch (e) {
        throw httpErr;
      }
    }
    throw httpErr;
  }
}

async function changeNicknamesBulk(api, nickname, threadID, userIDs) {
  let ok = 0;
  let fail = 0;
  for (const uid of userIDs) {
    try {
      await changeNicknameSafe(api, nickname, threadID, uid);
      ok++;
    } catch (e) {
      fail++;
    }
    if (userIDs.indexOf(uid) < userIDs.length - 1) {
      await sleep(CALL_DELAY_MS);
    }
  }
  return { ok, fail };
}

module.exports = { changeNicknameSafe, setNicknameHttp, changeNicknamesBulk, sleep };
