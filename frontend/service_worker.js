// @ts-check
/// <reference lib="webworker" />

/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self);

importScripts('/precache-manifest.js');

/** @type {readonly string[]} */
const PRECACHE_MANIFEST = /** @type {any} */ (self).__PRECACHE_MANIFEST__;

// Bump on every frontend release
const STATIC_VERSION = 'static-v2';
const CACHE_STATIC = STATIC_VERSION;

// Bump only when API schema / semantics change
const API_VERSION = 'api-v1';
const CACHE_API = API_VERSION;

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

                    // Force body download
                    const body = await resp.clone().arrayBuffer();

                    await cache.put(
                        url,
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
                const keys = await caches.keys();
                await Promise.all(
                    keys
                        .filter(k => !k.startsWith(CACHE_STATIC))
                        .map(k => caches.delete(k))
                );

                // Clear cache that has expired TTL
                await clearStaleApiCache();

                // Take control of all clients right away
                await sw.clients.claim();

                // Notify UI an update is applied
                sw.clients.matchAll({ type: 'window' }).then(clients => {
                    for (const client of clients) {
                        client.postMessage("UPDATE_READY");
                    }
                })
            })()
        );
    });

sw.addEventListener('fetch',
    /** @param {FetchEvent} event */
    event => {
        const req = event.request;
        const url = new URL(req.url);

        // CDN assets → network only
        if (url.origin !== location.origin) {
            return;
        }

        // Static precached assets
        if (PRECACHE_MANIFEST.includes(url.pathname)) {
            event.respondWith(
                caches.match(req).then(r => r || fetch(req))
            );
            return;
        }

        // API calls
        if (url.pathname.startsWith('/api/')) {
            if (event.request.method === 'GET') {
                event.respondWith(sendOfflinePostRequestsToServer().catch(console.warn).then(async () => handleApiGet(event.request)));
            } else if (event.request.method === 'PUT' && diaryDayPutUrlR.test(event.request.url)) {
                event.respondWith(handleApiPut(event));
            }
            return;
        }
    });

sw.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') {
        sw.skipWaiting();
    }
});

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

    // We run 2 timeouts here. After 3s we deem network's unavailable and resolve from cache. If cache is not available
    const timeout = new Promise(resolve => {
        setTimeout(() => {
            resolve(null);
        }, 5000);
    });

    const network = (async () => {
        try {
            const resp = await fetchWrapper(
                request.clone(),
                { credentials: 'same-origin' },
                30000
            );
            return resp;
        } catch {
            return null;
        }
    })();

    const winner = await Promise.race([network, timeout]);

    // Fast network wins
    if (winner) {
        const body = await winner.clone().arrayBuffer();

        // Fast network response — update cache and serve it
        await cache.put(
            request,
            new Response(body, {
                status: winner.status,
                statusText: winner.statusText,
                headers: winner.headers
            })
        );

        // Notify clients we're online
        broadcastOnline();

        saveDefaultDiaryDay(request.url, winner.clone());

        return winner;
    }

    // Slow network → fallback immediately
    broadcastOffline();

    const cached = await serveFromCache(cache, request).catch(() => null);
    if (cached) return cached;

    // No cache → wait for network *once*
    const finalResp = await network;
    if (finalResp) {
        broadcastOnline();
        const body = await finalResp.clone().arrayBuffer();
        await cache.put(
            request,
            new Response(body, {
                status: finalResp.status,
                statusText: finalResp.statusText,
                headers: finalResp.headers
            })
        );
        return finalResp;
    }

    throw new Error('Network failed and no cache available');
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
 * @param {string} url
 * @param {string | null} authHeader
 * @param {string} method
 * @param {string} payload
 */
function saveIntoIndexedDb(url, authHeader, method, payload) {
    var myRequest = {};
    const jsonPayLoad = JSON.parse(payload)
    //add payload if required. If not skip parsing json and stringifying it again
    //jsonPayLoad['eventTime'] = getCurrentTimeString(eventTime)
    myRequest.url = url;
    myRequest.method = method;
    myRequest.authHeader = authHeader;
    myRequest.payload = JSON.stringify(jsonPayLoad);
    var request = indexedDB.open("SadhanaProPostDB");
    request.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction('postrequest', 'readwrite');
        var store = tx.objectStore('postrequest');
        store.add(myRequest)
    }
}

/**
 * @param {any} id
 */
function deleteFromIndexedDb(id) {
    var request = indexedDB.open("SadhanaProPostDB");
    request.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction('postrequest', 'readwrite');
        var store = tx.objectStore('postrequest');
        store.delete(id)
    }
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
 * @returns {Promise<void>}
 */
async function sendOfflinePostRequestsToServer() {
    return new Promise((yes, no) => {
        var request = indexedDB.open("SadhanaProPostDB");
        request.onupgradeneeded = event => {
            var db = event.target.result;
            db.onerror = event => {
                console.log("Why didn't you allow my web app to use IndexedDB?!");
            };

            var objectStore;
            if (!db.objectStoreNames.contains('postrequest')) {
                objectStore = db.createObjectStore("postrequest", { keyPath: 'id', autoIncrement: true });
            }
            else {
                objectStore = db.objectStoreNames.get('postrequest');
            }
        }
        request.onsuccess = function (event) {
            var db = event.target.result;
            var tx = db.transaction('postrequest', 'readwrite');
            var store = tx.objectStore('postrequest');
            var allRecords = store.getAll();

            allRecords.onsuccess = () => {
                if (allRecords.result && allRecords.result.length > 0) {
                    const postPromises = allRecords.result.map(async record =>
                        fetchWrapper(
                            record.url,
                            {
                                method: record.method,
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                    'Authorization': record.authHeader
                                },
                                body: record.payload
                            },
                            10000
                        )
                            .then(() => deleteFromIndexedDb(record.id))
                    );

                    sequencePromises(postPromises)
                        .then(() => yes())
                        .catch(err => {
                            console.warn('Failed to post offline writes', err);
                            no();
                        });
                } else {
                    yes();
                }
            };
        }
    });
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
async function fetchWrapper(req, opts, timeout) {
    const resp = timeout
        ? await fetchWithTimeout(req, opts, timeout)
        : await fetch(req, opts);
    if (resp.status === 504) {
        throw new Error('Server unavailable');
    }
    return resp;
}

/**
 * Fetch with timeout that aborts the request after timeout
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

    let timeoutId;

    timeoutId = setTimeout(() => {
        controller.abort(); // Abort only if response headers didn't arrive in time
    }, timeout);

    const fetchPromise = fetch(resource, fetchOptions)
        .catch(err => {
            clearTimeout(timeoutId);
            throw err;
        })
        .then(response => {
            clearTimeout(timeoutId); // Response arrived — clear the timeout
            return response;         // let response.body stream continue
        });

    return fetchPromise;
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