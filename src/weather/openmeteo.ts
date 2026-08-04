// OpenMedia

import {
  Position,
  WeatherData,
  WeatherForecastType,
  WeatherReqParams
} from '@signalk/server-api'
import { Convert } from '../lib/convert'

import { WEATHER_CONFIG } from './weather-service'

interface CacheEntry {
  data: OMServiceResponse
  timestamp: number
}

interface OMServiceResponse {
  latitude: number
  longitude: number
  timezone: string
  elevation: number
  current_units: {
    time: string
    interval: number
    temperature_2m: string
    relative_humidity_2m: string
    apparent_temperature: string
    pressure_msl: string
    cloud_cover: string
    wind_speed_10m: string
    wind_direction_10m: string
    wind_gusts_10m: string
    precipitation: string
    isDay: string
    rain: string
    showers: string
    snowfall: string
    weather_code: string
    surface_pressure: string
  }
  current: {
    time: number
    interval: number
    temperature_2m: number
    relative_humidity_2m: number
    apparent_temperature: number
    pressure_msl: number
    cloud_cover: number
    wind_speed_10m: number
    wind_direction_10m: number
    wind_gusts_10m: number
    precipitation: number
    isDay: number
    rain: number
    showers: number
    snowfall: number
    weather_code: number
    surface_pressure: number
  }
  hourly_units: {
    time: string
    temperature_2m: string
    relative_humidity_2m: string
    dew_point_2m: string
    apparent_temperature: string
    pressure_msl: string
    cloud_cover: string
    wind_speed_10m: string
    wind_direction_10m: string
    wind_gusts_10m: string
    precipitation: string
    visibility: string
    weather_code: string
  }
  hourly: {
    time: number[]
    temperature_2m: Array<number>
    relative_humidity_2m: Array<number>
    dew_point_2m: Array<number>
    apparent_temperature: Array<number>
    pressure_msl: Array<number>
    cloud_cover: Array<number>
    wind_speed_10m: Array<number>
    wind_direction_10m: Array<number>
    wind_gusts_10m: Array<number>
    precipitation: Array<number>
    visibility: Array<number>
    swell_wave_height: Array<number>
    swell_wave_direction: Array<number>
    swell_wave_period: Array<number>
    wave_height: Array<number>
    wave_direction: Array<number>
    wave_period: Array<number>
    weather_code: Array<number>
  }
  daily_units: {
    time: string
    temperature_2m_min: string
    temperature_2m_max: string
    sunrise: string
    sunset: string
    daylight_duration: string
    uv_index_max: string
    uv_index_clear_sky_max: string
    weather_code: string
    wind_speed_10m_max: string
    wind_direction_10m_dominant: string
    wind_gusts_10m_max: string
  }
  daily: {
    time: number[]
    temperature_2m_min: Array<number>
    temperature_2m_max: Array<number>
    sunrise: Array<number>
    sunset: Array<number>
    daylight_duration: Array<number>
    uv_index_max: Array<number>
    uv_index_clear_sky_max: Array<number>
    weather_code: Array<number>
    wind_speed_10m_max: Array<number>
    wind_direction_10m_dominant: Array<number>
    wind_gusts_10m_max: Array<number>
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WMO_CODE: any = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Drizzle: Light',
  53: 'Drizzle: Moderate',
  55: 'Drizzle: Dense intensity',
  56: 'Freezing Drizzle: Light',
  57: 'Freezing Drizzle: Dense intensity',
  61: 'Rain: Slight',
  63: 'Rain: Moderate',
  65: 'Rain: Heavy intensity',
  66: 'Freezing Rain: Light',
  67: 'Freezing Rain: Heavy intensity',
  71: 'Snow fall: Slight',
  73: 'Snow fall: Moderate',
  75: 'Snow fall: Heavy intensity',
  77: 'Snow grains',
  80: 'Rain showers: Slight',
  81: 'Rain showers: Moderate',
  82: 'Rain showers: Violent',
  85: 'Snow showers: Slight',
  86: 'Snow showers  Heavy',
  95: 'Thunderstorm: Slight or moderate',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
}

export class OpenMeteo {
  private settings: WEATHER_CONFIG
  private precision = 5 // geohash precision (5x5 km)
  private cache: Map<string, CacheEntry> = new Map()
  private cacheTTL: number // milliseconds

  constructor(config: WEATHER_CONFIG) {
    this.settings = config
    this.cacheTTL = (config.cacheTTL ?? 10) * 60 * 1000 // default 10 minutes
  }

  private getCacheKey(
    position: Position,
    type: string,
    maxCount?: number
  ): string {
    const hash = Convert.geohash(
      position.latitude,
      position.longitude,
      this.precision
    )
    return `${hash}:${type}:${maxCount ?? 'default'}`
  }

  private getFromCache(key: string): OMServiceResponse | null {
    const entry = this.cache.get(key)
    if (entry && Date.now() - entry.timestamp < this.cacheTTL) {
      return entry.data
    }
    if (entry) {
      this.cache.delete(key) // expired
    }
    return null
  }

  private setCache(key: string, data: OMServiceResponse): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  private getApiKeyParam(): string {
    return this.settings.apiKey ? `&apikey=${this.settings.apiKey}` : ''
  }

  private getMarineUrl(position: Position, options?: WeatherReqParams): string {
    if (!position) {
      return ''
    }

    const params = [
      'wave_height',
      'wave_direction',
      'wave_period',
      'swell_wave_height',
      'swell_wave_direction',
      'swell_wave_period',
      'swell_wave_peak_period'
    ]

    // Default matches the hourly forecast horizon (getUrl) so waves cover the
    // same hours rather than truncating to the marine API's shorter default.
    const forecastPeriod = `&forecast_hours=${options?.maxCount ?? 24}`
    const urlParam = `&hourly=${params.toString()}${forecastPeriod}`
    const pos = `&latitude=${position.latitude}&longitude=${position.longitude}`
    const url = `https://marine-api.open-meteo.com/v1/marine?timeformat=unixtime&wind_speed_unit=ms`
    return `${url}${pos}${urlParam}${this.getApiKeyParam()}`
  }

  private getUrl(
    position: Position,
    type?: 'daily' | 'hourly' | 'current',
    options?: WeatherReqParams
  ): string {
    if (!position) {
      return ''
    }
    const params = {
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'pressure_msl',
        'cloud_cover',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'precipitation',
        'is_day',
        'precipitation',
        'rain',
        'showers',
        'snowfall',
        'weather_code',
        'surface_pressure'
      ],
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'dew_point_2m',
        'apparent_temperature',
        'pressure_msl',
        'cloud_cover',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'precipitation',
        'visibility',
        'weather_code'
      ],
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'daylight_duration',
        'sunshine_duration',
        'uv_index_max',
        'uv_index_clear_sky_max',
        'weather_code',
        'wind_speed_10m_max',
        'wind_direction_10m_dominant',
        'wind_gusts_10m_max'
      ]
    }

    let forecastPeriod = ''
    if (type === 'hourly') {
      forecastPeriod = `&forecast_hours=${options?.maxCount ?? 24}`
    } else if (type === 'daily') {
      forecastPeriod = `&forecast_days=${options?.maxCount ?? 5}`
    }
    const pos = `&latitude=${position.latitude}&longitude=${position.longitude}`
    const url = `https://api.open-meteo.com/v1/forecast?timeformat=unixtime&cell_selection=sea&wind_speed_unit=ms`
    let urlParam: string

    if (type === 'current') {
      urlParam = `&current=${params[type].toString()}`
    } else if (type === 'hourly') {
      urlParam = `&hourly=${params[type].toString()}${forecastPeriod}`
    } else if (type === 'daily') {
      urlParam = `&daily=${params[type].toString()}${forecastPeriod}`
    } else {
      urlParam = `&hourly=${params['hourly'].toString()}&daily=${params[
        'daily'
      ].toString()}&current=${params['current'].toString()}${forecastPeriod}`
    }
    return `${url}${pos}${urlParam}${this.getApiKeyParam()}`
  }

  /**
   * Fetch weather data from the weather service.
   *  @params position: {latitude, longitude}
   */
  private fetchFromService = async (
    url: string
  ): Promise<OMServiceResponse> => {
    let forecastRes!: OMServiceResponse
    try {
      const res = await fetch(url)

      forecastRes = await res.json()

      /*url = this.getUrl(position, 'marine')
      res = await fetch(url)
      const marineRes = await res.json()

      const h = Object.assign({}, forecastRes.hourly, marineRes.hourly)
      const hu = Object.assign(
        {},
        forecastRes.hourly_units,
        marineRes.hourly_units
      )*/

      //forecastRes.hourly_units = hu
      //forecastRes.hourly = h
      return forecastRes
    } catch (err) {
      console.log('** open-meteo fetch error!', err)
      return forecastRes
    }
  }

  /**
   * Fetch weather data for provided Position. Returns data in cache if present.
   *  @params position: {latitude, longitude}
   *  @params options query options
   */
  fetchObservations = async (
    position: Position,
    options?: WeatherReqParams
  ): Promise<WeatherData[]> => {
    try {
      const cacheKey = this.getCacheKey(position, 'current', options?.maxCount)
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return this.parseCurrent(cached)
      }

      const url = this.getUrl(position, 'current', options)
      const wData = await this.fetchFromService(url)
      if (wData) {
        this.setCache(cacheKey, wData)
      }
      return this.parseCurrent(wData)
    } catch {
      throw new Error(`fetching / parsing weather data!`)
    }
  }

  /**
   * Fetch weather data for provided Position. Returns data in cache if present.
   *  @params position: {latitude, longitude}
   *  @params type: forecast type
   *  @params options query options
   */
  fetchForecasts = async (
    position: Position,
    type: WeatherForecastType,
    options?: WeatherReqParams
  ): Promise<WeatherData[]> => {
    const omType = type === 'point' ? 'hourly' : 'daily'
    try {
      const cacheKey = this.getCacheKey(position, omType, options?.maxCount)
      let wData = this.getFromCache(cacheKey)

      if (!wData) {
        const url = this.getUrl(position, omType, options)
        wData = await this.fetchFromService(url)

        // Open-Meteo serves waves / swell from a separate marine API, so merge the
        // marine hourly series into the forecast response and parseForecasts can
        // then populate water.*. Hourly ('point') forecasts only. Marine data is
        // optional: a marine failure must not drop the atmospheric forecast.
        if (wData && omType === 'hourly') {
          try {
            const marine = await this.fetchFromService(
              this.getMarineUrl(position, options)
            )
            if (marine?.hourly) {
              wData.hourly = { ...wData.hourly, ...marine.hourly }
              wData.hourly_units = {
                ...wData.hourly_units,
                ...marine.hourly_units
              }
            }
          } catch (err) {
            console.log('** open-meteo marine fetch error!', err)
          }
        }

        if (wData) {
          this.setCache(cacheKey, wData)
        }
      }

      // Open-Meteo's own daily.weather_code is a "worst hour of the day
      // wins" aggregate -- confirmed against live data to be persistently
      // gloomier than e.g. the Met Office's own post-processed forecast for
      // the same days. Blend a better per-day symbol from the full 24h of
      // the hourly series instead -- see computeDailyModeCodes() (day, not
      // just daylight: overnight rain/wind matters as much as daytime for
      // a boat, and the symbol set has non-sun icons for it regardless).
      // fetchHourlySeries() shares this same cache (keyed the same way a
      // direct 'point' request for the same hour count would be), so this
      // costs one extra upstream call per cacheTTL window total, not one
      // per requesting device.
      let hourlyForBlending: OMServiceResponse['hourly'] | undefined
      if (omType === 'daily' && wData?.daily?.time?.length) {
        const days = options?.maxCount ?? 5
        const hourlySeries = await this.fetchHourlySeries(position, days * 24)
        hourlyForBlending = hourlySeries?.hourly
      }

      return this.parseForecasts(wData as OMServiceResponse, hourlyForBlending)
    } catch {
      throw new Error(`fetching / parsing weather data!`)
    }
  }

  /**
   * Fetches (or reuses from cache) `hours` of hourly data for position,
   * purely to feed computeDailyModeCodes() -- deliberately shares the
   * same cache key a direct 'point' forecast request for the same hour
   * count would use, same reasoning as getCacheKey()'s own position-keyed
   * (not per-device) design: 5-6 devices on the same boat asking for a
   * daily forecast within the same cacheTTL window cost one upstream
   * Open-Meteo call for this, not one per device.
   */
  private fetchHourlySeries = async (
    position: Position,
    hours: number
  ): Promise<OMServiceResponse | undefined> => {
    const cacheKey = this.getCacheKey(position, 'hourly', hours)
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }
    const url = this.getUrl(position, 'hourly', { maxCount: hours })
    const wData = await this.fetchFromService(url)
    if (wData) {
      this.setCache(cacheKey, wData)
    }
    return wData
  }

  // A precip-type WMO code present for less than this many *consecutive*
  // hours is "showery" (case 3 below); this many or more in a row makes it
  // a "wet day" (case 4). Deliberately a run length, not a fraction of the
  // day's total precip hours (requested directly): three separate 2-hour
  // showers spread across a day reads as showery even though they'd sum to
  // 6 hours total, whereas one unbroken 6-hour band of rain reads as wet.
  private static readonly CONTINUOUS_PRECIP_RUN_HOURS = 6

  private static readonly THUNDERSTORM_CODES = new Set([95, 96, 99])

  // Rain/drizzle/freezing-rain-family and snow-family WMO codes that are
  // NOT already one of the "showers" codes (80-82, 85-86) -- i.e. Open-
  // Meteo's own hourly model called this hour's precip "continuous" rather
  // than showery. Thunderstorm (95/96/99) is deliberately excluded: it's
  // handled separately below and always wins the day regardless of how
  // many hours it covers, same as most weather apps treat storms as
  // always-notable rather than duration-gated.
  private static readonly CONTINUOUS_TO_SHOWERS_CODE: Record<number, number> =
    {
      51: 80, // Drizzle: Light -> Rain showers: Slight
      53: 80, // Drizzle: Moderate -> Rain showers: Slight
      55: 81, // Drizzle: Dense intensity -> Rain showers: Moderate
      56: 80, // Freezing Drizzle: Light -> Rain showers: Slight
      57: 81, // Freezing Drizzle: Dense intensity -> Rain showers: Moderate
      61: 80, // Rain: Slight -> Rain showers: Slight
      63: 81, // Rain: Moderate -> Rain showers: Moderate
      65: 82, // Rain: Heavy intensity -> Rain showers: Violent
      66: 80, // Freezing Rain: Light -> Rain showers: Slight
      67: 82, // Freezing Rain: Heavy intensity -> Rain showers: Violent
      71: 85, // Snow fall: Slight -> Snow showers: Slight
      73: 85, // Snow fall: Moderate -> Snow showers: Slight
      75: 86, // Snow fall: Heavy intensity -> Snow showers: Heavy
      77: 85 // Snow grains -> Snow showers: Slight
    }

  private isPrecipCode(code: number): boolean {
    return (
      code in OpenMeteo.CONTINUOUS_TO_SHOWERS_CODE ||
      [80, 81, 82, 85, 86].includes(code)
    )
  }

  /**
   * Per daily.time[i] (that day's UTC midnight -- getUrl() never sets
   * &timezone=, so Open-Meteo defaults to GMT for both the daily and
   * hourly series, keeping them on the same epoch-seconds basis here), a
   * representative weather_code for the full 24h calendar day, in place of
   * Open-Meteo's own gloomier daily.weather_code (see fetchForecasts()'s
   * own comment) -- and, critically, in place of a plain hourly mode too:
   * a straight mode of e.g. 15h overcast + 4h drizzle silently drops the
   * drizzle entirely, which matters as much as the cloud cover for a boat
   * (requested directly). Priority, per day:
   *   1. Any thunderstorm hour (95/96/99) -- always wins, worst hail
   *      severity first, regardless of how many hours it covers.
   *   2. A precip run of CONTINUOUS_PRECIP_RUN_HOURS+ consecutive hours --
   *      a genuinely wet day: the mode of just its precip-hour codes.
   *   3. Any shorter/scattered precip -- a showery day: the mode of its
   *      precip-hour codes, mapped through CONTINUOUS_TO_SHOWERS_CODE so
   *      the symbol keeps its sun (e.g. "Rain: Slight" -> "Rain showers:
   *      Slight") rather than reading as an all-day downpour.
   *   4. No precip hours at all -- the mode of the day's (sky-only) codes,
   *      same as before.
   * A day with no matching hourly samples at all (e.g. past the end of a
   * shorter hourly fetch) falls back to Open-Meteo's own daily code.
   */
  private computeDailyModeCodes(
    daily: OMServiceResponse['daily'],
    hourly: OMServiceResponse['hourly']
  ): number[] {
    const SECONDS_PER_DAY = 86400
    return daily.time.map((dayStart, i) => {
      const dayEnd = dayStart + SECONDS_PER_DAY
      const dayCodes: number[] = []
      for (let h = 0; h < hourly.time.length; h++) {
        const t = hourly.time[h]
        if (t >= dayStart && t < dayEnd) {
          dayCodes.push(hourly.weather_code[h])
        }
      }
      if (dayCodes.length === 0) {
        return daily.weather_code[i]
      }

      const stormCodes = dayCodes.filter((c) =>
        OpenMeteo.THUNDERSTORM_CODES.has(c)
      )
      if (stormCodes.length > 0) {
        return Math.max(...stormCodes) // 99 > 96 > 95: worst hail wins
      }

      const precipCodes = dayCodes.filter((c) => this.isPrecipCode(c))
      if (precipCodes.length === 0) {
        return this.modeWeatherCode(dayCodes)
      }

      const longestPrecipRun = this.longestConsecutiveRun(dayCodes, (c) =>
        this.isPrecipCode(c)
      )
      const representative = this.modeWeatherCode(precipCodes)
      return longestPrecipRun >= OpenMeteo.CONTINUOUS_PRECIP_RUN_HOURS
        ? representative
        : OpenMeteo.CONTINUOUS_TO_SHOWERS_CODE[representative] ??
            representative
    })
  }

  private longestConsecutiveRun(
    codes: number[],
    predicate: (code: number) => boolean
  ): number {
    let longest = 0
    let current = 0
    for (const code of codes) {
      current = predicate(code) ? current + 1 : 0
      longest = Math.max(longest, current)
    }
    return longest
  }

  private modeWeatherCode(codes: number[]): number {
    const counts = new Map<number, number>()
    for (const code of codes) {
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
    let best = codes[0]
    let bestCount = 0
    for (const [code, count] of counts) {
      if (count > bestCount || (count === bestCount && code < best)) {
        best = code
        bestCount = count
      }
    }
    return best
  }

  private parseCurrent(omData: OMServiceResponse): WeatherData[] {
    const data: WeatherData[] = []

    if (omData && typeof omData.current.time !== 'undefined') {
      const observations = omData.current
      const obs: WeatherData = {
        date: new Date(Convert.fromUnixTime(observations.time)).toISOString(),
        description:
          observations.weather_code !== undefined
            ? WMO_CODE[observations.weather_code] ?? ''
            : '',
        type: 'observation',
        outside: {
          feelsLikeTemperature:
            Convert.celciusToKelvin(observations.apparent_temperature) ?? null,
          temperature:
            Convert.celciusToKelvin(observations.temperature_2m) ?? null,
          cloudCover: Convert.toRatio(observations.cloud_cover) ?? null,
          pressure: Convert.hPaToPa(observations.pressure_msl) ?? null,
          relativeHumidity:
            Convert.toRatio(observations.relative_humidity_2m) ?? null,
          precipitationType: 'rain',
          precipitationVolume: Convert.mmToM(observations.rain) ?? null
        },
        wind: {
          speedTrue: observations.wind_speed_10m ?? null,
          directionTrue:
            Convert.degreesToRadians(observations.wind_direction_10m) ?? null,
          gust: observations.wind_gusts_10m ?? null
        }
      }
      data.push(obs)
    }

    return data
  }

  private parseForecasts(
    omData: OMServiceResponse,
    hourlyForBlending?: OMServiceResponse['hourly']
  ): WeatherData[] {
    const data: WeatherData[] = []
    if (omData && omData.hourly?.time && Array.isArray(omData.hourly.time)) {
      const forecasts = omData.hourly
      for (let i = 0; i < forecasts.time.length; ++i) {
        const forecast: WeatherData = {
          date: new Date(Convert.fromUnixTime(forecasts.time[i])).toISOString(),
          type: 'point',
          description:
            forecasts.weather_code[i] !== undefined
              ? WMO_CODE[forecasts.weather_code[i]] ?? ''
              : '',
          outside: {
            feelsLikeTemperature:
              Convert.celciusToKelvin(forecasts.apparent_temperature[i]) ??
              null,
            temperature:
              Convert.celciusToKelvin(forecasts.temperature_2m[i]) ?? null,
            dewPointTemperature:
              Convert.celciusToKelvin(forecasts.dew_point_2m[i]) ?? null,
            cloudCover: Convert.toRatio(forecasts.cloud_cover[i]) ?? null,
            pressure: Convert.hPaToPa(forecasts.pressure_msl[i]) ?? null,
            absoluteHumidity:
              Convert.toRatio(forecasts.relative_humidity_2m[i]) ?? null,
            horizontalVisibility: forecasts.visibility[i] ?? null
          },
          // Populated when the marine series was merged in (fetchForecasts);
          // omitted otherwise. Periods are seconds (SI), directions radians.
          water: forecasts.wave_height
            ? {
                waveSignificantHeight: forecasts.wave_height?.[i] ?? null,
                waveDirection:
                  Convert.degreesToRadians(forecasts.wave_direction?.[i]) ??
                  null,
                wavePeriod: forecasts.wave_period?.[i] ?? null,
                swellHeight: forecasts.swell_wave_height?.[i] ?? null,
                swellDirection:
                  Convert.degreesToRadians(
                    forecasts.swell_wave_direction?.[i]
                  ) ?? null,
                swellPeriod: forecasts.swell_wave_period?.[i] ?? null
              }
            : undefined,
          wind: {
            speedTrue: forecasts.wind_speed_10m[i] ?? null,
            directionTrue:
              Convert.degreesToRadians(forecasts.wind_direction_10m[i]) ?? null,
            gust: forecasts.wind_gusts_10m[i] ?? null
          }
        }
        data.push(forecast)
      }
    }
    if (omData && omData.daily?.time && Array.isArray(omData.daily.time)) {
      const forecasts = omData.daily
      // See fetchForecasts()'s own comment: prefer the full-day mode code
      // over Open-Meteo's own (gloomier) daily aggregate whenever the
      // hourly series needed to compute it was actually available.
      const dailyCodes = hourlyForBlending
        ? this.computeDailyModeCodes(forecasts, hourlyForBlending)
        : forecasts.weather_code
      for (let i = 0; i < forecasts.time.length; ++i) {
        const forecast: WeatherData = {
          date: new Date(Convert.fromUnixTime(forecasts.time[i])).toISOString(),
          type: 'daily',
          description:
            dailyCodes[i] !== undefined ? WMO_CODE[dailyCodes[i]] ?? '' : '',
          outside: {
            minTemperature:
              Convert.celciusToKelvin(forecasts.temperature_2m_min[i]) ?? null,
            maxTemperature:
              Convert.celciusToKelvin(forecasts.temperature_2m_max[i]) ?? null,
            uvIndex: forecasts.uv_index_max[i] ?? null
          },
          wind: {
            speedTrue: forecasts.wind_speed_10m_max[i] ?? null,
            directionTrue:
              Convert.degreesToRadians(
                forecasts.wind_direction_10m_dominant[i]
              ) ?? null,
            gust: forecasts.wind_gusts_10m_max[i] ?? null
          },
          sun: {
            sunrise:
              new Date(
                Convert.fromUnixTime(forecasts.sunrise[i])
              ).toISOString() ?? null,
            sunset:
              new Date(
                Convert.fromUnixTime(forecasts.sunset[i])
              ).toISOString() ?? null
          }
        }
        data.push(forecast)
      }
    }
    return data
  }
}
