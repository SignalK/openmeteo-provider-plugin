import { describe, it, expect } from 'vitest'
import { Convert } from '../src/lib/convert'

describe('Convert — SI unit conversions (Signal K expects SI)', () => {
  it('converts °C to Kelvin', () => {
    expect(Convert.celciusToKelvin(0)).toBe(273.15)
    expect(Convert.celciusToKelvin(-273.15)).toBe(0)
  })

  it('converts km/h to m/s', () => {
    expect(Convert.kmhToMsec(36)).toBe(10)
    expect(Convert.kmhToMsec(0)).toBe(0)
  })

  it('converts hPa to Pa', () => {
    expect(Convert.hPaToPa(1013.25)).toBe(101325)
  })

  it('converts mm to m', () => {
    expect(Convert.mmToM(5)).toBe(0.005)
  })

  it('converts a percentage to a 0–1 ratio', () => {
    expect(Convert.toRatio(50)).toBe(0.5)
    expect(Convert.toRatio(100)).toBe(1)
  })

  it('converts unix seconds to milliseconds', () => {
    expect(Convert.fromUnixTime(1_700_000_000)).toBe(1_700_000_000_000)
  })

  it('round-trips degrees ↔ radians', () => {
    expect(Convert.degreesToRadians(180)).toBeCloseTo(Math.PI, 12)
    expect(Convert.radiansToDegrees(Math.PI)).toBeCloseTo(180, 12)
  })
})

describe('Convert.geohash — used for the forecast cache key', () => {
  it('matches the canonical reference geohash', () => {
    // Wikipedia reference point (57.64911, 10.40744)
    expect(Convert.geohash(57.64911, 10.40744, 12)).toBe('u4pruydqqvj8')
  })

  it('honours the requested precision (default 5)', () => {
    expect(Convert.geohash(57.64911, 10.40744, 5)).toBe('u4pru')
    expect(Convert.geohash(57.64911, 10.40744)).toBe('u4pru')
  })

  it('buckets nearby positions to the same key and separates distant ones', () => {
    // precision 5 (the cache default) ≈ 5x5 km cells
    const a = Convert.geohash(48.76, -123.0, 5) // c28t3
    const nearby = Convert.geohash(48.762, -123.001, 5) // ~250 m away
    const far = Convert.geohash(37.8, -122.4, 5) // San Francisco
    expect(a).toBe('c28t3')
    expect(nearby).toBe(a)
    expect(far).not.toBe(a)
  })
})
