/* Magic Mirror
 * Module: MMM-CurrentWeather-MQTT
 *
 * based on standard module currentweather by Michael Teeuw http://michaelteeuw.nl
 * based on MMM-MQTT by ottopaulsen
 * 
 * MIT Licensed.
 */

Module.register("MMM-Currentweather-MQTT",{

	// Default module config.
	defaults: {
		logging: false,
		location: false,
		locationID: false,
		appid: "",
		units: config.units,
		updateInterval: 10 * 60 * 1000, // every 10 minutes
		animationSpeed: 1000,
		timeFormat: config.timeFormat,
		showPeriod: true,
		showPeriodUpper: false,
		showWindDirection: true,
		showWindDirectionAsArrow: false,
		useBeaufort: true,
		appendLocationNameToHeader: false,
		useKMPHwind: false,
		lang: config.language,
		decimalSymbol: ".",
		showHumidity: false,
		degreeLabel: false,
		showIndoorTemperature: false,
		showIndoorHumidity: false,
		showFeelsLike: true,
		showRainfall: true,

		initialLoadDelay: 0, // 0 seconds delay
		retryDelay: 2500,

		apiVersion: "2.5",
		apiBase: "https://api.openweathermap.org/data/",
		weatherEndpoint: "weather",

		appendLocationNameToHeader: true,
		calendarClass: "calendar",

		onlyTemp: false,
		roundTemp: false,

		iconTable: {
			"01d": "wi-day-sunny",
			"02d": "wi-day-cloudy",
			"03d": "wi-cloudy",
			"04d": "wi-cloudy-windy",
			"09d": "wi-showers",
			"10d": "wi-rain",
			"11d": "wi-thunderstorm",
			"13d": "wi-snow",
			"50d": "wi-fog",
			"01n": "wi-night-clear",
			"02n": "wi-night-cloudy",
			"03n": "wi-night-cloudy",
			"04n": "wi-night-cloudy",
			"09n": "wi-night-showers",
			"10n": "wi-night-rain",
			"11n": "wi-night-thunderstorm",
			"13n": "wi-night-snow",
			"50n": "wi-night-alt-cloudy-windy"
		},

		mqttServers: [],

	},

	// Indizes für den Zugriff auf die subscriptions
	indexTemp: 0,
	indexHum: 1,
	indexIllum: 2,
	indexWindSpeed: 3,
	indexWindDir: 4,
	indexRaining: 5,
	indexRainfall: 6,

	// store HTTRequestResponse
	HTTPRequestResponse: "",

	// create a variable for the first upcoming calendar event. Used if no location is specified.
	firstEvent: false,

	// create a variable to hold the location name based on the API result.
	fetchedLocationName: "",

	// logging function controlled by config variable
	log: function(...args) {
		if (this.config.logging) {
			console.log(args);
		}
	},
	
	// Define required scripts.
	getScripts: function() {
		return ["moment.js"];
	},

	// Define required scripts.
	getStyles: function() {
		return ["MMM-Currentweather-MQTT.css"];
	},

	// Define required translations.
	getTranslations: function () {
		return {
			en: "translations/en.json",
			de: "translations/de.json"
		}
	},

	// Define start sequence.
	start: function() {
		Log.info("Starting module: " + this.name);

		this.subscriptions = [];

		Log.info(this.name + ": Setting up connection to " + this.config.mqttServers.length + " servers");
	
		for (i = 0; i < this.config.mqttServers.length; i++) {
			var s = this.config.mqttServers[i];
			var serverKey = this.makeServerKey(s);
			Log.info(
				this.name +
				": Adding config for " +
				s.address +
				" port " +
				s.port +
				" user " +
				s.user
			);

			for (j = 0; j < s.subscriptions.length; j++) {
				var sub = s.subscriptions[j];
				this.subscriptions.push({
					serverKey: serverKey,
					label: sub.label,
					topic: sub.topic,
					decimals: sub.decimals,
					suffix: typeof sub.suffix == "undefined" ? "" : sub.suffix,
					value: "",
					time: Date.now(),
					maxAgeSeconds: sub.maxAgeSeconds,
					sortOrder: sub.sortOrder || i * 100 + j,
					colors: sub.colors,
					conversions: sub.conversions,
					multiply: sub.multiply,
					divide: sub.divide
				});
				Log.info(
					this.name + ": subscription for " + sub.topic);
			}
		}
	
		this.openMqttConnection();
	
		// Set locale.
		moment.locale(config.language);

		this.windSpeed = null;
		this.windDirection = null;
		this.windDeg = null;
		this.sunriseSunsetTime = null;
		this.sunriseSunsetIcon = null;
		this.temperature = null;
		this.indoorTemperature = null;
		this.indoorHumidity = null;
		this.weatherType = null;
		this.feelsLike = null;
		this.rainfall = null;
		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay);

	},

	openMqttConnection: function() {
		this.sendSocketNotification("MQTT_CONFIG", this.config);
	},
		
	// add extra information of current weather
	// windDirection, humidity, sunrise and sunset
	addExtraInfoWeather: function(wrapper) {

		var small = document.createElement("div");
		small.className = "normal medium";

		var spacer1 = document.createElement("sup");
		spacer1.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;";

		var windIcon = document.createElement("span");
		windIcon.className = "wi wi-strong-wind dimmed";
		small.appendChild(windIcon);
		small.appendChild(spacer1);

		var spacer2 = document.createElement("sup");
		spacer2.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;";

		var windSpeed = document.createElement("span");
		windSpeed.innerHTML = " " + this.windSpeed;
		small.appendChild(windSpeed);
		small.appendChild(spacer2);

		if (this.config.showWindDirection) {
			var windDirection = document.createElement("sup");
			if (this.config.showWindDirectionAsArrow) {
				if(this.windDeg !== null) {
					windDirection.innerHTML = "<i class=\"fa fa-long-arrow-down\" style=\"transform:rotate("+this.windDeg+"deg);\"></i>";
				}
			} else {
				windDirection.innerHTML = " " + this.translate(this.windDirection);
			}

			var spacer3 = document.createElement("sup");
			spacer3.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;";
	
			small.appendChild(windDirection);
			small.appendChild(spacer3);
		}
		var spacer = document.createElement("span");
		spacer.innerHTML = "&nbsp;";
		small.appendChild(spacer);

		if (this.config.showHumidity) {
			var humidity = document.createElement("span");
			humidity.innerHTML = this.humidity;

			var humidityIcon = document.createElement("sup");
			humidityIcon.className = "wi wi-humidity humidityIcon";
			humidityIcon.innerHTML = "&nbsp;";

			var spacer4 = document.createElement("sup");
			spacer4.innerHTML = "&nbsp;";
			var spacer5 = document.createElement("sup");
			spacer5.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;";

	
	
			small.appendChild(humidity);
			small.appendChild(spacer4);
			small.appendChild(humidityIcon);
			small.appendChild(spacer5);
		}

		var sunriseSunsetIcon = document.createElement("span");
		sunriseSunsetIcon.className = "wi dimmed " + this.sunriseSunsetIcon;
		small.appendChild(sunriseSunsetIcon);

		var sunriseSunsetTime = document.createElement("span");
		sunriseSunsetTime.innerHTML = " " + this.sunriseSunsetTime;
		small.appendChild(sunriseSunsetTime);

		wrapper.appendChild(small);
	},

	// Override dom generator.
	getDom: function() {
		var wrapper = document.createElement("div");

		if (this.config.appid === "") {
			wrapper.innerHTML = "Please set the correct openweather <i>appid</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (!this.loaded) {
			wrapper.innerHTML = this.translate("LOADING");
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (this.config.onlyTemp === false) {
			this.addExtraInfoWeather(wrapper);
		}

		var spacer1 = document.createElement("sup");
		spacer1.innerHTML = "&nbsp;";

		var spacer2 = document.createElement("sup");
		spacer2.innerHTML = "&nbsp;&nbsp;";

		var spacer3 = document.createElement("sup");
		spacer3.innerHTML = "&nbsp;&nbsp;&nbsp;";

		var spacer4 = document.createElement("sup");
		spacer4.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;";

		var large = document.createElement("div");
		large.className = "large light";

		if (this.config.showRainfall) {
			var rainfallToday = document.createElement("span");
			rainfallToday.className = "normal medium";
			rainfallToday.innerHTML = this.rainfall + " l/m²";

			var spacer = document.createElement("sup");
			spacer.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;";

			large.appendChild(rainfallToday);
			large.appendChild(spacer);
		}



		var weatherIcon = document.createElement("span");
		weatherIcon.className = "wi weathericon " + this.weatherType;
		large.appendChild(weatherIcon);

		var degreeLabel = "";
		if (this.config.units === "metric" || this.config.units === "imperial") {
			degreeLabel += "°";
		}
		if(this.config.degreeLabel) {
			switch(this.config.units) {
			case "metric":
				degreeLabel += "C";
				break;
			case "imperial":
				degreeLabel += "F";
				break;
			case "default":
				degreeLabel += "K";
				break;
			}
		}

		if (this.config.decimalSymbol === "") {
			this.config.decimalSymbol = ".";
		}

		var temperature = document.createElement("span");
		temperature.className = "bright";
		temperature.innerHTML = " " + this.temperature.replace(".", this.config.decimalSymbol) + degreeLabel;
		large.appendChild(temperature);

		if (this.config.showIndoorTemperature && this.indoorTemperature) {
			var indoorIcon = document.createElement("span");
			indoorIcon.className = "fa fa-home";
			large.appendChild(indoorIcon);

			var indoorTemperatureElem = document.createElement("span");
			indoorTemperatureElem.className = "bright";
			indoorTemperatureElem.innerHTML = " " + this.indoorTemperature.replace(".", this.config.decimalSymbol) + degreeLabel;
			large.appendChild(indoorTemperatureElem);
		}

		if (this.config.showIndoorHumidity && this.indoorHumidity) {
			var indoorHumidityIcon = document.createElement("span");
			indoorHumidityIcon.className = "fa fa-tint";
			large.appendChild(indoorHumidityIcon);

			var indoorHumidityElem = document.createElement("span");
			indoorHumidityElem.className = "bright";
			indoorHumidityElem.innerHTML = " " + this.indoorHumidity + "%";
			large.appendChild(indoorHumidityElem);
		}

		wrapper.appendChild(large);

		if (this.config.showFeelsLike && this.config.onlyTemp === false){
			var small = document.createElement("div");
			small.className = "normal medium";

			var feelsLike = document.createElement("span");
			feelsLike.className = "dimmed";
			feelsLike.innerHTML = this.translate("FEELS") + " " + this.feelsLike + degreeLabel;
			small.appendChild(feelsLike);

			wrapper.appendChild(small);
		}

		return wrapper;
	},

	// Override getHeader method.
	getHeader: function() {
		if (this.config.appendLocationNameToHeader && this.data.header !== undefined) {
			return this.data.header + " " + this.fetchedLocationName;
		}

		if (this.config.useLocationAsHeader && this.config.location !== false) {
			return this.config.location;
		}

		return this.data.header;
	},

	// Override notification handler.
	notificationReceived: function(notification, payload, sender) {
		if (notification === "DOM_OBJECTS_CREATED") {
			if (this.config.appendLocationNameToHeader) {
				this.hide(0, {lockString: this.identifier});
			}
		}
		if (notification === "CALENDAR_EVENTS") {
			var senderClasses = sender.data.classes.toLowerCase().split(" ");
			if (senderClasses.indexOf(this.config.calendarClass.toLowerCase()) !== -1) {
				this.firstEvent = false;

				for (var e in payload) {
					var event = payload[e];
					if (event.location || event.geo) {
						this.firstEvent = event;
						//Log.log("First upcoming event with location: ", event);
						break;
					}
				}
			}
		}
		if (notification === "INDOOR_TEMPERATURE") {
			this.indoorTemperature = this.roundValue(payload);
			this.updateDom(this.config.animationSpeed);
		}
		if (notification === "INDOOR_HUMIDITY") {
			this.indoorHumidity = this.roundValue(payload);
			this.updateDom(this.config.animationSpeed);
		}
	},

	/* updateWeather(compliments)
	 * Requests new data from openweather.org.
	 * Calls processWeather on succesfull response.
	 */
	updateWeather: function(isTelegram) {
		if (this.config.appid === "") {
			Log.error("CurrentWeather: APPID not set!");
			return;
		}

		// Falls Aufruf durch Eintreffen eines neuen MQTT Telegramms, dann kein neuer HTTPRequest, 
		// da ansonsten der free Account von openweathermap überlastet und gesperrt wird
		if (isTelegram) {
			var self = this;
			// Aufruf mit gespeicherten Werten
			// self.log("UpdateWeather", isTelegram, self.HTTPRequestResponse);
			self.processWeather(JSON.parse(self.HTTPRequestResponse));
		} else {
			var url = this.config.apiBase + this.config.apiVersion + "/" + this.config.weatherEndpoint + this.getParams();
			var self = this;
			var retry = true;

			var weatherRequest = new XMLHttpRequest();
			weatherRequest.open("GET", url, true);
			weatherRequest.onreadystatechange = function() {
				if (this.readyState === 4) {
					if (this.status === 200) {
						self.HTTPRequestResponse = this.response;
						// self.log("UpdateWeather", isTelegram, this.response, self.HTTPRequestResponse)
						self.processWeather(JSON.parse(this.response));
					} else if (this.status === 401) {
						self.updateDom(self.config.animationSpeed);

						Log.error(self.name + ": Incorrect APPID.");
						retry = true;
					} else {
						self.loaded = true;
						Log.error(self.name + ": Could not load weather.");
					}

					if (retry) {
						self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
					}
				}
			};
			weatherRequest.send();
		}
	},

	/* getParams(compliments)
	 * Generates an url with api parameters based on the config.
	 *
	 * return String - URL params.
	 */
	getParams: function() {
		var params = "?";
		if(this.config.locationID) {
			params += "id=" + this.config.locationID;
		} else if(this.config.location) {
			params += "q=" + this.config.location;
		} else if (this.firstEvent && this.firstEvent.geo) {
			params += "lat=" + this.firstEvent.geo.lat + "&lon=" + this.firstEvent.geo.lon;
		} else if (this.firstEvent && this.firstEvent.location) {
			params += "q=" + this.firstEvent.location;
		} else {
			this.hide(this.config.animationSpeed, {lockString:this.identifier});
			return;
		}

		params += "&units=" + this.config.units;
		params += "&lang=" + this.config.lang;
		params += "&APPID=" + this.config.appid;

		return params;
	},

	/* processWeather(data)
	 * Uses the received data to set the various values.
	 *
	 * argument data object - Weather information received form openweather.org.
	 */
	processWeather: function(data) {

		if (!data || !data.main || typeof data.main.temp === "undefined") {
			// Did not receive usable new data.
			// Maybe this needs a better check?
			return;
		}

		sub = this.subscriptions;

		if (sub[this.indexHum].value == "" || this.isValueTooOld(sub[this.indexHum].maxAgeSeconds, sub[this.indexHum].time)) {
			this.humidity = parseFloat(data.main.humidity);
		} else {
			this.humidity = sub[this.indexHum].value;
		}

		if (sub[this.indexTemp].value == "" || this.isValueTooOld(sub[this.indexTemp].maxAgeSeconds, sub[this.indexTemp].time)) {
			this.temperature = this.roundValue(data.main.temp);
		} else {
			this.temperature = sub[this.indexTemp].value;
		}

		this.fetchedLocationName = data.name;
		this.feelsLike = 0;

		if (this.config.useBeaufort){
			if (sub[this.indexWindSpeed].value == "" || this.isValueTooOld(sub[this.indexWindSpeed].maxAgeSeconds, sub[this.indexWindSpeed].time)) {
				this.windSpeed = this.ms2Beaufort(this.roundValue(data.wind.speed));
			} else {
				this.windSpeed = this.ms2Beaufort(this.roundValue(sub[this.indexWindSpeed].value));
			}
		} else if (this.config.useKMPHwind) {
			if (sub[this.indexWindSpeed].value == "" || this.isValueTooOld(sub[this.indexWindSpeed].maxAgeSeconds, sub[this.indexWindSpeed].time)) {
				this.windSpeed = parseFloat((data.wind.speed * 60 * 60) / 1000).toFixed(0);
			} else {
				this.windSpeed = parseFloat(sub[this.indexWindSpeed].value).toFixed(0);
			}
		} else {
			if (sub[this.indexWindSpeed].value == "" || this.isValueTooOld(sub[this.indexWindSpeed].maxAgeSeconds, sub[this.indexWindSpeed].time)) {
				this.windSpeed = parseFloat(data.wind.speed).toFixed(0);
			} else {
				this.windSpeed = parseFloat((sub[this.indexWindSpeed].value * 1000) / (60*60)).toFixed(0);
			}
		}

		// ONLY WORKS IF TEMP IN C //
		var windInMph = parseFloat(data.wind.speed * 2.23694);

		var tempInF = 0;
		switch (this.config.units){
		case "metric": tempInF = 1.8 * this.temperature + 32;
			break;
		case "imperial": tempInF = this.temperature;
			break;
		case "default":
			var tc = this.temperature - 273.15;
			tempInF = 1.8 * tc + 32;
			break;
		}

		if (windInMph > 3 && tempInF < 50){
			// windchill
			var windChillInF = Math.round(35.74+0.6215*tempInF-35.75*Math.pow(windInMph,0.16)+0.4275*tempInF*Math.pow(windInMph,0.16));
			var windChillInC = (windChillInF - 32) * (5/9);
			// this.feelsLike = windChillInC.toFixed(0);

			switch (this.config.units){
			case "metric": this.feelsLike = windChillInC.toFixed(0);
				break;
			case "imperial": this.feelsLike = windChillInF.toFixed(0);
				break;
			case "default":
				var tc = windChillInC + 273.15;
				this.feelsLike = tc.toFixed(0);
				break;
			}

		} else if (tempInF > 80 && this.humidity > 40){
			// heat index
			var Hindex = -42.379 + 2.04901523*tempInF + 10.14333127*this.humidity
				- 0.22475541*tempInF*this.humidity - 6.83783*Math.pow(10,-3)*tempInF*tempInF
				- 5.481717*Math.pow(10,-2)*this.humidity*this.humidity
				+ 1.22874*Math.pow(10,-3)*tempInF*tempInF*this.humidity
				+ 8.5282*Math.pow(10,-4)*tempInF*this.humidity*this.humidity
				- 1.99*Math.pow(10,-6)*tempInF*tempInF*this.humidity*this.humidity;

			switch (this.config.units){
			case "metric": this.feelsLike = parseFloat((Hindex - 32) / 1.8).toFixed(0);
				break;
			case "imperial": this.feelsLike = Hindex.toFixed(0);
				break;
			case "default":
				var tc = parseFloat((Hindex - 32) / 1.8) + 273.15;
				this.feelsLike = tc.toFixed(0);
				break;
			}
		} else {
			this.feelsLike = parseFloat(this.temperature).toFixed(0);
		}

		if (sub[this.indexWindDir].value == "" || this.isValueTooOld(sub[this.indexWindDir].maxAgeSeconds, sub[this.indexWindDir].time)) {
			this.windDirection = this.deg2Cardinal(data.wind.deg);
		} else {
			this.windDirection = this.deg2Cardinal(sub[this.indexWindDir].value);
		}

		if (sub[this.indexWindDir].value == "" || this.isValueTooOld(sub[this.indexWindDir].maxAgeSeconds, sub[this.indexWindDir].time)) {
			this.windDeg = data.wind.deg;
		} else {
			this.windDeg = sub[this.indexWindDir].value;
		}

		if (sub[this.indexRainfall].value == "" ) {
			this.rainfall = "-";
		} else {
			this.rainfall = sub[this.indexRainfall].value;
		}

		this.weatherType = this.config.iconTable[data.weather[0].icon];

		var now = new Date();
		var sunrise = new Date(data.sys.sunrise * 1000);
		var sunset = new Date(data.sys.sunset * 1000);

		// The moment().format('h') method has a bug on the Raspberry Pi.
		// So we need to generate the timestring manually.
		// See issue: https://github.com/MichMich/MagicMirror/issues/181
		var sunriseSunsetDateObject = (sunrise < now && sunset > now) ? sunset : sunrise;
		var timeString = moment(sunriseSunsetDateObject).format("HH:mm");
		if (this.config.timeFormat !== 24) {
			//var hours = sunriseSunsetDateObject.getHours() % 12 || 12;
			if (this.config.showPeriod) {
				if (this.config.showPeriodUpper) {
					//timeString = hours + moment(sunriseSunsetDateObject).format(':mm A');
					timeString = moment(sunriseSunsetDateObject).format("h:mm A");
				} else {
					//timeString = hours + moment(sunriseSunsetDateObject).format(':mm a');
					timeString = moment(sunriseSunsetDateObject).format("h:mm a");
				}
			} else {
				//timeString = hours + moment(sunriseSunsetDateObject).format(':mm');
				timeString = moment(sunriseSunsetDateObject).format("h:mm");
			}
		}

		this.sunriseSunsetTime = timeString;
		this.sunriseSunsetIcon = (sunrise < now && sunset > now) ? "wi-sunset" : "wi-sunrise";

		this.show(this.config.animationSpeed, {lockString:this.identifier});
		this.loaded = true;
		this.updateDom(this.config.animationSpeed);
		this.sendNotification("CURRENTWEATHER_DATA", {data: data});
	},

	/* scheduleUpdate()
	 * Schedule next update.
	 *
	 * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
	 */
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;
		setTimeout(function() {
			self.updateWeather(false);
		}, nextLoad);
	},

	/* ms2Beaufort(ms)
	 * Converts m2 to beaufort (windspeed).
	 *
	 * see:
	 *  http://www.spc.noaa.gov/faq/tornado/beaufort.html
	 *  https://en.wikipedia.org/wiki/Beaufort_scale#Modern_scale
	 *
	 * argument ms number - Windspeed in m/s.
	 *
	 * return number - Windspeed in beaufort.
	 */
	ms2Beaufort: function(ms) {
		var kmh = ms * 60 * 60 / 1000;
		var speeds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, 1000];
		for (var beaufort in speeds) {
			var speed = speeds[beaufort];
			if (speed > kmh) {
				return beaufort;
			}
		}
		return 12;
	},

	deg2Cardinal: function(deg) {
		if (deg>11.25 && deg<=33.75){
			return "NNE";
		} else if (deg > 33.75 && deg <= 56.25) {
			return "NE";
		} else if (deg > 56.25 && deg <= 78.75) {
			return "ENE";
		} else if (deg > 78.75 && deg <= 101.25) {
			return "E";
		} else if (deg > 101.25 && deg <= 123.75) {
			return "ESE";
		} else if (deg > 123.75 && deg <= 146.25) {
			return "SE";
		} else if (deg > 146.25 && deg <= 168.75) {
			return "SSE";
		} else if (deg > 168.75 && deg <= 191.25) {
			return "S";
		} else if (deg > 191.25 && deg <= 213.75) {
			return "SSW";
		} else if (deg > 213.75 && deg <= 236.25) {
			return "SW";
		} else if (deg > 236.25 && deg <= 258.75) {
			return "WSW";
		} else if (deg > 258.75 && deg <= 281.25) {
			return "W";
		} else if (deg > 281.25 && deg <= 303.75) {
			return "WNW";
		} else if (deg > 303.75 && deg <= 326.25) {
			return "NW";
		} else if (deg > 326.25 && deg <= 348.75) {
			return "NNW";
		} else {
			return "N";
		}
	},

	/* function(temperature)
	 * Rounds a temperature to 1 decimal or integer (depending on config.roundTemp).
	 *
	 * argument temperature number - Temperature.
	 *
	 * return string - Rounded Temperature.
	 */
	roundValue: function(temperature) {
		var decimals = this.config.roundTemp ? 0 : 1;
		return parseFloat(temperature).toFixed(decimals);
	},

	makeServerKey: function(server) {
		return "" + server.address + ":" + (server.port | ("1883" + server.user));
	},

	socketNotificationReceived: function(notification, payload) {
		if (notification === "MQTT_PAYLOAD") {
			if (payload != null) {
				for (i = 0; i < this.subscriptions.length; i++) {
					sub = this.subscriptions[i];
					if (
						sub.serverKey == payload.serverKey && this.config.useWildcards
						? topicsMatch(sub.topic, payload.topic)
						: sub.topic == payload.topic
					) {
						var value = payload.value;

						// Multiply or divide
						value = this.multiply(sub, value);
			
						// Round if decimals is configured
						if (isNaN(sub.decimals) == false) {
							if (isNaN(value) == false) {
								value = Number(value).toFixed(sub.decimals);
							}
						}
						sub.value = value;
						sub.time = payload.time;
					}
				}
				this.updateWeather(true);
			} else {
				console.log(this.name + ": MQTT_PAYLOAD - No payload");
			}
		}
	},

	isValueTooOld: function(maxAgeSeconds, updatedTime) {
		// console.log(this.name + ': maxAgeSeconds = ', maxAgeSeconds);
		// console.log(this.name + ': updatedTime = ', updatedTime);
		// console.log(this.name + ': Date.now() = ', Date.now());
		if (maxAgeSeconds) {
			if (updatedTime + maxAgeSeconds * 1000 < Date.now()) {
				return true;
			}
		}
		return false;
	},
	
	getColors: function(sub) {
		console.log(sub.topic);
		console.log("Colors:", sub.colors);
		console.log("Value: ", sub.value);
		if (!sub.colors || sub.colors.length == 0) {
			return {};
		}
	
		let colors;
		for (i = 0; i < sub.colors.length; i++) {
			colors = sub.colors[i];
			if (sub.value < sub.colors[i].upTo) {
				break;
			}
		}
	
		return colors;
	},
	
	multiply: function(sub, value) {
		if (!sub.multiply && !sub.divide) {
			return value;
		}
		if (!value) {
			return value;
		}
		if (isNaN(value)) {
			return value;
		}
		let res = (+value * (sub.multiply || 1)) / (sub.divide || 1);
		return isNaN(res) ? value : "" + res;
	},
	
	convertValue: function(sub) {
		if (!sub.conversions || sub.conversions.length == 0) {
			return sub.value;
		}
		for (i = 0; i < sub.conversions.length; i++) {
			if (sub.value == sub.conversions[i].from) {
				return sub.conversions[i].to;
			}
		}
		return sub.value;
	},
	
	
	
});
