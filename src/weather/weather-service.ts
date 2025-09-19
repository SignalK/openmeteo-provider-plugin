import { OpenMeteoProviderApp } from '..'
import { OpenMeteo } from './openmeteo'
import {
  Position,
  WeatherForecastType,
  WeatherReqParams
} from '@signalk/server-api'

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
    getObservations: async (position: Position, options?: WeatherReqParams) => {
      try {
        const r = await weatherService.fetchObservations(position, options)
        return r
      } catch (err) {
        throw new Error('Error fetching observation data from provider!')
      }
    },
    getForecasts: async (
      position: Position,
      type: WeatherForecastType,
      options?: WeatherReqParams
    ) => {
      try {
        const r = await weatherService.fetchForecasts(position, type, options)
        return r
      } catch (err) {
        throw new Error('Error fetching observation data from provider!')
      }
    },
    getWarnings: () => {
      throw new Error('open-meteo')
    }
  }
}

export const initWeather = (
  app: OpenMeteoProviderApp,
  id: string,
  config: WEATHER_CONFIG
) => {
  server = app
  pluginId = id

  server.debug(
    `*** Weather: settings: ${JSON.stringify(config)}, plugin ID: ${pluginId}`
  )
  server.registerWeatherProvider(providerRegistration)
  weatherService = new OpenMeteo(config)
}

export const stopWeather = () => {
  if (server) {
    server.debug('** Stopping **')
  }
}
