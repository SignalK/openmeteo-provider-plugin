// *********** Delete after @signalk/server-api release ************

import { Position } from '@signalk/server-api'

export interface WeatherApi {
  register: (pluginId: string, provider: WeatherProvider) => void
  unRegister: (pluginId: string) => void
}

export interface WeatherProviderRegistry {
  /**
   * Used by _Weather Provider plugins_ to register the weather service from which the data is sourced.
   * See [`Weather Provider Plugins`](../../../docs/develop/plugins/weather_provider_plugins.md#registering-as-a-weather-provider) for details.
   *
   * @category Weather API
   */
  registerWeatherProvider: (provider: WeatherProvider) => void
}

/**
 * @hidden visible through ServerAPI
 */
export interface WeatherProviders {
  [id: string]: {
    name: string
    isDefault: boolean
  }
}

/**
 * @hidden visible through ServerAPI
 * @see {isWeatherProvider} ts-auto-guard:type-guard */
export interface WeatherProvider {
  name: string // e.g. OpenWeather, Open-Meteo, NOAA
  methods: WeatherProviderMethods
}

export interface WeatherProviderMethods {
  pluginId?: string

  getObservations: (
    position: Position,
    options?: {
      maxCount?: number
      startDate?: string
    }
  ) => Promise<WeatherData[]>

  getForecasts: (
    position: Position,
    type: WeatherForecastType,
    options?: {
      maxCount?: number
      startDate?: string
    }
  ) => Promise<WeatherData[]>

  getWarnings: (position: Position) => Promise<WeatherWarning[]>
}

export interface WeatherWarning {
  startTime: string
  endTime: string
  details: string
  source: string
  type: string
}

/**
 * @hidden visible through ServerAPI
 */
export interface WeatherReqParams {
  maxCount?: number
  startDate?: string
}

/**
 * @hidden visible through ServerAPI
 */
export type WeatherForecastType = 'daily' | 'point'
/**
 * @hidden visible through ServerAPI
 */
export type WeatherDataType = WeatherForecastType | 'observation'

// Aligned with Signal K environment specification
/**
 * @hidden visible through ServerAPI
 */
export interface WeatherData {
  description?: string
  date: string
  type: WeatherDataType // daily forecast, point-in-time forecast, observed values
  outside?: {
    minTemperature?: number
    maxTemperature?: number
    feelsLikeTemperature?: number
    precipitationVolume?: number
    absoluteHumidity?: number
    horizontalVisibility?: number
    uvIndex?: number
    cloudCover?: number
    temperature?: number
    dewPointTemperature?: number
    pressure?: number
    pressureTendency?: TendencyKind
    relativeHumidity?: number
    precipitationType?: PrecipitationKind
  }
  water?: {
    temperature?: number
    level?: number
    levelTendency?: TendencyKind
    surfaceCurrentSpeed?: number
    surfaceCurrentDirection?: number
    salinity?: number
    waveSignificantHeight?: number
    wavePeriod?: number
    waveDirection?: number
    swellHeight?: number
    swellPeriod?: number
    swellDirection?: number
  }
  wind?: {
    speedTrue?: number
    directionTrue?: number
    gust?: number
    gustDirection?: number
  }
  sun?: {
    sunrise?: string
    sunset?: string
  }
}

/**
 * @hidden visible through ServerAPI
 */
export type TendencyKind =
  | 'steady'
  | 'decreasing'
  | 'increasing'
  | 'not available'

/**
 * @hidden visible through ServerAPI
 */
export type PrecipitationKind =
  | 'reserved'
  | 'rain'
  | 'thunderstorm'
  | 'freezing rain'
  | 'mixed/ice'
  | 'snow'
  | 'reserved'
  | 'not available'
