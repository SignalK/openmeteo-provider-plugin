import { OpenMeteoProviderApp } from '..'
import { OpenMeteo } from './openmeteo'
import { Position } from '@signalk/server-api'

/**
 * @todo remove reference to mock-weather-api
 */
import {
  WeatherData,
  WeatherForecastType,
  WeatherReqParams
} from '../lib/mock-weather-api'
// *************************************************

export interface WEATHER_CONFIG {
  apiKey: string
}

const weatherServiceName = 'OpenMeteo'

let server: OpenMeteoProviderApp
let pluginId: string
let weatherService: OpenMeteo

const providerRegistration = {
  name: weatherServiceName,
  methods: {
    getObservations: (position: Position, options?: WeatherReqParams) => {
      return getObservationData(position, options)
    },
    getForecasts: (
      position: Position,
      type: WeatherForecastType,
      options?: WeatherReqParams
    ) => {
      return getForecastData(position, type, options)
    },
    getWarnings: () => {
      throw new Error('open-meteo')
    }
  }
}

export const getObservationData = async (
  position: Position,
  options?: WeatherReqParams
): Promise<WeatherData[]> => {
  try {
    const r = await weatherService.fetchObservations(position, options)
    return r
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new Error('Error fetching observation data from provider!')
  }
}

export const getForecastData = async (
  position: Position,
  type: WeatherForecastType,
  options?: WeatherReqParams
): Promise<WeatherData[]> => {
  try {
    const r = await weatherService.fetchForecasts(position, type, options)
    return r
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new Error('Error fetching observation data from provider!')
  }
}

export const initWeather = (
  app: OpenMeteoProviderApp,
  id: string,
  config: WEATHER_CONFIG
) => {
  server = app
  pluginId = id

  server.debug(`*** Weather: settings: ${JSON.stringify(config)}`)
  server.registerWeatherProvider(providerRegistration)
  weatherService = new OpenMeteo(config)
}

export const stopWeather = () => {
  server.debug('** Stopping **')
}
