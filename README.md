# Open-Meteo weather provider plugin for Signal K server

__Signal K Server plugin for integrating the Open-Meteo weather service with the `Weather API`__.



## Description

This plugin communicates with the Open-Meteo API and acts as a provider for the Signal K Weather API to expose weather data under the path `/signalk/v2/api/weather` _(see the Signal K Server documentation for details)_.

Requests from the Signal K server, via the `Weather API`, are passed to the plugin which then retrieves the forecast and observation data from the Open-Meteo service.

You can select the number of daily forecasts and hourly point forecasts as well as have the plugin poll Open-Meteo at regular intervals to retrieve weather data for the vessels current location.

Weather data is accessed by making requests to the Signal K Server REST API `/signalk/v2/api/weather`.

Additionally, weather data retrieved from polling using the vessels position is available via `/signalk/v1/api/meteo/openmeteo`.


### Data Caching

Data retrieved fron the Open-Meteo service is cached to reduce the number of requests made over the Internet connection.

The cache data is refreshed when a request is received for a location within the cached area AND the age of the cached data >= `poll interval`.


## Configuration

From the Signal K server `Admin` console:
-  Select **Server** -> **Plugin Config**

-  From the list of plugins select `Open-Meteo (Weather Provider)`  to display the details screen.

- Select the number of _Daily forecasts_ to retrieve

- Select the number of _Hourly Point forecasts_ to retrieve from Open-Meteo.

- Select the polling interval. _(Note: This is also used as the maximum age for cache data.)_

- Check _Poll periodically using vessel position_ to regularly fetch weather data for the vessel's current posiition.

- _Optional_: Enter an _Open-Meteo API Key_. This will, in future releases, enable "premium content" only available with a subscription to be accessed.



## Requirements

- Signal K Server that implements the `Weather API`.


