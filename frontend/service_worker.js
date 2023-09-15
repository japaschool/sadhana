/* Source: https://github.com/sehgalsakshi/Offline-POST-PWA---Service-Worker/tree/master */
var CACHE = {
    name: 'sadhana-pro',
    version: '-v1'
};

//TODO: 
// - cache expiry
// - use cache when server is unreachable (not just when offline). See: https://stackoverflow.com/questions/47262024/show-offline-cache-when-server-is-unreachable#47262275
// - think about cache warmup
// - offline mode banner, blah

const diaryDayPutUrlR = new RegExp('.*/api/diary/\\d{4}-\\d{2}-\\d{2}/entry');

/* Install service worker, adding all our cache entries */
self.addEventListener('install', function (e) {
    /*
    ** check network state after certain time interval
    ** If online for the first time, create an indexed db and a table
    ** If online after going offline, hit all requests saved in indexed table to server and empty the table
    */
    checkNetworkState();
    // Skip over the "waiting" lifecycle state, to ensure that our
    // new service worker is activated immediately, even if there's
    // another tab open controlled by our older service worker code.
    self.skipWaiting();
});

/* Serve cached content when offline */
self.addEventListener('fetch', event => {
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin')
        //invalid combo so just returning
        return;
    if (event.request.method === 'GET') {
        if (navigator.onLine) {
            event.respondWith(cacheRequest(event.request));
        } else {
            // console.info('Trying to fetch %s offline', event.request.url);
            var resp = fetchResponseFromCache(event.request).catch((e) => { return })
            if (resp) {
                // console.info('Got offline response  %s', resp);
                event.respondWith(resp)
            }
        }
    }
    else {
        if (!navigator.onLine && diaryDayPutUrlR.test(event.request.url)) {
            //here you can check for specific urls to be saved in indexed db
            var authHeader = event.request.headers.get('Authorization');
            var reqUrl = event.request.url;
            var method = event.request.method;
            Promise.resolve(event.request.text()).then((payload) => {
                //Update local cache
                updateDiaryDayCachedGet(reqUrl, authHeader, payload);
                //save offline requests to indexed db
                saveIntoIndexedDb(reqUrl, authHeader, method, payload)
            });
            event.respondWith(new Response('null', {
                headers: {
                    'Content-Type': 'application/json'
                },
            }))
        }
    }
});

function checkNetworkState() {
    setInterval(function () {
        if (navigator.onLine) {
            sendOfflinePostRequestsToServer()
        }
    }, 3000);
}

const fetchResponseFromCache = (request) =>
    caches.open(CACHE.name + CACHE.version).then(cache =>
        cache.match(request, { ignoreVary: true }).then(response => returnResponseFromCache(request, response, cache))
    );

const cacheRequest = request => caches.open(CACHE.name + CACHE.version).then(cache =>
    fetch(request.clone(), {
        credentials: 'same-origin'
    }).then(response =>
        cacheResponse(cache, request.clone(), response))
);

async function cacheResponse(cache, request, response) {
    var responseToCache;
    // console.info('Caching request %s', request.url);
    try {
        responseToCache = response.clone();
        cache.put(request, responseToCache);
    } catch (err) {
    }
    return response;
}

async function returnResponseFromCache(request, response, cache) {
    // console.info('Caching request %s', request.url);
    if (!!response) {
        return response;
    } else {
        // console.log(request.url + ' not yet cached!')
        return fetch(request, { credentials: 'same-origin' }).then(response => cacheResponse(cache, request, response))
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

async function sendOfflinePostRequestsToServer() {
    var request = indexedDB.open("SadhanaProPostDB");
    request.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction('postrequest', 'readwrite');
        var store = tx.objectStore('postrequest');
        var allRecords = store.getAll();
        allRecords.onsuccess = function () {
            if (allRecords.result && allRecords.result.length > 0) {
                var records = allRecords.result
                //make recursive call to hit fetch requests to server in a serial manner
                var resp = sendFetchRequestsToServer(
                    fetch(records[0].url, {
                        method: records[0].method,
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'Authorization': records[0].authHeader
                        },
                        body: records[0].payload
                    }), records[0].url, records[0].authHeader, records[0].method, records[0].payload, records.slice(1))

                for (var i = 0; i < allRecords.result.length; i++)
                    store.delete(allRecords.result[i].id)
            }
        };
    }
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
}

async function sendFetchRequestsToServer(data, reqUrl, authHeader, method, payload, records) {
    let promise = Promise.resolve(data).then((response) => {
        // console.log('Successfully sent request to server')
        if (records.length != 0) {
            sendFetchRequestsToServer(
                fetch(records[0].url, {
                    method: records[0].method,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': records[0].authHeader
                    },
                    body: records[0].payload
                }), records[0].url, records[0].authHeader, records[0].method, records[0].payload, records.slice(1))
        }
        return true
    }).catch((e) => {
        //fetch fails only in case of network error. Fetch is successful in case of any response code
        // console.log('Exception while sending post request to server' + e)
        saveIntoIndexedDb(reqUrl, authHeader, method, payload)
    })
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
    } //TODO: if not found, make a new entry based on another date's cache
    //TODO: update /incomplete-days cache 
}