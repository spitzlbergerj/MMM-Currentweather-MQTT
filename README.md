# MMM-Currentweather-MQTT

The MMM-Currentweather-MQTT is based an the standard module `currentweather` and the module `MMM-MQTT`.

The `currentweather` module is one of the default modules of the MagicMirror.
This module displays the current weather, including the windspeed, the sunset or sunrise time, the temperature and an icon to display the current conditions.

For configuration options, please check the [MagicMirror² documentation](https://docs.magicmirror.builders/modules/currentweather.html).

## Installation

Go to `MagicMirror/modules` and write

```
    git clone https://github.com/spitzlbergerj/MMM-Currentweather-MQTT
    cd MMM-Currentweather-MQTT
    npm install
```



## Configuration

Here is an example configuration with description. Put it in the `MagicMirror/config/config.js` file:

```javascript
{
	module: "MMM-Currentweather-MQTT",
	position: "top_right",
	config: {
		location: "Oberschleißheim",
		// locationID: "2859147",
		locationID: "6556320",
		appid: "1d67c19abe9ac6b11132eeb7a97a72f7",
		roundTemp: true,
		degreeLabel: true,
		showWindDirection: true,
		showWindDirectionAsArrow: true,
		showHumidity: true,
		showFeelsLike: false,
		useBeaufort: false,
		useKMPHwind: true,
        logging: true,
        useWildcards: false,
        mqttServers: [
            {
                address: '192.168.178.101',  // Server address or IP address
		 		        port: '1883',          // Port number if other than default
				subscriptions: [
					{
						topic: 'wetter/act-temp',  // Topic to look for
						label: 'Temperatur',       // Displayed in front of value
						suffix: '°C',              // Displayed after the value
						decimals: 0,               // Round numbers to this number of decimals
						sortOrder: 10,             // Can be used to sort entries in the same table
						maxAgeSeconds: 600,        // Reduce intensity if value is older
					},
					{
						topic: 'wetter/act-hum',
						label: 'Luftfeuchtigkeit',
						suffix: '%',
						decimals: 0,
						sortOrder: 20,
						maxAgeSeconds: 600
					},
					{
						topic: 'wetter/act-illum',
						label: 'Helligkeit',
						sortOrder: 30,
						maxAgeSeconds: 600
					},
					{
						topic: 'wetter/act-wind-speed',
						label: 'Windgeschwindigkeit',
						suffix: 'km/h',
						decimals: 0,
						sortOrder: 40,
						maxAgeSeconds: 600
					},
					{
						topic: 'wetter/act-wind-dir',
						label: 'Windrichtung',
						suffix: '°',
						decimals: 0,
						sortOrder: 50,
						maxAgeSeconds: 600
					},
					{
						topic: 'wetter/raining',
						label: 'Regnet es?',
						suffix: '',
						decimals: 0,
						sortOrder: 60,
						maxAgeSeconds: 600,
						conversions: [
							{ from: "true", to: "ja" },
							{ from: "false", to: "nein" }
						]
					},
				]
			}
        ],
	}
},
```

## Configuration options

<table width="100%">
    <thead>
        <tr>
            <th>Option</th>
            <th width="100%">Description</th>
        </tr>
        <thead>
        <tbody>
            <tr>
                <td><code>mqttServerAddress</code></td>
                <td>IP address of the MQTT Broker
                </td>
            </tr>
            <tr>
                <td><code>mqttServerUser</code></td>
                <td>Port of MQTT Broker
                </td>
            </tr>
            <tr>
                <td><code>mqttServerUser</code></td>
                <td>User to access the MQTT Broker (optional)
                </td>
            </tr>
            <tr>
                <td><code>mqttServerPassword</code></td>
                <td>Password of user to access the MQTT Broker (optional)
                </td>
            </tr>
            <tr>
                <td><code>mqttTopics</code></td>
                <td>Topics for the MQTT Broker (optional)
                    <br><b>Possible values:</b> <code>["Tesla",]</code> - <code>["teslamate/cars/1/+",]</code> -
                    <code>["Tesla","teslamate/cars/1/+",]</code>
                    <br><b>Default value:</b> <code>["Tesla","teslamate/cars/1/+",]</code> </td>
            </tr>
        </tbody>
</table>
