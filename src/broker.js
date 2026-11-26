// token broker：全局唯一持有 refresh_token 的进程，对外只发 access token。
// 挂在 /oauth 下，用每台机器独立的 Bearer token 鉴权：
//   GET  /oauth/token    按需刷新后返回 {access_token, expires_at}
//   POST /oauth/refresh  强制刷新（客户端收到 WPS 401 后调用）
//   GET  /oauth/login    发起设备码授权，返回 {url, user_code, expires_in}
//   GET  /oauth/status   {ok, expires_at, last_refresh, last_error, login_pending}
import express from "express";

export function createBrokerApp({ wps, tokens = [], scopes, onLoginRequired }) {
  const app = express();
  const byToken = new Map(tokens.map((t) => [t.token, t.name]));

  const auth = (req, res, next) => {
    const h = req.headers.authorization ?? "";
    const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
    const name = byToken.get(tok);
    if (!name) return res.status(401).type("text/plain").send("unauthorized");
    req.client = name;
    next();
  };

  const state = { lastRefresh: 0, lastError: null, login: null };
  let inflight = null;

  // 发起设备码登录（幂等：登录进行中就直接复用），成功后 token 自动生效
  const beginLogin = async () => {
    if (state.login) return state.login;
    const d = await wps.startLogin(scopes);
    const url = `${d.verification_uri}?user_code=${d.user_code}`;
    state.login = { url, startedAt: Date.now() };
    onLoginRequired?.(url);
    wps.pollLogin(d)
      .then(() => { state.lastRefresh = Date.now(); state.lastError = null; })
      .catch((e) => { state.lastError = `login: ${e.message}`; })
      .finally(() => { state.login = null; });
    return state.login;
  };

  // 互斥：并发的 /token 只触发一次刷新（refresh_token 是单次使用，抢跑会互相作废）
  const refreshOnce = () => {
    if (!inflight) {
      inflight = (async () => {
        try {
          await wps.refresh();
          state.lastRefresh = Date.now();
          state.lastError = null;
        } catch (e) {
          state.lastError = e.message;
          // 凭据失效（不是网络抖动）才自动发起重授权，避免抖动时刷屏设备码
          if (/401|invalid|expired/i.test(e.message)) beginLogin().catch(() => {});
          throw e;
        } finally {
          inflight = null;
        }
      })();
    }
    return inflight;
  };

  const payload = () => ({ access_token: wps.accessToken, expires_at: wps.expiresAt });
  const fail = (res, e) => res.status(503).type("text/plain").send(`refresh failed: ${e.message}`);

  app.get("/token", auth, async (req, res) => {
    try {
      if (!wps.accessToken || Date.now() >= wps.expiresAt) await refreshOnce();
      res.json(payload());
    } catch (e) { fail(res, e); }
  });

  app.post("/refresh", auth, async (req, res) => {
    try { await refreshOnce(); res.json(payload()); } catch (e) { fail(res, e); }
  });

  // 设备码登录：第一次调用发起，后续调用返回同一个链接；后台轮询，成功即自动生效
  app.get("/login", auth, async (req, res) => {
    try {
      const login = await beginLogin();
      res.json({ url: login.url, expires_in: 600 });
    } catch (e) { fail(res, e); }
  });

  app.get("/status", auth, (req, res) => {
    res.json({
      ok: Boolean(wps.accessToken) && Date.now() < wps.expiresAt,
      expires_at: wps.expiresAt || null,
      last_refresh: state.lastRefresh || null,
      last_error: state.lastError,
      login_pending: Boolean(state.login),
      clients: [...byToken.values()],
    });
  });

  return app;
}
