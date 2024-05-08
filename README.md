# Open-Meteo weather provider plugin for Signal K server

__Signal K server plugin for integrating the Open-Meteo weather service with Signal K server Weather API__.

_Note: This plugin will ONLY operate on a Signal K server that implements the `Weather API`! An error message will be diplayed on the server dashboard._

---
## Description

This plugin integrates with the Open-Meteo API to act as a provider for the Signal K Weather API which provides services under the path `/signalk/v2/api/weather`.

_Please see the Signal K Server Weather API documentation for details._

---
## Configuration

From the Signal K server `Admin` console:
-  Select **Server** -> **Plugin Config**

-  From the list of plugins select `Open-Meteo`  to display the details screen.

- Select the number of _Daily forecasts_ and _Hourly Point forecasts_ to retrieve from Open-Meteo.

To regularly poll Open-Meteo to fetch weather data for the vessel's current posiition:
- Check the _Poll periodically using vessel position_.

- Select the polling interval.

Optionally: you can supply an _Open-Meteo API Key_. This will, in future releases, enable "premium content" only available with a subscription to be accessed.



