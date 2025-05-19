// OpenMedia

import { Position } from '@signalk/server-api'
import { Convert } from '../lib/convert'

import { WEATHER_CONFIG } from './weather-service'

/**
 * @todo remove reference to mock-weather-api
 */
import {
  WeatherData,
  WeatherForecastType,
  WeatherReqParams
} from '../lib/mock-weather-api'
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

  constructor(config: WEATHER_CONFIG) {
    this.settings = config
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

    const forecastPeriod = `&forecast_hours=${options?.maxCount ?? 8}` //&forecast_days=${options?.maxCount ?? 5}`
    const urlParam = `&hourly=${params.toString()}${forecastPeriod}`
    const pos = `&latitude=${position.latitude}&longitude=${position.longitude}`
    const url = `https://marine-api.open-meteo.com/v1/marine?timeformat=unixtime&wind_speed_unit=ms`
    return `${url}${pos}${urlParam}`
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

    const forecastPeriod = `&forecast_days=${
      options?.maxCount ?? 5
    }&forecast_hours=${options?.maxCount ?? 8}`
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
    return `${url}${pos}${urlParam}`
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
      //const murl = this.getMarineUrl(position, options)
      //const mData = await this.fetchFromService(murl)
      const url = this.getUrl(position, 'current', options)
      const wData = await this.fetchFromService(url)
      return this.parseCurrent(wData)
    } catch (err) {
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
      const url = this.getUrl(position, omType, options)
      const wData = await this.fetchFromService(url)
      return this.parseForecasts(wData)
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
        description: observations.weather_code
          ? WMO_CODE[observations.weather_code]
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
          precipitationVolume: observations.rain ?? null
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

  private parseForecasts(omData: OMServiceResponse): WeatherData[] {
    const data: WeatherData[] = []
    if (omData && omData.hourly?.time && Array.isArray(omData.hourly.time)) {
      const forecasts = omData.hourly
      for (let i = 0; i < forecasts.time.length; ++i) {
        const forecast: WeatherData = {
          date: new Date(Convert.fromUnixTime(forecasts.time[i])).toISOString(),
          type: 'point',
          description: forecasts.weather_code[i]
            ? WMO_CODE[forecasts.weather_code[i]]
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
          /*water: {
            swellHeight: forecasts.swell_wave_height[i] ?? null,
            swellDirection:
              Convert.degreesToRadians(forecasts.swell_wave_direction[i]) ??
              null,
            swellPeriod: forecasts.swell_wave_period[i]
              ? forecasts.swell_wave_period[i] * 1000
              : undefined,
            waveSignificantHeight: forecasts.wave_height[i] ?? null,
            waveDirection:
              Convert.degreesToRadians(forecasts.wave_direction[i]) ?? null,
            wavePeriod: forecasts.wave_period[i]
              ? forecasts.wave_period[i] * 1000
              : undefined
          },*/
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
      for (let i = 0; i < forecasts.time.length; ++i) {
        const forecast: WeatherData = {
          date: new Date(Convert.fromUnixTime(forecasts.time[i])).toISOString(),
          type: 'daily',
          description: forecasts.weather_code[i]
            ? WMO_CODE[forecasts.weather_code[i]]
            : '',
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
