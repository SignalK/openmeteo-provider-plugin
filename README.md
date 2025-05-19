# Open-Meteo weather provider plugin for Signal K server

__Signal K Server plugin for integrating the Open-Meteo weather service with the `Weather API`__.



## Description

This plugin is a Signal K weather provider which communicates with the Open-Meteo API to expose weather data under the path `/signalk/v2/api/weather` _(see the Signal K Server documentation for details)_.

Requests from the Signal K server, via the `Weather API`, are passed to the plugin which then retrieves the forecast and observation data from the Open-Meteo service.

**Supported Signal K Weather API options:**
- `count` Up to 16 days Forecast entries, N/A for Observations (only the most current observation is returned [count=1]). 
- `date` Not supported


## Configuration

From the Signal K server `Admin` console:
-  Select **Server** -> **Plugin Config**

-  From the list of plugins select `Open-Meteo (Weather Provider)`  to display the details screen.

- _Optional_: Enter an _Open-Meteo API Key_. This will, in future releases, enable "premium content" only available with a subscription to be accessed.


## Requirements

- Signal K Server that implements the `Weather API`.


