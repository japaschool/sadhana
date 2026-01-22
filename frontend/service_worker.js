// @ts-check
/// <reference lib="webworker" />

importScripts('/precache-manifest.js');
importScripts('/idb.js');

/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self);

// @ts-ignore
const idb = self.idb;

/** @type {readonly string[]} */
const PRECACHE_MANIFEST = /** @type {any} */ (self).__PRECACHE_MANIFEST__;

// Bump on every frontend release
const GIT_SHA = '__GIT_SHA__';
const STATIC_VERSION = 'static-v' + GIT_SHA;
const CACHE_STATIC = STATIC_VERSION;

// Bump only when API schema / semantics change
const API_VERSION = 'api-v1';
const CACHE_API = API_VERSION;

const DB_NAME = 'SadhanaProPostDB';
const DB_VERSION = 1;
const STORE_POST_REQUEST = 'postrequest';

// In flight api get fetches
const refreshing = new Map(); // url -> Promise

const diaryDayPutUrlR = new RegExp('.*/api/diary/\\d{4}-\\d{2}-\\d{2}/entry');
const diaryDayGetUrlR = new RegExp('.*/api/diary/\\d{4}-\\d{2}-\\d{2}$');
const incompleteDaysGetUrlR = new RegExp('.*/api/diary/incomplete-days/.*');
const dateR = /(\d{4}-\d{2}-\d{2})/;
const cacheTtlDays = 10;
const defaultDiaryDayKey = '/default-diary-day';

var connOnline = true;

sw.addEventListener('install',
    /** @param {ExtendableEvent} event */
    event => {
        event.waitUntil(
            (async () => {
                const cache = await caches.open(CACHE_STATIC);

                await Promise.all(PRECACHE_MANIFEST.map(async url => {
                    const resp = await fetch(url, { cache: 'no-store' });
                    const cacheKey = url === '/index.html' ? '/' : url;

                    // Force body download
                    const body = await resp.clone().arrayBuffer();

                    await cache.put(
                        cacheKey,
                        new Response(body, {
                            status: resp.status,
                            statusText: resp.statusText,
                            headers: resp.headers
                        })
                    );
                }));

                sw.skipWaiting();
            })()
        );
    });

sw.addEventListener('activate',
    /** @param {ExtendableEvent} event */
    event => {
        event.waitUntil(
            (async () => {
                // Take control of all clients right away
                await sw.clients.claim();

                // Notify UI an update is applied
                sw.clients.matchAll({ type: 'window' }).then(clients => {
                    for (const client of clients) {
                        console.debug(`Sending UPDATE_READY to ${client}`);
                        client.postMessage("UPDATE_READY");
                    }
                })
            })()
        );

        // Start cleanup in background
        setTimeout(() => {
            clearStaleCaches();
        }, 0);
    });

sw.addEventListener('fetch',
    /** @param {FetchEvent} event */
    event => {
        const req = event.request;
        const url = new URL(req.url);

        if (req.mode === 'navigate') {
            event.respondWith(
                caches.open(CACHE_STATIC)
                    .then(cache => cache.match('/'))
                    .then(r => {
                        return r || fetch(req);
                    })
            );
            return;
        }

        // CDN assets caching
        if (url.origin !== location.origin) {
            event.respondWith(
                caches.open(CACHE_STATIC)
                    .then(c => c.match(req)
                        .then(r => r || fetch(req))
                        .then(resp =>
                            c.put(req, resp.clone()).then(() => resp)
                        ))
            );
            return;
        }

        // Static pre-cached assets
        if (PRECACHE_MANIFEST.includes(url.pathname)) {
            event.respondWith(
                caches.open(CACHE_STATIC)
                    .then(cache => cache.match(req))
                    .then(r => r || fetch(req))
            );
            return;
        }

        // API calls
        if (url.pathname.startsWith('/api/')) {
            if (event.request.method === 'GET') {
                event.respondWith(
                    sendOfflinePostRequestsToServer()
                        .catch(console.warn)
                        .then(async () => handleApiGet(event.request)));
            } else if (event.request.method === 'PUT' && diaryDayPutUrlR.test(event.request.url)) {
                event.respondWith(handleApiPut(event));
            }
            return;
        }
    });

sw.addEventListener('message', event => {
    switch (event.data.type) {
        case 'CHECK_UPDATE':
            checkForUpdate(event.data.token);
            break;
        case 'SKIP_WAITING':
            sw.skipWaiting();
            break;
    }
});

async function clearStaleCaches() {
    try {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter(k => !k.startsWith(CACHE_STATIC))
                .map(k => caches.delete(k))
        );

        // Clear API cache that has expired TTL
        await clearStaleApiCache();
    } catch (err) {
        // swallow errors — never let cleanup crash the SW
        console.warn('Cache cleanup failed', err);
    }
}


/**
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
async function handleApiPut(event) {
    const authHeader = event.request.headers.get('Authorization');
    const reqUrl = event.request.url;
    const method = event.request.method;
    const payload = await event.request.clone().text();

    try {
        await updateDiaryDayCachedGet(reqUrl, authHeader, payload);
        await sendOfflinePostRequestsToServer().catch(console.warn);

        const fetchedResponse = await fetchWrapper(
            event.request,
            { credentials: 'same-origin' },
            10000
        );

        broadcastOnline();
        return fetchedResponse;
    } catch {
        broadcastOffline();
        saveIntoIndexedDb(reqUrl, authHeader, method, payload);
        return new Response('null', {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleApiGet(request) {
    const cache = await caches.open(CACHE_API);

    // Cache-only re-read from UI
    if (request.headers.get("X-Cache-Only")) {
        const cached = await cache.match(request, { ignoreVary: true });
        if (cached) return cached;
        throw new Error("Cache-only miss");
    }

    // Serve cache immediately
    const cached = await serveFromCache(cache, request).catch(() => null);
    if (cached) {
        backgroundRefreshOnce(request, cache, cached.clone());
        return cached;
    }

    console.debug(`Trying to get from server not cached ${request.url}`);
    // Cold start
    const net = await fetchWrapper(request, {}, 30000);
    const body = await net.clone().arrayBuffer();
    await cache.put(request, new Response(body, {
        status: net.status,
        statusText: net.statusText,
        headers: net.headers
    }));
    saveDefaultDiaryDay(request.url, net.clone());
    return net;
}

/**
 * @param {ArrayBuffer} buffer
 * @returns string
 */
async function sha256(buffer) {
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * @param {Request} request
 * @param {Cache} cache
 * @param {Response} cached
 */
function backgroundRefreshOnce(request, cache, cached) {
    const key = request.url;

    if (refreshing.has(key)) return;

    const p = fetchWrapper(request, {}, 5000)
        .then(async resp => {
            if (!resp.ok) return;

            const body = await resp.clone().arrayBuffer();

            await cache.put(request, new Response(body, {
                status: resp.status,
                statusText: resp.statusText,
                headers: resp.headers
            }));

            let oldHash = null;
            if (cached) {
                const cachedBody = await cached.arrayBuffer();
                oldHash = await sha256(cachedBody);
            }

            const newHash = await sha256(body);
            if (oldHash !== newHash) {
                console.debug(`Notifying clients to refresh ${key}`);
                notifyClients(key);
            }

            saveDefaultDiaryDay(key, resp.clone());
        })
        .finally(() => refreshing.delete(key));

    refreshing.set(key, p);
}

/**
 * @param {string} url
 */
function notifyClients(url) {
    sw.clients.matchAll().then(clients => {
        clients.forEach(c =>
            c.postMessage({ type: "API_UPDATED", url })
        );
    });
}

/**
 * @param {Cache} cache
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function serveFromCache(cache, request) {
    const cachedResp = await cache.match(request, { ignoreVary: true });

    if (cachedResp) {
        return cachedResp;
    }

    if (diaryDayGetUrlR.test(request.url)) {
        const defaultResp = await cache.match(defaultDiaryDayKey);

        if (!defaultResp) {
            throw new Error('Default diary day not found in cache');
        }

        cache.put(request, defaultResp.clone());

        return defaultResp;
    }

    if (incompleteDaysGetUrlR.test(request.url)) {
        return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    }

    throw new Error('Not found in cache');
}

async function clearStaleApiCache() {
    return caches.open(CACHE_API).then(cache => {
        var staleCobThreshold = new Date();
        staleCobThreshold.setDate(staleCobThreshold.getDate() - cacheTtlDays);

        cache.keys().then(reqs => reqs.forEach(req => {
            const dateStr = req.url.match(dateR);
            if (dateStr && Date.parse(dateStr[1]) < staleCobThreshold.getTime()) {
                console.log(`Deleting old api cache entry ${req.url}`);
                cache.delete(req);
            }
        }))
    });
}

const fetchResponseFromCache = /** @param {Request} request */ request =>
    caches.open(CACHE_API).then(cache =>
        cache.match(request, { ignoreVary: true })
            .then(response => returnResponseFromCache(request, response, cache))
    );


/**
 * @param {Cache} cache
 * @param {Request} request
 * @param {Response} response
 * @returns {Promise<Response>}
 */
async function cacheResponse(cache, request, response) {
    var responseToCache;
    try {
        responseToCache = response.clone();
        await cache.put(request, responseToCache);
    } catch (err) {
    }
    return response;
}

/**
 * @param {Request} request
 * @param {Response | undefined} response
 * @param {Cache} cache
 * @returns {Promise<Response>}
 */
async function returnResponseFromCache(request, response, cache) {
    if (response) {
        return response;
    } else {
        return fetchWrapper(request, { credentials: 'same-origin' })
            .then(response => cacheResponse(cache, request, response))
    }
}

/**
 * @param {Promise<any>} data
 */
async function getResponseData(data) {
    let promise = Promise.resolve(data).then((text) => {
        return text
    })
    let result = await promise;
    return result
}

/**
 * @param {Promise<any>[]} promises
 */
const sequencePromises = async promises => {
    for (const p of promises) {
        await p
    }
};

/**
 * @returns {Promise<any>}
 */
function getDb() {
    return idb.openDB(DB_NAME, DB_VERSION, {
        /** @param {any} db */
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_POST_REQUEST)) {
                db.createObjectStore(STORE_POST_REQUEST, {
                    keyPath: 'id',
                    autoIncrement: true
                });
            }
        }
    });
}

/**
 * @param {string} url
 * @param {string | null} authHeader
 * @param {string} method
 * @param {string} payload
 */
async function saveIntoIndexedDb(url, authHeader, method, payload) {
    const db = await getDb();

    const jsonPayload = JSON.parse(payload);

    const record = {
        url,
        method,
        authHeader,
        payload: JSON.stringify(jsonPayload),
    };

    await db.add(STORE_POST_REQUEST, record);
}

/**
 * @returns {Promise<void>}
 */
async function sendOfflinePostRequestsToServer() {
    const db = await getDb();
    const records = await db.getAll(STORE_POST_REQUEST);

    if (!records || records.length === 0) {
        return;
    }

    for (const record of records) {
        try {
            await fetchWrapper(
                record.url,
                {
                    method: record.method,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        ...(record.authHeader ? { Authorization: record.authHeader } : {})
                    },
                    body: record.payload
                },
                10000
            );

            await db.delete(STORE_POST_REQUEST, record.id);
        } catch (err) {
            console.warn('Failed to post offline write', err);
            throw err; // stop replay on first failure (same semantics as before)
        }
    }
}

/**
 * @typedef {Object} DiaryEntry
 * @property {string} practice
 * @property {any} value
 */

/**
 * @typedef {Object} DiaryDayResponse
 * @property {DiaryEntry[]} diary_day
 */

/**
 * @param {string} reqUrl
 * @param {string | null} authHeader
 * @param {string} payloadText
 */
async function updateDiaryDayCachedGet(reqUrl, authHeader, payloadText) {
    const getReq = new Request(reqUrl.replace('/entry', ''), {
        headers: authHeader ? { Authorization: authHeader } : undefined,
        mode: 'cors'
    });

    var resp = await fetchResponseFromCache(getReq)
    if (resp) {
        /** @type {DiaryDayResponse} */
        var respData = await getResponseData(resp.json());
        var payload = JSON.parse(payloadText);
        respData.diary_day.forEach((item, i) => {
            if (item.practice === payload.entry.practice) respData.diary_day[i] = payload.entry;
        });
        caches.open(CACHE_API).then(cache => cache.put(getReq, new Response(JSON.stringify(respData))));
    }
}

/**
 * @param {string} url
 * @param {Response} resp
 */
async function saveDefaultDiaryDay(url, resp) {
    if (diaryDayGetUrlR.test(url)) {
        return caches.open(CACHE_API)
            .then(async (cache) =>
                resp.json().then(payload => {
                    /** @type {DiaryDayResponse} */
                    const typedPayload = payload;

                    typedPayload.diary_day.forEach(entry => entry.value = null);
                    cache.put(defaultDiaryDayKey, new Response(JSON.stringify(payload)))
                })
            );
    }
}

/**
 * @param {Request} req
 * @param {RequestInit} [opts]
 * @param {number} [timeout] Timeout in ms, optional
 * @returns {Promise<Response>}
 */
async function fetchWrapper(req, opts = {}, timeout) {
    try {
        const resp = timeout
            ? await fetchWithTimeout(req, opts, timeout)
            : await fetch(req, opts);

        if (resp.status === 504) {
            throw new Error('Server unavailable');
        }

        if (resp.ok) {
            broadcastOnline();
        } else {
            broadcastOffline();
        }

        return resp;
    } catch (err) {
        broadcastOffline();
        throw err;
    }
}

/**
 * Fetch with timeout that aborts the request after timeout.
 * DO NOT USE it directly. Use fetchWrapper instead.
 *
 * @param {Request} resource
 * @param {RequestInit} options
 * @param {number} timeout
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(resource, options = {}, timeout) {
    const controller = new AbortController();
    const { signal } = controller;
    const fetchOptions = { ...options, signal };

    /** @type {ReturnType<typeof setTimeout>} */
    let timeoutId;

    const fetchPromise = fetch(resource, fetchOptions)
        .catch(err => {
            clearTimeout(timeoutId);
            throw err;
        })
        .then(response => {
            clearTimeout(timeoutId);
            return response;         // let response.body stream continue
        });

    timeoutId = setTimeout(() => {
        controller.abort(); // Abort only if response headers didn't arrive in time
    }, timeout);

    return fetchPromise;
}

/**
 * @param {string} token
 */
async function checkForUpdate(token) {
    const res = await fetchWrapper(
        new Request('/api/version', {
            headers: { Authorization: `Bearer ${token}` }
        }),
        { cache: 'no-store' },
        3000);
    const { git_sha } = await res.json();

    if (GIT_SHA !== git_sha) {
        console.log(`Downloading app update for sha ${git_sha}`);
        sw.registration.update();
    }
}


function broadcastOnline() {
    if (!connOnline) {
        sw.clients.matchAll({ includeUncontrolled: true }).then(clientsList => {
            for (const client of clientsList) {
                client.postMessage("ONLINE");
            }
        });
        connOnline = true;
    }
}

function broadcastOffline() {
    if (connOnline) {
        sw.clients.matchAll({ includeUncontrolled: true }).then(clientsList => {
            for (const client of clientsList) {
                client.postMessage("OFFLINE");
            }
        });
        connOnline = false;
    }
}