// OpenMedia

import { Position } from '@signalk/server-api'
import { Convert } from '../lib/convert'
import * as geohash from 'ngeohash'

import { WEATHER_CONFIG } from './weather-service'
import { WCache } from '../lib/cache'

//************ Signal K Weather API ****************
import { WeatherProviderData, WeatherData } from '../lib/mock-weather-api'
// *************************************************

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
  }
}

export class OpenMeteo {
  private settings: WEATHER_CONFIG
  private wcache: WCache
  private precision = 5 // geohash precision (5x5 km)

  constructor(config: WEATHER_CONFIG, path: string) {
    this.settings = config
    this.wcache = new WCache(path)
    this.wcache.maxAge = this.settings.pollInterval
  }

  private getUrl(
    position: Position,
    type: 'forecast' | 'marine' | 'current' = 'forecast'
  ): string {
    if (!position) {
      return ''
    }
    const params = {
      forecast: [
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
        'visibility'
      ],
      marine: [
        'wave_height',
        'wave_direction',
        'wave_period',
        'swell_wave_height',
        'swell_wave_direction',
        'swell_wave_period',
        'swell_wave_peak_period'
      ],
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
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'daylight_duration',
        'sunshine_duration',
        'uv_index_max',
        'uv_index_clear_sky_max'
      ]
    }

    let apiType = ''
    let apiPage = 'forecast'
    let urlParam: string
    const forecastPeriod = `&forecast_days=${this.settings.forecastDays}&forecast_hours=${this.settings.forecastHours}`
    const pos = `&latitude=${position.latitude}&longitude=${position.longitude}`

    switch (type) {
      case 'marine':
        apiType = `${type}-`
        apiPage = type
        urlParam = `&hourly=${params[type].toString()}${forecastPeriod}`
        break
      default:
        urlParam = `&hourly=${params[type].toString()}&daily=${params[
          'daily'
        ].toString()}&current=${params['current'].toString()}${forecastPeriod}`
    }

    const url = `https://${apiType}api.open-meteo.com/v1/${apiPage}?timeformat=unixtime&cell_selection=sea`

    return `${url}${pos}${urlParam}`
  }

  /**
   * Fetch weather data from the weather service.
   *  @params position: {latitude, longitude}
   */
  private fetchFromService = async (
    position: Position
  ): Promise<OMServiceResponse> => {
    let url = this.getUrl(position, 'forecast')
    let res = await fetch(url)
    const forecastRes: OMServiceResponse = await res.json()

    url = this.getUrl(position, 'marine')
    res = await fetch(url)
    const marineRes = await res.json()

    const h = Object.assign({}, forecastRes.hourly, marineRes.hourly)
    const hu = Object.assign(
      {},
      forecastRes.hourly_units,
      marineRes.hourly_units
    )

    forecastRes.hourly_units = hu
    forecastRes.hourly = h

    return forecastRes
  }

  /**
   * Fetch weather data for provided Position. Returns data in cache if present.
   *  @params position: {latitude, longitude}
   *  @params bypassCache: true = Always fetch from source (ignores the cache)
   */
  fetchData = async (
    position: Position,
    bypassCache?: boolean
  ): Promise<WeatherProviderData> => {
    let idx = !bypassCache ? this.wcache.contains(position) : undefined

    if (idx) {
      console.log(`WeatherCache hit ... returning cached data....`)
      return await this.wcache.getEntry(idx)
    } else {
      console.log('WeatherCache miss ... fetching from weather service....')
      idx = geohash.encode(
        (position as Position).latitude,
        (position as Position).longitude,
        this.precision
      )
    }

    try {
      const wData = await this.fetchFromService(position as Position)
      const wd = {
        id: idx,
        position: {
          latitude: (position as Position).latitude,
          longitude: (position as Position).longitude
        },
        observations: this.parseCurrent(wData),
        forecasts: this.parseForecasts(wData),
        warnings: []
      }
      this.wcache.setEntry(idx, wd)
      return wd
    } catch (err) {
      throw new Error(`fetching / parsing weather data!`)
    }
  }

  private parseCurrent(omData: OMServiceResponse): WeatherData[] {
    const data: WeatherData[] = []

    if (omData && typeof omData.current.time !== 'undefined') {
      const observations = omData.current
      const obs: WeatherData = {
        date: new Date(Convert.fromUnixTime(observations.time)).toISOString(),
        //description: '',
        type: 'observation',
        sun: {
          sunrise: new Date(
            Convert.fromUnixTime(omData.daily.sunrise[0])
          ).toISOString(),
          sunset: new Date(
            Convert.fromUnixTime(omData.daily.sunset[0])
          ).toISOString()
        },
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
          precipitationVolume: observations.precipitation ?? null,
          uvIndex: omData.daily.uv_index_max[0] ?? null
        },
        wind: {
          speedTrue: Convert.kmhToMsec(observations.wind_speed_10m) ?? null,
          directionTrue:
            Convert.degreesToRadians(observations.wind_direction_10m) ?? null,
          gust: Convert.kmhToMsec(observations.wind_gusts_10m) ?? null
        }
      }
      data.push(obs)
    }

    return data
  }

  private parseForecasts(omData: OMServiceResponse): WeatherData[] {
    const data: WeatherData[] = []

    if (
      omData &&
      typeof omData.hourly.time !== 'undefined' &&
      Array.isArray(omData.hourly.time)
    ) {
      const forecasts = omData.hourly
      for (let i = 0; i < forecasts.time.length; ++i) {
        const forecast: WeatherData = {
          date: new Date(Convert.fromUnixTime(forecasts.time[i])).toISOString(),
          type: 'point',
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
          water: {
            swellHeight: forecasts.swell_wave_height[i] ?? null,
            swellDirection:
              Convert.degreesToRadians(forecasts.swell_wave_direction[i]) ??
              null,
            swellPeriod: forecasts.swell_wave_period[i] * 1000 ?? null,
            waveSignificantHeight: forecasts.wave_height[i] ?? null,
            waveDirection:
              Convert.degreesToRadians(forecasts.wave_direction[i]) ?? null,
            wavePeriod: forecasts.wave_period[i] * 1000 ?? null
          },
          wind: {
            speedTrue: Convert.kmhToMsec(forecasts.wind_speed_10m[i]) ?? null,
            directionTrue:
              Convert.degreesToRadians(forecasts.wind_direction_10m[i]) ?? null,
            gust: Convert.kmhToMsec(forecasts.wind_gusts_10m[i]) ?? null
          }
        }
        data.push(forecast)
      }
    }
    if (
      omData &&
      typeof omData.daily.time !== 'undefined' &&
      Array.isArray(omData.daily.time)
    ) {
      const forecasts = omData.daily
      for (let i = 0; i < forecasts.time.length; ++i) {
        const forecast: WeatherData = {
          date: new Date(Convert.fromUnixTime(forecasts.time[i])).toISOString(),
          type: 'daily',
          outside: {
            minTemperature:
              Convert.celciusToKelvin(forecasts.temperature_2m_min[i]) ?? null,
            maxTemperature:
              Convert.celciusToKelvin(forecasts.temperature_2m_max[i]) ?? null,
            uvIndex: forecasts.uv_index_max[i] ?? null
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
