import { SKVersion, Position } from '@signalk/server-api'
import { OpenMeteoHelperApp } from '..'
import { OpenMeteo } from './openmeteo'

//************ Signal K Weather API ****************
import { WeatherProviderData, WeatherData } from '../lib/mock-weather-api'
// *************************************************

export interface WEATHER_CONFIG {
  apiKey: string
  enable: boolean
  pollInterval: number
  forecastHours: number
  forecastDays: number
}

let server: OpenMeteoHelperApp
let pluginId: string

const wakeInterval = 60000
let lastWake: number // last wake time
let lastFetch: number // last successful fetch
let fetchInterval = 3600000 // 1hr
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let timer: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let retryTimer: any
const retry = {
  interval: 10000, // time to wait after a failed api request
  maxCount: 3, // max number of retries on failed api connection
  count: 0 // number of retries on failed api connection
}
const noPosRetry = {
  count: 0, // number of retries to attempted when no position detected
  maxCount: 12, // maximum number of retries to attempt when no position detected
  interval: 10000 // time to wait between retires when no position detected
}
let weatherService: OpenMeteo

const weatherServiceName = 'OpenMeteo'

export const WEATHER_POLL_INTERVAL = [15, 30, 60]

const providerRegistration = {
  name: weatherServiceName,
  methods: {
    getData: async (position: Position) => {
      return getWeatherData(position)
    },
    getObservations: (position: Position) => {
      return getObservationData(position)
    },
    getForecasts: (position: Position) => {
      return getForecastData(position)
    },
    getWarnings: () => {
      throw new Error('open-meteo')
    }
  }
}

export const getWeatherData = async (
  position: Position
): Promise<WeatherProviderData> => {
  try {
    return await weatherService.fetchData(position)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new Error('Error fetching data from provider!')
  }
}

export const getObservationData = async (
  position: Position
): Promise<WeatherData[]> => {
  try {
    const r = await weatherService.fetchData(position)
    return r.observations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new Error('Error fetching observation data from provider!')
  }
}

export const getForecastData = async (
  position: Position
): Promise<WeatherData[]> => {
  try {
    const r = await weatherService.fetchData(position)
    return r.forecasts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new Error('Error fetching observation data from provider!')
  }
}

export const initWeather = (
  app: OpenMeteoHelperApp,
  id: string,
  config: WEATHER_CONFIG
) => {
  server = app
  pluginId = id
  fetchInterval = (config.pollInterval ?? 60) * 60000
  if (isNaN(fetchInterval)) {
    fetchInterval = 60 * 60000
  }

  server.debug(
    `*** Weather: settings: ${JSON.stringify(
      config
    )}, fetchInterval: ${fetchInterval}`
  )

  server.registerWeatherProvider(providerRegistration)

  weatherService = new OpenMeteo(config, server.getDataDirPath())

  if (config.enable) {
    pollWeatherData()
  }
}

export const stopWeather = () => {
  if (timer) {
    clearInterval(timer)
  }
  if (retryTimer) {
    clearTimeout(retryTimer)
  }
  lastFetch = fetchInterval - 1
}

/** Fetch data at current vessel position at specified interval.*/
const pollWeatherData = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pos: any = server.getSelfPath('navigation.position')
  if (!pos) {
    server.debug(`*** Weather: No vessel position detected!`)
    if (noPosRetry.count >= noPosRetry.maxCount) {
      server.debug(
        `*** Weather: Maximum number of retries to detect vessel position!... sleeping.`
      )
      return
    }
    noPosRetry.count++
    retryTimer = setTimeout(() => {
      server.debug(
        `*** Weather: RETRY = ${noPosRetry.count} / ${noPosRetry.maxCount} after no vessel position detected!`
      )
      pollWeatherData()
    }, noPosRetry.interval)
    return
  }
  server.debug(`*** Vessel position: ${JSON.stringify(pos.value)}.`)
  noPosRetry.count = 0
  if (retryTimer) {
    clearTimeout(retryTimer)
  }
  if (lastFetch) {
    const e = Date.now() - lastFetch
    if (e < fetchInterval) {
      server.debug(
        `*** Weather: Next poll due in ${Math.round(
          (fetchInterval - e) / 60000
        )} min(s)... sleep for ${wakeInterval / 1000} secs...`
      )
      return
    }
  }
  if (retry.count < retry.maxCount) {
    retry.count++
    server.debug(
      `*** Weather: Calling service API.....(attempt: ${retry.count})`
    )

    server.debug(`Position: ${JSON.stringify(pos.value)}`)
    server.debug(`*** Weather: polling weather provider.`)
    weatherService
      .fetchData(pos.value)
      .then((data) => {
        server.debug(`*** Weather: data received....`)
        retry.count = 0
        lastFetch = Date.now()
        lastWake = Date.now()
        //weatherService.meteoData[data.id] = data
        timer = setInterval(() => {
          server.debug(`*** Weather: wake from sleep....poll provider.`)
          const dt = Date.now() - lastWake
          // check for runaway timer
          if (dt >= 50000) {
            server.debug('Wake timer watchdog -> OK')
            server.debug(`*** Weather: Polling provider.`)
          } else {
            server.debug(
              'Wake timer watchdog -> NOT OK... Stopping wake timer!'
            )
            server.debug(`Watch interval < 50 secs. (${dt / 1000} secs)`)
            clearInterval(timer)
            server.setPluginError('Weather watch timer error!')
          }
          lastWake = Date.now()
          pollWeatherData()
        }, wakeInterval)

        emitMeteoDeltas(data)
      })
      .catch((err) => {
        server.debug(
          `*** Weather: ERROR polling weather provider! (retry in ${
            retry.interval / 1000
          } sec)`
        )
        server.debug(err.message)
        // sleep and retry
        retryTimer = setTimeout(() => pollWeatherData(), retry.interval)
      })
  } else {
    // max retries. sleep and retry?
    retry.count = 0
    console.log(
      `*** Weather: Failed to fetch data after ${retry.maxCount} attempts.\nRestart ${pluginId} plugin to retry.`
    )
  }
}

const emitMeteoDeltas = (data: WeatherProviderData) => {
  const pathRoot = 'environment'
  const deltaValues = []

  server.debug('**** METEO - emit deltas*****')

  if (data && data.id && data.position) {
    deltaValues.push({
      path: 'navigation.position',
      value: data.position
    })

    const obs = data.observations
    server.debug('**** METEO *****')
    if (obs && Array.isArray(obs)) {
      server.debug('**** METEO OBS *****')
      obs.forEach((o: WeatherData) => {
        deltaValues.push({
          path: ``,
          value: { name: weatherServiceName }
        })

        if (typeof o.date !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.date`,
            value: o.date
          })
        }
        if (typeof o.outside?.horizontalVisibility !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.horizontalVisibility`,
            value: o.outside.horizontalVisibility
          })
        }
        if (typeof o.sun?.sunrise !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.sun.sunrise`,
            value: o.sun.sunrise
          })
        }
        if (typeof o.sun?.sunset !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.sun.sunset`,
            value: o.sun.sunset
          })
        }
        if (typeof o.outside?.uvIndex !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.uvIndex`,
            value: o.outside.uvIndex
          })
        }
        if (typeof o.outside?.cloudCover !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.cloudCover`,
            value: o.outside.cloudCover
          })
        }
        if (typeof o.outside?.temperature !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.temperature`,
            value: o.outside.temperature
          })
        }
        if (typeof o.outside?.dewPointTemperature !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.dewPointTemperature`,
            value: o.outside.dewPointTemperature
          })
        }
        if (typeof o.outside?.feelsLikeTemperature !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.feelsLikeTemperature`,
            value: o.outside.feelsLikeTemperature
          })
        }
        if (typeof o.outside?.pressure !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.pressure`,
            value: o.outside.pressure
          })
        }
        if (typeof o.outside?.relativeHumidity !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.relativeHumidity`,
            value: o.outside.relativeHumidity
          })
        }
        if (typeof o.outside?.absoluteHumidity !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.absoluteHumidity`,
            value: o.outside.absoluteHumidity
          })
        }
        if (typeof o.outside?.precipitationType !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.outside.precipitationType`,
            value: o.outside.precipitationType
          })
        }
        if (typeof o.wind?.speedTrue !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.wind.speedTrue`,
            value: o.wind.speedTrue
          })
        }
        if (typeof o.wind?.directionTrue !== 'undefined') {
          deltaValues.push({
            path: `${pathRoot}.wind.directionTrue`,
            value: o.wind.directionTrue
          })
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {
        values: deltaValues
      }

      server.handleMessage(
        pluginId,
        {
          context: `meteo.${weatherServiceName.toLocaleLowerCase()}`,
          updates: [updates]
        },
        SKVersion.v1
      )
    }
  }
}
