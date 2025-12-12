import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import {CommonModule} from '@angular/common';

const openAQ = '67b897ddb5f0fbc65cdab9c01115fa763ca4ad5240292679988a951db098180b';
const bbox = "20.85,52.10,21.20,52.35";

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.html',
  styleUrl: './map.css',
})

export class Map implements OnInit {
  private map: any;
  // private cities: any[] = [];
  private allData: any[] = [];
  public measurements: any[] = [];
  public stationTitle: string = "";

  async ngOnInit(): Promise <void> {
      this.runMap();
      this.addLayer();

      await Promise.all([
        this.getOpenAQ(),
        this.getGIOS(),
        this.getAirly(),
        this.getWarsawIoT(),
        this.getAQICN()
      ]);

      this.addMarkers()
  }

  private runMap(): void {
    this.map = L.map('map', {
      center: [52.2297, 21.0122], //Warsaw
      zoom: 11,
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false
    });
  }

  private addLayer(): void {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    L.tileLayer('https://tiles.aqicn.org/tiles/usepa-aqi/{z}/{x}/{y}.png?token=ca09e110edc3446687444ae2b99bd6f278c12815', {
      attribution: '&copy; <a href="https://aquicn.org"> AQICN.org</a>',
      maxZoom: 18,
      minZoom: 5,
    }).addTo(this.map);
  }

  private async getOpenAQ() {
    try {
      const response = await fetch("http://localhost:3000/api/openaq?lat=52.2297&lon=21.0122");
      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      this.allData.push(...data);
      console.log("API data:", this.allData);

    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error:", error);
      }
    }
  }

  private async getGIOS() {
    try {
      const response = await fetch("http://localhost:3000/api/gios");
      const data = await response.json()
      console.log("todata", data)
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      this.allData.push(...data);

      console.log("API data:", this.allData);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error:", error);
      }
    }
  }

  private async getAirly() {
    try {
      const response = await fetch("http://localhost:3000/api/airly");
      const data = await response.json()
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      this.allData.push(...data);

      console.log("API data:", this.allData);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error:", error);
      }
    }
  }

  private async getWarsawIoT() {
    try {
      const response = await fetch("http://localhost:3000/api/warsawIoT");

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json()
      this.allData.push(...data);

      console.log("API data:", this.allData);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error:", error);
      }
    }
  }

  private async getAQICN() {
  try {
    const response = await fetch("http://localhost:3000/api/aqicn");

    if (!response.ok) {
      throw new Error("AQICN error");
    }

    const data = await response.json();
    console.log("Aqicn", data)
    this.allData.push(...data);

  } catch (err) {
    console.error(err);
  }
}

  private addMarkers(): void {

  const grouped: { [key: string]: any[] } = {};

  for (const loc of this.allData) {
    if (!loc.lat || !loc.lon) continue;

    const key = `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(loc);
  }

  for (const key in grouped) {
    const locations = grouped[key];
    const [lat, lon] = key.split(',').map(Number);
    const sources = locations.map(l => l.source);

    const hasAirly = sources.includes('airly');
    const hasGios = sources.includes('gios');
    const hasOpenAQ = sources.includes('openaq');
    const hasIoT = sources.includes('warsawIoT');
    const hasAQICN = sources.includes('aqicn');

    let icon: L.DivIcon | L.Icon;

    if (hasAirly && hasGios && hasOpenAQ) {
      icon = this.createMixedIconAll('#12ff77', '#ff1133', '#114499');
    } else if (hasAirly && hasGios) {
      icon = this.createMixedIcon('#ee0022', '#00c853');
    } else if (hasAirly && hasOpenAQ) {
      icon = this.createMixedIcon('#2196f3', '#ee0022');
    } else if (hasGios && hasOpenAQ) {
      icon = this.createMixedIcon('#00c853', '#2196f3');
    } else if (hasOpenAQ && hasAQICN) {
      icon = this.createMixedIcon('#2196f3', '#ee22ee');
    } else if (hasAirly) {
      icon = this.createAirlyIcon();
    } else if (hasGios) {
      icon = this.createGiosIcon();
    } else if (hasIoT) {
      icon = this.createWarsawIoTIcon();
    } else if (hasAQICN) {
      icon = this.createAqicnIcon();
    }
    else {
      icon = this.createAQIcon(true);
    }

    L.marker([lat, lon], {icon})
      .on("click", () => this.loadMeasurements(locations[0]))
      .bindPopup(this.buildPopupContent(locations))
      .addTo(this.map);
  }
  }

  private createAqicnIcon(): L.DivIcon {
    return L.divIcon({
      className: 'warsawIoT-markes',
      html:`
      <div style="
      background-color: #cc33cc;
      width: 21px;
      height: 21px;
      border-radius: 50%;
      border: 3px solid #ee44ee;
      opacity: 0.8;">`
    })
  }
  private createMixedIcon(color1: string, color2: string): L.DivIcon {
    return L.divIcon({
      className: 'mixed-marker',
      html: `
        <div style="
          background: linear-gradient(135deg, ${color1} 50%, ${color2} 50%);
          width: 21px;
          height: 21px;
          border-radius: 50%;
          border: 3px solid #ddccdd;
          opacity: 0.8;
        "></div>
      `,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }
  private createMixedIconAll(color1: string, color2: string, color3: string): L.DivIcon {
    return L.divIcon({
      className: 'mixed-marker',
      html: `
        <div style="
          background: linear-gradient(135deg,
          ${color1} 0%,
          ${color1} 33.3%,
          ${color2} 32%,
          ${color2} 68%,
          ${color3} 66.6%,
          ${color3} 100%);
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 3px solid #ddccdd;
          opacity: 0.8;
        "></div>`,
      // iconSize: [16, 16],
      // iconAnchor: [8, 8],
    });
  }

  private createWarsawIoTIcon(): L.DivIcon {
    return L.divIcon({
      className: 'warsawIoT-markes',
      html:`
      <div style="
      background-color: #eebb33;
      width: 21px;
      height: 21px;
      border-radius: 50%;
      border: 3px solid #aa8811;
      opacity: 0.8;">`
    })
  }
  private createAQIcon(isHigh: boolean): L.DivIcon {
    return L.divIcon({
      className: "AQ-marker",
      html:
        `<div style="
          background-color: #114499;
          width: 21px;
          height: 21px;
          border-radius: 50%;
          border: 3px solid #99aaff;
          opacity: 0.8;
        "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    // return L.icon({
    //   iconUrl:
    //     'https://leafletjs.com/examples/custom-icons/leaf-red.png',
    //     // : 'https://leafletjs.com/examples/custom-icons/leaf-green.png',
    //   iconSize: [38, 95],
    //   iconAnchor: [22, 94],
    //   shadowUrl: 'https://leafletjs.com/examples/custom-icons/leaf-shadow.png',
    //   shadowSize: [50, 64],
    //   shadowAnchor: [4, 62],
    // });
  }
  private createGiosIcon(): L.DivIcon {
    return L.divIcon({
      className: "gios-marker",
      html: `<div style="
        background-color: #00c853;
        width: 21px; height: 21px;
        border-radius: 50%;
        border: 2px solid #aaffaa;
        "></div>`,
      // iconSize: [14, 14],
      // iconAnchor: [7, 7],
    });
  }

  private createAirlyIcon(): L.DivIcon {
    return L.divIcon({
      className: "gios-marker",
      html: `<div style="
        background-color: #ee0022;
        width: 21px;
        height: 21px;
        border-radius: 50%;
        border: 3px solid #ff8888;
        opacity: 0.8;"></div>`,
    });
  }

  private buildPopupContent(locations: any): string {
    const first = locations[0];
    const lat = first.lat.toFixed(5);
    const lon = first.lon.toFixed(5);

    const listItems = locations
      .map((loc:any) => `
        <li>
          <b>Source:</b> ${loc.source}<br>
          ${loc.id ? `<b>ID:</b> ${loc.id}<br>` : ''}
          ${loc.name ? `<b>Name:</b> ${loc.name}<br>` : ''}
        </li>
      `)
      .join('');

    return `
      <div>
        <b>Coordinates:</b> ${lat}, ${lon}<br>
        <ul style="padding-left: 16px; margin: 6px 0;">
          ${listItems}
        </ul>
      </div>
    `;
  }

  async loadMeasurements(point: any) {
    try {
      let url = "";

      if (point.source === "openaq" || point.source === "openaq" && point.source === "airly") {
        url = `http://localhost:3000/api/openaq/measurements?id=${point.id}`;
      } // else if (point.source === "aqicn") {
      //   url = `/api/aqicn/measurements?lat=${point.lat}&lon=${point.lon}`;
      // } else if (point.source === "gios") {
      //   url = `/api/gios/measurements?id=${point.id}`;
      // }
      else {
        this.measurements = [];
        this.stationTitle = "No measurements available";
        return;
      }

      const resp = await fetch(url);
      const data = await resp.json();
      this.measurements = data;
      this.stationTitle = point.name || point.source || "Station";

    } catch (err) {
      console.error("Load measurement error:", err);
    }
    // if (point.source === "openaq") {
    //   return fetch(`/api/openaq/latest?id=${point.id}`).then(res => res.json());
    // } else if (point.source === "aqicn") {
    //   return fetch(`/api/aqicn/measurements?lat=${point.lat}&lon=${point.lon}`).then(res => res.json());
    // } else if (point.source === "gios") {
    //   return fetch(`/api/gios/measurements?id=${point.id}`).then(res => res.json());
    // } else {
    //   this.measurements = [];
    //   this.stationTitle = "No measurements available";
    //   return;
    // }
  }
}




