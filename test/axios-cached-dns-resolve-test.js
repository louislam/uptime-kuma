/*
 * From: https://github.com/tcollinsworth/axios-cached-dns-resolve/blob/master/__tests__/test.js
 * But it converted to CommonJS
 */
const ava = require("ava");
const delay = require("delay");
const LRUCache = require("lru-cache");
const axios = require("axios");
const axiosCachingDns = require("esm")(module)("axios-cached-dns-resolve");

const test = ava.serial

let axiosClient

test.beforeEach(() => {
    axiosCachingDns.config.dnsTtlMs = 1000
    axiosCachingDns.config.dnsIdleTtlMs = 5000
    axiosCachingDns.config.cacheGraceExpireMultiplier = 2
    axiosCachingDns.config.backgroundScanMs = 100

    axiosCachingDns.cacheConfig.ttl = (axiosCachingDns.config.dnsTtlMs * axiosCachingDns.config.cacheGraceExpireMultiplier)

    axiosCachingDns.config.cache = new LRUCache(axiosCachingDns.cacheConfig)

    axiosClient = axios.create({
        timeout: 5000,
        // maxRedirects: 0,
    })

    axiosCachingDns.registerInterceptor(axiosClient)

    axiosCachingDns.startBackgroundRefresh()
    axiosCachingDns.startPeriodicCachePrune()
})

test.after.always(() => {
    axiosCachingDns.config.cache.clear()
})

test('query google with baseURL and relative url', async (t) => {
    axiosCachingDns.registerInterceptor(axios)

    const { data } = await axios.get('/finance', {
        baseURL: 'http://www.google.com',
        // headers: { Authorization: `Basic ${basicauth}` },
    })
    t.truthy(data)
    t.is(1, axiosCachingDns.getStats().dnsEntries)
    t.is(1, axiosCachingDns.getStats().misses)
})

test('query google caches and after idle delay uncached', async (t) => {
    const resp = await axiosClient.get('http://amazon.com')
    t.truthy(resp.data)
    t.truthy(axiosCachingDns.config.cache.get('amazon.com'))
    await delay(6000)
    t.falsy(axiosCachingDns.config.cache.get('amazon.com'))

    const expectedStats = {
        dnsEntries: 0,
        // refreshed: 4, variable
        hits: 0,
        misses: 2,
        idleExpired: 1,
        errors: 0,
        lastError: 0,
        lastErrorTs: 0,
    }

    const stats = axiosCachingDns.getStats()
    delete stats.refreshed
    t.deepEqual(expectedStats, stats)
})

test('query google caches and refreshes', async (t) => {
    await axiosClient.get('http://amazon.com')
    const { updatedTs } = axiosCachingDns.config.cache.get('amazon.com')
    const timeoutTime = Date.now() + 5000
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const dnsEntry = axiosCachingDns.config.cache.get('amazon.com')
        if (!dnsEntry) t.fail('dnsEntry missing or expired')
        // console.log(dnsEntry)
        if (updatedTs !== dnsEntry.updatedTs) break
        if (Date.now() > timeoutTime) t.fail()
        // eslint-disable-next-line no-await-in-loop
        await delay(10)
    }

    const expectedStats = {
        dnsEntries: 1,
        // refreshed: 5, variable
        hits: 0,
        misses: 3,
        idleExpired: 1,
        errors: 0,
        lastError: 0,
        lastErrorTs: 0,
    }

    const stats = axiosCachingDns.getStats()
    delete stats.refreshed
    t.deepEqual(expectedStats, stats)
})

test('query two services, caches and after one idle delay uncached', async (t) => {
    await axiosClient.get('http://amazon.com')

    await axiosClient.get('http://microsoft.com')
    const { lastUsedTs } = axiosCachingDns.config.cache.get('microsoft.com')
    t.is(1, axiosCachingDns.config.cache.get('microsoft.com').nextIdx)

    await axiosClient.get('http://microsoft.com')
    t.is(2, axiosCachingDns.config.cache.get('microsoft.com').nextIdx)

    t.truthy(lastUsedTs < axiosCachingDns.config.cache.get('microsoft.com').lastUsedTs)

    t.is(2, axiosCachingDns.config.cache.size)
    await axiosClient.get('http://microsoft.com')
    t.is(3, axiosCachingDns.config.cache.get('microsoft.com').nextIdx)

    t.falsy(lastUsedTs === axiosCachingDns.config.cache.get('microsoft.com').lastUsedTs)

    t.is(2, axiosCachingDns.config.cache.size)
    await delay(4000)
    t.is(1, axiosCachingDns.config.cache.size)
    await delay(2000)
    t.is(0, axiosCachingDns.config.cache.size)

    const expectedStats = {
        dnsEntries: 0,
        // refreshed: 17, variable
        hits: 2,
        misses: 5,
        idleExpired: 3,
        errors: 0,
        lastError: 0,
        lastErrorTs: 0,
    }

    const stats = axiosCachingDns.getStats()
    delete stats.refreshed
    t.deepEqual(expectedStats, stats)
})

test('validate axios config not altered', async (t) => {
    const baseURL = 'http://microsoft.com'
    const axiosConfig = { baseURL }
    const custAxiosClient = axios.create(axiosConfig)

    axiosCachingDns.registerInterceptor(custAxiosClient)

    await custAxiosClient.get('/')
    t.is(baseURL, axiosConfig.baseURL)
    await custAxiosClient.get('/')
    t.is(baseURL, axiosConfig.baseURL)
})

test('validate axios get config not altered', async (t) => {
    const url = 'http://microsoft.com'
    const custAxiosClient = axios.create()

    const reqConfig = {
        method: 'get',
        url,
    }

    axiosCachingDns.registerInterceptor(custAxiosClient)

    await custAxiosClient.get(url, reqConfig)
    t.is(url, reqConfig.url)
    await custAxiosClient.get(url, reqConfig)
    t.is(url, reqConfig.url)
})

test('validate axios request config not altered', async (t) => {
    const url = 'http://microsoft.com'
    const custAxiosClient = axios.create()

    const reqConfig = {
        method: 'get',
        url,
    }

    axiosCachingDns.registerInterceptor(custAxiosClient)

    await custAxiosClient.request(reqConfig)
    t.is(url, reqConfig.url)
    await custAxiosClient.request(reqConfig)
    t.is(url, reqConfig.url)
})
