import express from "express";
import fetch from "node-fetch";
import cors from "cors";
// import fs from "fs";
import mysql from "mysql2/promise";

const app = express();
const PORT = 3000;

app.use(cors());
app.get("/api/openaq", async (req, res) => {
  const { lat = 52.2297, lon = 21.0122, radius = 20000 } = req.query;
  const apiKey = '67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b'
  const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=${radius}&limit=100`;

  try {
    const response = await fetch(url, {
       method: "GET",
       headers: {
         "X-API-Key": apiKey,
       },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const locations = data.results || [];

    const AQcoordinates = [];

    for (const loc of locations) {
      const latestUrl = `https://api.openaq.org/v3/locations/${loc.id}/latest`;

      const latestResponse = await fetch(latestUrl, {
        headers: { "X-API-Key": apiKey }
    });

      let latestData = null;

      if (latestResponse.ok) {
        const json = await latestResponse.json();
        latestData = json.results || null;
      }

      AQcoordinates.push({
        id: loc.id,
        lat: loc.coordinates.latitude,
        lon: loc.coordinates.longitude,
        name: loc.name,
        source: "openaq",
        latest: latestData
      });
    }

  res.json(AQcoordinates)
    // const response = await fetch(url, {
    //   method: "GET",
    //   headers: {
    //     "X-API-Key": apiKey,
    //   },
    // });
    //
    // if (!response.ok) {
    //   throw new Error(`API error: ${response.status} ${response.statusText}`);
    // }
    //
    // const data = await response.json();
    //
    //
    //
    // const AQcoordinates = data.results?.map(loc => ({
    //   id: loc.id,
    //   lat: loc.coordinates.latitude,
    //   lon: loc.coordinates.longitude,
    //   name: loc.name,
    //   source: "openaq",
    //   latest: loc.results?.[0] || null
    // }))
    //
    // res.json(AQcoordinates);

  } catch (err) {
    console.error("Error downloading the data:", err);
    res.status(500).json({ error: "Error downloading the data" });
  }
});

app.get("/api/gios", async (req, res) => {
  const url = "https://api.gios.gov.pl/pjp-api/v1/rest/station/findAll";
  const pageSize = 20;
  // const page = 10;
  const pagesToFetch = [10,13]
  let allStations =[]
  try {
    for (const page of pagesToFetch) {
      const response = await fetch(`${url}?page=${page}&size=${pageSize}`);
      if (!response.ok) throw new Error(`API error ${response.status}`);

      const data = await response.json();
      console.log("t0t0", data)

      const stations = data["Lista stacji pomiarowych"] || [];
      allStations.push(stations)
    }

    const giosCoordinates = allStations
      .filter(s => Number(s["Identyfikator miasta"]) === 1006)
      .map(s => ({
        id: s["Identyfikator stacji"],
        name: s["Nazwa stacji"],
        lat: parseFloat(s["WGS84 φ N"].replace(",", ".")),
        lon: parseFloat(s["WGS84 λ E"].replace(",", ".")),
        city: s["Nazwa miasta"],
        street: s["Ulica"] || null,
        province: s["Województwo"] || null,
        source: "gios",
      }));

    res.json(giosCoordinates);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({error: "Internal Server Error"});
  }
  // try {
  //   const firstResponse = await fetch(`${url}?page=0&size=${pageSize}`);
  //   if (!firstResponse.ok) throw new Error("First page error");
  //
  //   const firstData = await firstResponse.json();
  //   // console.log("to to", firstData)
  //   const totalPages = firstData.totalPages;  //Zawsze zwraca 15
  //   const allStations = [];
  //   console.log("Total pages:", totalPages);
  //   await (sleep(3000))
  //
  //   for (let page = 0; page < totalPages; page++) {
  //     const response = await fetch(`${url}?page=${page}&size=${pageSize}`);
  //     if (!response.ok) throw new Error(`API error ${response.status}`);
  //     const data = await response.json();
  //     console.log("t0t0", data)
  //
  //     const stations = data["Lista stacji pomiarowych"] || [];
  //     console.log(stations);
  //     allStations.push(...stations);
  //     await (sleep(1000))
  //   }
  //
  //   const giosCoordinates = allStations
  //     .filter(s => Number(s["Identyfikator miasta"]) === 1006)
  //     .map(s => ({
  //       id: s["Identyfikator stacji"],
  //       name: s["Nazwa stacji"],
  //       lat: parseFloat(s["WGS84 φ N"].replace(",", ".")),
  //       lon: parseFloat(s["WGS84 λ E"].replace(",", ".")),
  //       city: s["Nazwa miasta"],
  //       street: s["Ulica"] || null,
  //       province: s["Województwo"] || null,
  //       source: "gios",
  //     }));
  //
  //   res.json(giosCoordinates);
  // } catch (err) {
  //   console.error("Server error:", err);
  //   res.status(500).json({ error: "Internal Server Error" });
  // }
})
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "haslo",
  database: "airly",
  // waitForConnections: true,
  // connectionLimit: 5,
  // queueLimit: 0
});

app.get("/api/airly", async (req, res) => {
  let airCoordinates = [];

  try {

    const [lastMeasurement] = await pool.query(
      `Select timestamp from airly_measurement
      order by timestamp desc
      limit 1`
    )

    const last = lastMeasurement[0]

    if (last && Date.now() - new Date(last.timestamp).getTime() < 3600 * 1000) {
      const [cached] = await pool.query(
        `SELECT station_id AS id, aqi, params, timestamp
         FROM airly_measurements`
      );

      return res.json(
        cached.map(row => ({
          id: row.id,
          aqi: row.aqi,
          params: JSON.parse(row.params),
          source: "airly (cached)",
          timestamp: row.timestamp
        }))
      );
    }

    else {

    }
    const [stations] = await pool.query(
      "SELECT id, name, lat, lon, city, street, origin FROM airly_stations"
    );

    airCoordinates = stations.map((loc) => ({
      id: loc.id,
      lat: loc.lat,
      lon: loc.lon,
      name: loc.name || "Data from Airly",
      origin: loc.origin,
      source: "airly"
    }));

    // res.json(AirCooridantes);
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Database error" });
  }

  const detailedStations = await Promise.all(airCoordinates.map(async station=> {
    try {
      const url = `https://airapi.airly.eu/v2/measurements/point?lat=${station.lat}&lng=${station.lon}`;
       const data = await fetch(url, {
            headers: {
              Accept: "application/json",
              apikey: "f0TvSUUT3FrlEWD4jowv1TPXq51astfE"
            }
          });
      const json = await data.json();
      console.log(json)

      if (!json.current) {
        throw new Error("Airly error");
      }

      const current = json.current || {};
      // const index = json.indexes || {};

      const result = {
        ...station,
        params: current.values.map(v => ({
          name: v.name,
          value: v.value
        })),
        aqi: current.indexes[0].value ?? null
      }

      // const connection = await mysql.createConnection({
      //   host: "localhost",
      //   port: 3306,
      //   user: "root",
      //   password: "haslo",
      //   database: "airly"
      // });

      await pool.query(
       `REPLACE INTO airly_measurements (station_id, aqi, params, timestamp) values (?, ?, ?, now())`,
            [
              station.id,
              result.aqi,
              JSON.stringify(result.params)
            ]
          );

      return result

    } catch (err) {
      console.error("Detail fetch error for station:", station.id, err);
      return {
            ...station,
            params: null,
            aqi: null
      };
    }
  }));
  res.json(detailedStations);
})

app.get("/api/warsawIoT", async (req, res) => {
  const apiKey = "85f54f85-d58b-443d-a121-0081f9451fa3";
  const url = `https://api.um.warszawa.pl/api/action/air_sensors_get/?apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Warsaw API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // console.log("RAW data keys:", Object.keys(data));
    // console.log("RAW sample:", JSON.stringify(data).substring(0, 300));
    const WARcoordinates = data.result?.map(loc => ({
      id: loc.id,
      lat: parseFloat(loc.lat),
      lon: parseFloat(loc.lon),
      name: loc.name,
      stationType: loc.station_type,
      parameters: loc.data.map(p => ({
        paramName: p.param_name,
        paramCode: p.param_code,
        value: p.value,
        unit: p.unit,
        time: p.time
      })),
      source: "warsawIoT"
    }))

    res.json(WARcoordinates);

  } catch (err) {
    console.error("Error downloading the data:", err);
    res.status(500).json({error: "Error downloading the data"});
  }
})

app.get("/api/aqicn", async (req, res) => {
  const apiKey = "ca09e110edc3446687444ae2b99bd6f278c12815";
  const keyword = "warsaw";

  let stations = [];

  try {
    const resp = await fetch(
      `https://api.waqi.info/search/?keyword=${keyword}&token=${apiKey}`
    );

    const json = await resp.json();

    if (json.status !== "ok") {
      throw new Error("AQICN error");
    }

    stations = json.data.map(s => ({
      id: s.uid,
      name: s.station.name,
      lat: s.station.geo[0],
      lon: s.station.geo[1],
      aqi: s.aqi,
      source: "aqicn"
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AQICN fetch error" });
  }


  const detailedStations = await Promise.all(stations.map(async station=> {
    try {
      const url = `https://api.waqi.info/feed/geo:${station.lat};${station.lon}/?token=${apiKey}`;
      const data = await fetch(url);
      const json = await data.json();

      if (json.status !== "ok") {
        throw new Error("AQICN error");
      }

      const iaqi = json.data.iaqi || {};
      return {
        ...station,
        params: {
          co: iaqi.co?.v ?? null,
          no: iaqi.no2?.v ?? null,
          ozone: iaqi.o3?.v ?? null,
          pm10: iaqi.pm10?.v ?? null,
          pm25: iaqi.pm25?.v ?? null,
        }
      }

    } catch (err) {
      console.error("Detail fetch error for station:", station.id, err);
        // return {...station, details: null};
    }
  }));
  res.json(detailedStations);
});

app.get("/api/openaq/measurements", async (req, res) => {
  const { id } = req.query;
  const apiKey = '67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b';
  if (!id) return res.status(400).json({ error: "Missing id" });

  const url = `https://api.openaq.org/v3/locations/${id}/latest`;

  try {
    const [sensors] = await pool.query(
      "SELECT sensorId, parameterName, displayName, unit, locationsId FROM openaq_sensors");

    const response = await fetch(url, {
      headers: { "X-API-Key": apiKey }
    });

    const json = await response.json();
    if (!json.results || !Array.isArray(json.results)) {
      return res.json([]);
    }

    const measurements = json.results.map(m => {
      const sensor = sensors.find(s => Number(s.sensorId) === Number(m.sensorsId) && Number(s.locationsId) === Number(m.locationsId));

      return {
        // parameter: sensor?.parameterName || "unknown",
        displayName: sensor?.displayName || sensor?.parameterName || "Unknown",
        sensorId: m.sensorsId,
        value: m.value,
        unit: sensor?.unit || "",
        date: m.datetime.local
      }
    });

    res.json(measurements);

  } catch (err) {
    console.error(err);
    res.json([])
  }
});

app.listen(PORT, () => {
  console.log(`Proxy works on http://localhost:${PORT}`);
});
