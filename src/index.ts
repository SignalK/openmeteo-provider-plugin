import { Plugin, ServerAPI } from '@signalk/server-api'
import { Application } from 'express'

import {
  WEATHER_POLL_INTERVAL,
  WEATHER_CONFIG,
  initWeather,
  stopWeather
} from './weather/weather-service'

//************ Signal K Weather API ****************
import { WeatherProviderRegistry } from './lib/mock-weather-api'
// *************************************************

const DEFAULT_POLL_INTERVAL = 60
const DEFAULT_FORECAST_HOURS = 8
const DEFAULT_FORECAST_DAYS = 1

const CONFIG_SCHEMA = {
  properties: {
    weather: {
      type: 'object',
      title: 'Weather Service.',
      description: 'Open-Meteo weather service settings.',
      properties: {
        forecastDays: {
          type: 'number',
          title: 'Number of daily forecasts',
          default: DEFAULT_FORECAST_DAYS,
          enum: [1, 2, 3, 4, 5, 6, 7],
          description: 'Select the number of daily forecasts to retrieve.'
        },
        forecastHours: {
          type: 'number',
          title: 'Number of hourly point forecasts',
          default: DEFAULT_FORECAST_HOURS,
          enum: [5, 8, 10, 15, 24, 36, 48],
          description:
            'Select the number of hourly point forecasts to retrieve.'
        },
        enable: {
          type: 'boolean',
          default: false,
          title: 'Poll periodcally using vessel position.'
        },
        pollInterval: {
          type: 'number',
          title: 'Polling Interval',
          default: 60,
          enum: WEATHER_POLL_INTERVAL,
          description:
            'Select the interval at which the weather service is polled.'
        },
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
    enable: {
      'ui:widget': 'checkbox',
      'ui:title': ' ',
      'ui:help': ' '
    },
    pollInterval: {
      'ui:widget': 'select',
      'ui:title': 'Polling Interval (mins)',
      'ui:help': ' '
    },
    apiKey: {
      'ui:disabled': false,
      'ui-help': ''
    }
  }
}

interface SETTINGS {
  weather: WEATHER_CONFIG
}

export interface OpenMeteoHelperApp
  extends Application,
    ServerAPI,
    WeatherProviderRegistry {}

module.exports = (server: OpenMeteoHelperApp): Plugin => {
  // ** default configuration settings
  let settings: SETTINGS = {
    weather: {
      enable: false,
      apiKey: '',
      pollInterval: DEFAULT_POLL_INTERVAL,
      forecastHours: 8,
      forecastDays: 1
    }
  }

  // ******** REQUIRED PLUGIN DEFINITION *******
  const plugin: Plugin = {
    id: 'open-meteo',
    name: 'Open-Meteo',
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
        enable: false,
        apiKey: '',
        pollInterval: DEFAULT_POLL_INTERVAL
      }
      settings.weather.enable = options.weather.enable ?? false
      settings.weather.apiKey = options.weather.apiKey ?? ''
      settings.weather.pollInterval =
        options.weather.pollInterval ?? DEFAULT_POLL_INTERVAL
      settings.weather.forecastHours =
        options.weather.forecastHours ?? DEFAULT_FORECAST_HOURS
      settings.weather.forecastDays =
        options.weather.forecastDays ?? DEFAULT_FORECAST_DAYS

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
