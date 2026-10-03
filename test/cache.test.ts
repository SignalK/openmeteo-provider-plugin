import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OpenMeteo } from '../src/weather/openmeteo'

const POS = { latitude: 38.98, longitude: 1.54 }

const CURRENT = {
  latitude: 39,
  longitude: 1.5,
  current: {
    time: 1790000000,
    interval: 900,
    temperature_2m: 20,
    relative_humidity_2m: 80,
    apparent_temperature: 20,
    pressure_msl: 1013,
    cloud_cover: 50,
    wind_speed_10m: 10,
    wind_direction_10m: 90,
    wind_gusts_10m: 15,
    precipitation: 0,
    weather_code: 3
  }
}

const RATE_LIMITED = {
  error: true,
  reason: 'Daily API request limit exceeded. Please try again tomorrow.'
}

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

describe('OpenMeteo request sharing and rate-limit back-off', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let om: OpenMeteo

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    fetchMock = vi.fn(async () => reply(200, CURRENT))
    vi.stubGlobal('fetch', fetchMock)
    om = new OpenMeteo({ apiKey: '', cacheTTL: 10 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('makes one upstream call for concurrent requests for the same place', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => om.fetchObservations(POS))
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results.every((r) => r.length === 1)).toBe(true)
  })

  it('still serves later requests from the cache within the TTL', async () => {
    await om.fetchObservations(POS)
    vi.advanceTimersByTime(9 * 60 * 1000)
    await om.fetchObservations(POS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('pauses upstream calls after a 429 instead of retrying every request', async () => {
    fetchMock.mockImplementation(async () => reply(429, RATE_LIMITED))
    expect(await om.fetchObservations(POS)).toEqual([])
    expect(await om.fetchObservations({ latitude: 10, longitude: 10 })).toEqual(
      []
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(OpenMeteo.MIN_PAUSE_MS + 1000)
    fetchMock.mockImplementation(async () => reply(200, CURRENT))
    expect(await om.fetchObservations(POS)).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('doubles the pause on consecutive 429s, up to the maximum', async () => {
    fetchMock.mockImplementation(async () => reply(429, RATE_LIMITED))
    await om.fetchObservations(POS) // pause 1 min
    vi.advanceTimersByTime(OpenMeteo.MIN_PAUSE_MS + 1000)
    await om.fetchObservations(POS) // pause 2 min
    vi.advanceTimersByTime(OpenMeteo.MIN_PAUSE_MS + 1000)
    await om.fetchObservations(POS) // still paused: no call
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(OpenMeteo.MIN_PAUSE_MS)
    await om.fetchObservations(POS)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('answers with the last data for a place while upstream is paused', async () => {
    const fresh = await om.fetchObservations(POS)
    vi.advanceTimersByTime(11 * 60 * 1000) // past the 10 min TTL
    fetchMock.mockImplementation(async () => reply(429, RATE_LIMITED))
    expect(await om.fetchObservations(POS)).toEqual(fresh)
    expect(await om.fetchObservations(POS)).toEqual(fresh) // paused, from cache
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops using stale data after STALE_MS', async () => {
    await om.fetchObservations(POS)
    fetchMock.mockImplementation(async () => reply(429, RATE_LIMITED))
    vi.advanceTimersByTime(OpenMeteo.STALE_MS + 1000)
    expect(await om.fetchObservations(POS)).toEqual([])
  })
})
