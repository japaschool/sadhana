### Context

I have a production issue affecting a Rust backend (Actix Web) running behind nginx in Docker.

The system serves a web app (WASM + API) on app.sadhana.pro. It also serves a static react website on sadhana.pro (pure nginx).

Under certain client patterns (especially iPads/iPhones (Safari) with older versions of the OS), the backend enters a temporary “stuck” state where requests time out.

Both static website and Actix Web backend get stuck at the same time, or both work.

While the app/site are timing out on older devices, they are reachable on devices (iphone, Mac) with newer versions of OS.

Moreover, If the app is timing out on an ipad and I open it up on a newer iphone, and then refresh the app in the older ipad - it gets unstuck for some time.

---

### Architecture

* Reverse proxy: nginx (no HTTP/2 currently)
* Backend: Rust (Actix Web) running in Docker (`http://sadhana:8080`)
* Clients: Safari (iPad/iPhone), desktop browsers
* Same LAN, same public IP, no CDN/proxy in front

nginx is configured to:

* disable upstream keepalive (`Connection: close`)
* short connect timeout (5s)
* recently added read/send timeouts + retry logic (improved behavior)

---

### Observed Behaviour

1. System works normally initially
2. Opening the app on an iPad triggers failures:

   * API and asset requests begin timing out
3. While in failure state:

   * curl requests also time out
   * static site is also timing out
   * multiple devices affected (shared backend state)
4. Recovery:

   * previously required a request from another client (iPhone) to “unstick”
   * after nginx changes, system now self-recovers within ~1 minute

---

### Key Properties

* Server is NOT resource constrained (low connections, low load)
* Issue is NOT IP-based blocking (other devices on same IP work)
* Issue is NOT nginx keepalive reuse (explicitly disabled)

---

### Goal

Find the most likely root cause that can explain:

> temporary global request timeouts triggered by specific client patterns, followed by spontaneous recovery

---
