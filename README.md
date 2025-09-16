# Open-Meteo weather provider plugin for Signal K server

__Signal K Server plugin for integrating the Open-Meteo weather service with the `Weather API`__.



## Description

This plugin is a Signal K weather provider which communicates with the Open-Meteo API to expose weather via the Signal K Weather API
> **See the Signal K Server documentation for details.**

## Operation

Requests to the Signal K server `Weather API` are passed to the plugin which then communicates with the Open-Meteo service to retrieve forecast and observation data for the specified location.

#### Signal K Weather API options:
- `count` Retrieve up to 16 days Forecast entries

> Note: This option does not apply to Observations as only the most current observation is returned _(i.e. count=1)_. 

- `date` Not supported.


## Configuration

The `Open-Meteo (Weather Provider)` plugin contains the following setting options availavle via the Signal K server `Admin` console _(**Server** -> **Plugin Config**)._

- _Open-Meteo API Key_. This is optional and is required to access "premium content" only available with a subscription.

> Note: Premium content is NOT currently supported.


## Requirements

- Signal K Server that implements the `Weather API`.
