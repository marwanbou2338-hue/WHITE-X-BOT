"use strict";

const NICK_URL =
  "https://www.facebook.com/messaging/save_thread_nickname/?source=thread_settings&dpr=1";

const CALL_DELAY_MS = 500;

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
  if (body.trimStart().startsWith("<!")) {
    return { _htmlResponse: true };
  }
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
      console.error("[NICK-HTTP] defaultFuncs/ctx غير متاح");
      return reject(new Error("ws3-fca defaultFuncs/ctx غير متاح"));
    }
    const form = {
      nickname: nickname == null ? "" : String(nickname),
      participant_id: String(participantID),
      thread_or_other_fbid: String(threadID),
      source: "thread_settings",
    };
    defaultFuncs
      .post(NICK_URL, ctx.jar, form)
      .then((res) => {
        const statusCode = res && (res.statusCode || res.status);
        const data = parseResponseBody(res);
        console.log(
          `[NICK-HTTP] uid=${participantID} status=${statusCode} data=${JSON.stringify(data).slice(0, 150)}`
        );
        if (data && data._httpError) {
          return reject(new Error(`HTTP ${data._httpError}`));
        }
        if (data && data._htmlResponse) {
          return reject(new Error("FB أعاد صفحة HTML — احتمال انتهاء الجلسة"));
        }
        if (data && data._raw) {
          return reject(new Error(`FB رد غير متوقع: ${data._raw.slice(0, 80)}`));
        }
        if (data && data.error && data.error !== 0) {
          return reject(
            new Error(data.errorSummary || data.errorDescription || `FB error ${data.error}`)
          );
        }
        resolve(data);
      })
      .catch((err) => {
        console.error(`[NICK-HTTP] uid=${participantID} خطأ: ${err && err.message}`);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

function setNicknameMqtt(api, nickname, threadID, participantID) {
  return new Promise((resolve, reject) => {
    if (typeof api.nickname !== "function") {
      return reject(new Error("api.nickname غير متوفرة"));
    }
    const timer = setTimeout(() => reject(new Error("MQTT timeout")), 8000);
    try {
      api.nickname(nickname, threadID, participantID, (err) => {
        clearTimeout(timer);
        if (err) return reject(err);
        resolve();
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

async function changeNicknameSafe(api, nickname, threadID, participantID) {
  try {
    await setNicknameHttp(api, nickname, threadID, participantID);
    return "http";
  } catch (httpErr) {
    console.warn(`[NICK] HTTP فشل (${httpErr.message})، تجربة MQTT...`);
    try {
      await setNicknameMqtt(api, nickname, threadID, participantID);
      return "mqtt";
    } catch (mqttErr) {
      console.error(`[NICK] MQTT فشل أيضاً (${mqttErr.message})`);
      throw httpErr;
    }
  }
}

async function changeNicknamesBulk(api, nickname, threadID, userIDs) {
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < userIDs.length; i++) {
    const uid = userIDs[i];
    try {
      await changeNicknameSafe(api, nickname, threadID, uid);
      ok++;
    } catch (e) {
      fail++;
    }
    if (i < userIDs.length - 1) {
      await sleep(CALL_DELAY_MS);
    }
  }
  return { ok, fail };
}

module.exports = { changeNicknameSafe, setNicknameHttp, changeNicknamesBulk, sleep };
