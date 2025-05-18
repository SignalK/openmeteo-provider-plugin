import { Plugin, ServerAPI } from '@signalk/server-api'
import { Application } from 'express'

import {
  WEATHER_CONFIG,
  initWeather,
  stopWeather
} from './weather/weather-service'

/**
 * @todo remove reference to mock-weather-api
 */
import { WeatherProviderRegistry } from './lib/mock-weather-api'
// *************************************************

const CONFIG_SCHEMA = {
  properties: {
    weather: {
      title: 'Open-Meteo',
      type: 'object',
      description: 'Weather service settings.',
      properties: {
        apiKey: {
          type: 'string',
          title: 'API Key (optional)',
          default: '',
          description: 'Get your API key at https://open-meteo.org'
        }
      }
    }
  }
}

const CONFIG_UISCHEMA = {
  weather: {
    apiKey: {
      'ui:disabled': false,
      'ui-help': ''
    }
  }
}

interface SETTINGS {
  weather: WEATHER_CONFIG
}

export interface OpenMeteoProviderApp
  extends Application,
    ServerAPI,
    WeatherProviderRegistry {}

module.exports = (server: OpenMeteoProviderApp): Plugin => {
  // ** default configuration settings
  let settings: SETTINGS = {
    weather: {
      apiKey: ''
    }
  }

  // ******** REQUIRED PLUGIN DEFINITION *******
  const plugin: Plugin = {
    id: 'open-meteo',
    name: 'Open-Meteo (Weather Provider)',
    schema: () => CONFIG_SCHEMA,
    uiSchema: () => CONFIG_UISCHEMA,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    start: (settings: any) => {
      doStartup(settings)
    },
    stop: () => {
      doShutdown()
    }
  }
  // ************************************

  const doStartup = (options: SETTINGS) => {
    try {
      server.debug(`${plugin.name} starting.......`)

      if (typeof server.registerWeatherProvider !== 'function') {
        throw new Error(
          'Weather API is not available! Server upgrade required.'
        )
      }

      if (typeof options !== 'undefined') {
        settings = options
      }

      settings.weather = options.weather ?? {
        apiKey: ''
      }
      settings.weather.apiKey = options.weather.apiKey ?? ''

      server.debug(`Applied config: ${JSON.stringify(settings)}`)

      initWeather(server, plugin.id, settings.weather)

      server.setPluginStatus(`Started`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const msg = 'Started with errors!'
      server.setPluginError(error.message ?? msg)
      server.error('** EXCEPTION: **')
      server.error(error.stack)
      return error
    }
  }

  const doShutdown = () => {
    server.debug('** shutting down **')
    stopWeather()
    server.debug('** Un-subscribing from events **')
    const msg = 'Stopped'
    server.setPluginStatus(msg)
  }

  return plugin
}
