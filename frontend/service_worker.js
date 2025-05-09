/* Source: https://github.com/sehgalsakshi/Offline-POST-PWA---Service-Worker/tree/master */
var CACHE = {
    name: 'sadhana-pro',
    version: '-v1'
};

const diaryDayPutUrlR = new RegExp('.*/api/diary/\\d{4}-\\d{2}-\\d{2}/entry');
const diaryDayGetUrlR = new RegExp('.*/api/diary/\\d{4}-\\d{2}-\\d{2}$');
const incompleteDaysGetUrlR = new RegExp('.*/api/diary/incomplete-days/.*');
const dateR = /(\d{4}-\d{2}-\d{2})/;
const cacheTtlDays = 10;
const defaultDiaryDayKey = '/default-diary-day';

const connStatusBroadcast = new BroadcastChannel('ConnectionStatus');
var connOnline = true;

self.addEventListener('install', function (e) {
    console.info('Event: Install');

    // Skip over the "waiting" lifecycle state, to ensure that our
    // new service worker is activated immediately, even if there's
    // another tab open controlled by our older service worker code.
    self.skipWaiting();
});

self.addEventListener('activate', function (e) {
    console.info('Event: Activating');

    if (self.clients && clients.claim) {
        clients.claim();
    }

    clearStaleCache();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method === 'GET') {
        event.respondWith(handleGet(event.request));
    } else if (event.request.method === 'PUT' && diaryDayPutUrlR.test(event.request.url)) {
        event.respondWith(Promise.resolve().then(async () => {
            const authHeader = event.request.headers.get('Authorization');
            const reqUrl = event.request.url;
            const method = event.request.method;
            const payload = await event.request.clone().text();
            try {
                // Update local cache
                await updateDiaryDayCachedGet(reqUrl, authHeader, payload);
                // Try sending saved puts
                await sendOfflinePostRequestsToServer().catch((e) => console.error(e));
                // Try sending original put request to the server
                const fetchedResponse = await fetchWrapper(event.request, { credentials: 'same-origin' }, 10000);
                // Notify clients we're online
                broadcastOnline();
                return fetchedResponse;
            } catch {
                console.info('Saving %s into DB for later processing', event.request.url);
                // Notify clients we're offline
                broadcastOffline();
                //save offline requests to indexed db
                saveIntoIndexedDb(reqUrl, authHeader, method, payload);
                return new Response('null', { headers: { 'Content-Type': 'application/json' }, });
            }
        }));
    }
});

async function handleGet(request) {
    const cache = await caches.open(CACHE.name + CACHE.version);
    const { racePromise, fetchPromise } = fetchOrTimeout(request, 3000);

    // Wait for whichever happens first: network within 3s, or fallback to cache
    const raceResult = await racePromise.catch(() => null);

    if (raceResult) {
        // Fast network response — update cache and serve it
        cache.put(request, raceResult.clone());
        // Notify clients we're online
        broadcastOnline();
        saveDefaultDiaryDay(request.url, raceResult.clone());
        return raceResult;
    }

    console.warn(`[${request.url}] Cound not fetch from server on time. Trying to serve from cache.`);
    // Notify clients we're offline
    broadcastOffline();

    // Serve cache as fallback if network is too slow. If not cached, fallback to the original network call.
    const fallbackResponse = serveFromCache(cache, request).catch(() => {
        console.info(`[${request.url}] Could not serve from cache. Continuing with the original fetch.`);
        return fetchPromise
            .then(async (fetchedResponse) => {
                console.info(`[${request.url}] Original fetch succeeded.`);
                // Notify clients we're online
                broadcastOnline();
                return fetchedResponse;
            });
    });

    return fallbackResponse;
}

async function serveFromCache(cache, request) {
    const cachedResp = await cache.match(request, { ignoreVary: true });

    if (cachedResp) {
        return cachedResp;
    }

    if (diaryDayGetUrlR.test(request.url)) {
        const defaultResp = await cache.match(defaultDiaryDayKey);
        cache.put(request, defaultResp.clone());
        return defaultResp;
    }

    if (incompleteDaysGetUrlR.test(request.url)) {
        return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    }

    throw new Error('Not found in cache');
}

async function clearStaleCache() {
    return caches.open(CACHE.name + CACHE.version).then(cache => {
        var staleCobThreshold = new Date();
        staleCobThreshold.setDate(staleCobThreshold.getDate() - cacheTtlDays);

        cache.keys().then(reqs => reqs.forEach(req => {
            const dateStr = req.url.match(dateR);
            if (dateStr && Date.parse(dateStr[1]) < staleCobThreshold) {
                cache.delete(req);
            }
        }))
    });
}

const fetchResponseFromCache = (request) =>
    caches.open(CACHE.name + CACHE.version).then(cache =>
        cache.match(request, { ignoreVary: true }).then(response => returnResponseFromCache(request, response, cache))
    );

async function cacheResponse(cache, request, response) {
    var responseToCache;
    try {
        responseToCache = response.clone();
        cache.put(request, responseToCache);
    } catch (err) {
    }
    return response;
}

async function returnResponseFromCache(request, response, cache) {
    if (!!response) {
        return response;
    } else {
        return fetchWrapper(request, { credentials: 'same-origin' }).then(response => cacheResponse(cache, request, response))
    }
}

async function getResponseData(data) {
    let promise = Promise.resolve(data).then((text) => {
        return text
    })
    let result = await promise;
    return result
}

function saveIntoIndexedDb(url, authHeader, method, payload) {
    var myRequest = {};
    jsonPayLoad = JSON.parse(payload)
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

function deleteFromIndexedDb(id) {
    var request = indexedDB.open("SadhanaProPostDB");
    request.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction('postrequest', 'readwrite');
        var store = tx.objectStore('postrequest');
        store.delete(id)
    }
}

const sequencePromises = async (promises) => {
    for (const p of promises) {
        await p
    }
};

async function sendOfflinePostRequestsToServer() {
    return new Promise(function (yes, no) {
        // console.info('Posting offline writes to the server');
        var request = indexedDB.open("SadhanaProPostDB");
        request.onupgradeneeded = function (event) {
            var db = event.target.result;
            db.onerror = function (event) {
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
            allRecords.onsuccess = function () {
                if (allRecords.result && allRecords.result.length > 0) {
                    const postPromises = allRecords.result.map((record) =>
                        fetchWrapper(record.url, {
                            method: record.method,
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': record.authHeader
                            },
                            body: record.payload
                        }, 10000)
                            .then(() => deleteFromIndexedDb(record.id))
                    );

                    sequencePromises(postPromises).then(() => yes()).catch(err => {
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

async function updateDiaryDayCachedGet(reqUrl, authHeader, payloadText) {
    var getReq = new Request(reqUrl.replace('/entry', ''));
    getReq.mode = 'cors'
    getReq.headers = { 'Authorization': authHeader }
    var resp = await fetchResponseFromCache(getReq)
    if (resp) {
        var respData = await getResponseData(resp.json());
        var payload = JSON.parse(payloadText);
        respData.diary_day.forEach((item, i) => {
            if (item.practice === payload.entry.practice) respData.diary_day[i] = payload.entry;
        });
        caches.open(CACHE.name + CACHE.version).then(cache => cache.put(getReq, new Response(JSON.stringify(respData))));
    }
}

async function saveDefaultDiaryDay(url, resp) {
    if (diaryDayGetUrlR.test(url)) {
        return caches.open(CACHE.name + CACHE.version)
            .then(async (cache) =>
                resp.json().then(payload => {
                    payload.diary_day.forEach((entry) => entry.value = null);
                    cache.put(defaultDiaryDayKey, new Response(JSON.stringify(payload)))
                })
            );
    }
}

async function fetchWrapper(req, opts, timemout) {
    const resp = timemout
        ? await fetchWithTimeout(req, opts, timemout)
        : await fetch(req, opts);
    if (resp.status === 504) {
        throw new Error('Server unavailable');
    }
    return resp;
}

// Fetch with timeout that resolves null after timeout, but lets original fetch keep running
function fetchOrTimeout(request, timeoutMs) {
    const fetchPromise = sendOfflinePostRequestsToServer()
        .catch((e) => console.error(e))
        .then(() => fetchWrapper(request.clone(), { credentials: 'same-origin' }, 30000));

    // Return both the fetch promise and a timeout promise that resolves null after timeout
    const timeoutPromise = new Promise(resolve => {
        setTimeout(() => {
            resolve(null);
        }, timeoutMs);
    });

    return {
        racePromise: Promise.race([fetchPromise, timeoutPromise]),
        fetchPromise
    };
}

// Fetch with timeout that aborts the request after timeout
function fetchWithTimeout(resource, options = {}, timeout) {
    const controller = new AbortController();
    const { signal } = controller;
    const fetchOptions = { ...options, signal };

    let timeoutId;

    const fetchPromise = fetch(resource, fetchOptions)
        .catch(err => {
            clearTimeout(timeoutId);
            throw err;
        })
        .then(response => {
            clearTimeout(timeoutId); // Response arrived — clear the timeout
            return response;         // let response.body stream continue
        });

    timeoutId = setTimeout(() => {
        controller.abort(); // Abort only if response headers didn't arrive in time
    }, timeout);

    return fetchPromise;
}

function broadcastOffline() {
    if (connOnline) {
        console.log("We're now offline");
        connOnline = false;
    }
    // Posting offline message to clients every time
    connStatusBroadcast.postMessage({ connection_status: "OFFLINE" });
}

function broadcastOnline() {
    if (!connOnline) {
        console.log("We're now online");
        connStatusBroadcast.postMessage({ connection_status: "ONLINE" });
        connOnline = true;
    }
}