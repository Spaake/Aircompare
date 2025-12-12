import fetch from "node-fetch";
import mysql from "mysql2/promise";

const lat = 52.2297;
const lng = 21.0122;
const radius = 20;
const apiKey = "f0TvSUUT3FrlEWD4jowv1TPXq51astfE";
const maxResults = 30;

const opAQRadius = 20000;
const opAQapiKey = "67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b";
const opAQmaxResults = 200;

async function fetchAirlyStations() {
  try {
    const url = `https://airapi.airly.eu/v2/installations/nearest?lat=${lat}&lng=${lng}&maxDistanceKM=${radius}&maxResults=${maxResults}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        apikey: apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log("Airly data:", data);

    console.log("JUST A TEST:");
    console.log(JSON.stringify(data.slice(0, 3), null, 2));

    const connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "haslo",
      database: "airly"
    });

    const insertQuery = `
      REPLACE INTO airly_stations (id, name, lat, lon, city, street, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    for (const item of data) {
      const { id, address, location, sponsor } = item;
      await connection.execute(insertQuery, [
        id,
        address?.displayAddress1 || "Punkt Airly",
        location.latitude,
        location.longitude,
        address?.city || "",
        address?.street || "",
        sponsor?.name || "",
      ]);
    }

    console.log("Data loaded to MySQL");
    await connection.end();

  } catch (err) {
      console.error("Error downloading the data:", err);
  }
}

async function fetchOpenAQSensors () {
  try {
    const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lng}&radius=${opAQRadius}&limit=${opAQmaxResults}`;;
    const response = await fetch(url, {
      method: "GET",
      headers: {
         "X-API-Key": opAQapiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("OpenAQ data:", JSON.stringify(data.results?.slice(0, 3), null, 2));

    const connection = await mysql.createConnection({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "haslo",
      database: "airly"
    });

    const insertQuery = `
      REPLACE INTO openaq_sensors (sensorId, parameterName, displayName, unit, locationsId)
      VALUES (?, ?, ?, ?, ?)
    `;

    for (const loc of data.results || []) {
      for (const sensor of loc.sensors || []) {
        await connection.execute(insertQuery, [
          sensor.id,
          sensor.parameter?.name || null,
          sensor.parameter?.displayName || null,
          sensor.parameter?.units || null,
          loc.id
        ]);
      }
     }

     console.log("OpenAQ sensors loaded to MySQL");
     await connection.end();


  } catch (err) {
    console.error("Error downloading the data:", err);
  }
}

// fetchAirlyStations()
fetchOpenAQSensors()
