import * as L from "https://unpkg.com/leaflet@1.7.1/dist/leaflet-src.esm.js";

const LeafletGpx = class extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: "open"});

    const container = this.ownerDocument.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    
    // size adjustment
    const style = window.getComputedStyle(this);
    [container.style.width, container.style.height] = [style.width, style.height];
    window.addEventListener("resize", ev => {
      [container.style.width, container.style.height] = [style.width, style.height];      
    });
    
    const mapDiv = this.ownerDocument.createElement("div");
    mapDiv.style.flex = "1";

    const control = this.ownerDocument.createElement("div");
    control.style.minHeight = "5vh";
    control.style.display = "flex";
    control.style.alignItems = "center";
    control.style.justifyContent = "center";
    
    const slider = this.slider = this.ownerDocument.createElement("input");
    slider.style.flex = "1";
    slider.style.marginLeft = slider.style.marginRight = "5vw";
    slider.type = "range";
    slider.value = 0;
    slider.min = 0;
    slider.max = 0;
    control.append(slider);
    slider.addEventListener("input", ev => {
      if (!this.cursor) return;
      const info = this.infos[slider.value | 0];
      this.cursor.setLatLng(info.latlng);
      this.cursor.setPopupContent(infoPopup(info));
      this.cursor.openPopup();
      this.map.setView(info.latlng, this.map.getZoom());
    });

    // keybind
    control.tabIndex = 0;
    control.addEventListener("keydown", ev => {
      if (!this.cursor) return;
      const amount = (() => {
        const amount = (ev.controlKey ? 4 : 1) * (ev.shiftKey ? 10 : 1) * (ev.altKey ? 3 : 1) * (ev.metaKey ? 2 : 1);
        switch (ev.code) {
        case "ArrowLeft": return -amount;
        case "ArrowRight": return amount;
        }
        return 0;
      })();
      if (amount === 0) return;
      ev.preventDefault();
      this.slider.value = Number(this.slider.value) + amount;
      const info = this.infos[this.slider.value | 0];
      this.cursor.setLatLng(info.latlng);
      this.cursor.setPopupContent(infoPopup(info));
      this.cursor.openPopup();
      this.map.setView(info.latlng, this.map.getZoom());
    });
    
    //leaflet css
    const cssLink = this.ownerDocument.createElement("link");
    [cssLink.rel, cssLink.href] = ["stylesheet", "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"];
    mapDiv.append(cssLink);
    container.append(mapDiv);
    container.append(control);
    shadow.append(container);

    const map = this.map = L.map(mapDiv);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`,
    }).addTo(map);
  }
  connectedCallback() {
    if (this.layer) return;  
    if (this.dataset.src) {
      loadGpxFromUrl(this.dataset.src).then(xml => this.setGpx(xml, this.dataset), error => {
        this.map.setView([0, 0], 0);
        throw error;
      }).catch(console.error);
    } else if (this.dataset.ipfsCid) {
      loadGpxFromCid(this.dataset.ipfsCid).then(xml => this.setGpx(xml, this.dataset), error => {
        this.map.setView([0, 0], 0);
        throw error;
      }).catch(console.error);
    } else {
      //this.map.locate({setView: true, maxZoom: 16});
      this.map.setView([0, 0], 0);
    }
  }
  setGpx(xml, dataset = this.dataset) {
    if (this.layer) {
      this.layer.remove();
      this.cursor.remove();
      this.control.remove();
    }
    const dataSpan = Math.trunc(dataset.infoSpan);
    const dataSize = Number(dataset.infoSize);
    const dataColors = dataset.infoColors?.split(",")?.map(c => c.trim()) ?? [];
    const span = dataSpan > 0 ? dataSpan : 60;
    const size = dataSpan > 0 ? dataSize : 10;
    const colors = dataColors.length > 0 ? dataColors : ["cyan", "magenta"];
    const cursorText = dataset.cursorText ?? "&#x1f3c3;";
    const gpx = new DOMParser().parseFromString(xml, "application/xml");
    this.infos = gpxInfo(gpx);
    this.slider.value = 0;
    this.slider.max = this.infos.length - 1;
    this.layer = setGpx(this.map, this.infos, {span, size, colors});
    //this.cursor = L.circleMarker(this.infos[0].latlng, {radius: 10, color: "black"}).addTo(this.map).bindPopup(infoPopup(this.infos[0]));
    this.cursor = L.marker(this.infos[0].latlng, {icon: L.divIcon({
      html: `<span style="font-size: 30px; vertical-slign: middle;">${cursorText}</span>`,
      iconSize: [0, 0],
      iconAnchor: [15, 30],
      popupAnchor: [0, -15],
    })}).addTo(this.layer).bindPopup(infoPopup(this.infos[0]));
    this.control = setDownloadLink(this.map, gpx, xml);
  }
};


const loadGpxFromUrl = async url => {
  const res = await fetch(url);
  return await res.text();
};
const loadGpxFromCid = async cid => {
  const ipfsCdn = "https://unpkg.com/ipfs@0.58.6/dist/index.min.js"; // the last version that contains CND dist js
  const mod = await import(ipfsCdn);
  const node = await Ipfs.create({repo: `tmp-${Math.random()}`});
  const decoder = new TextDecoder(), texts = [];
  for await (const chunk of node.cat(cid)) texts.push(decoder.decode(chunk, {stream: true}));
  return texts.join("");
};

const gpxInfo = gpx => {
  const infos = [...gpx.querySelectorAll("trkpt")].map(trkpt => ({
    latlng: new L.LatLng(Number(trkpt.getAttribute("lat")), Number(trkpt.getAttribute("lon"))),
    date: new Date(trkpt.querySelector("time")?.textContent),
    speed: Number(trkpt.querySelector("speed")?.textContent),
    ele: Number(trkpt.querySelector("ele")?.textContent),
    sat: Number(trkpt.querySelector("sat")?.textContent),
  }));
  infos.forEach((info, i) => {
    info.distance = i === 0 ? 0 : infos[i - 1].distance + info.latlng.distanceTo(infos[i - 1].latlng);
    info.speed ??= i === 0 ? 0 : 1000 * info.latlng.distanceTo(infos[i - 1].latlng) / (info.date.getTime() - infos[i - 1].date.getTime());
    info.time = info.date.getTime() - infos[0].date.getTime();
    info.moving = i === 0 ? 0 : infos[i - 1].moving + (info.speed > 0 ? info.date.getTime() - infos[i - 1].date.getTime() : 0);
    info.angle = i === 0 ? null : direction(info.latlng, infos[i - 1].latlng);
    info.maxSpeed = i === 0 ? 0 : Math.max(infos[i - 1].maxSpeed, info.speed);
    info.lpEle = i === 0 ? info.ele : infos[i - 1].lpEle * 0.95 + info.ele * 0.05; // low-pass 1/20
    info.elePlus = i === 0 ? 0 : infos[i - 1].elePlus + (info.speed > 0 && infos[i - 1].lpEle < info.lpEle ? info.lpEle - infos[i - 1].lpEle : 0);
    info.eleMinus = i === 0 ? 0 : infos[i - 1].eleMinus + (info.speed > 0 && infos[i - 1].lpEle > info.lpEle ? infos[i - 1].lpEle - info.lpEle : 0);
  });
  return infos;
}; 

const direction = (from, to) => {
  if (to.lat === from.lat && to.lng === from.lng) return null;
  const {PI, sin, cos, atan2} = Math, rad = PI / 180;
  const p1 = from.lat * rad, p2 = to.lat * rad, q1 = from.lng * rad, q2 = to.lng * rad;
  const dq = q2 - q1, cosP1 = cos(p1), sinP1 = sin(p1), cosP2 = cos(p2), sinP2 = sin(p2);
  const y = cosP2 * sin(dq);
  const z = cosP1 * sinP2 - sinP1 * cosP2 * cos(dq);
  return atan2(y, z);
};

const msecToTime = msec => {
  const ms = msec % 1000;
  const sec = (msec - ms) / 1000;
  const s = sec % 60;
  const minute = (sec - s) / 60;
  const m = minute % 60;
  const h = (minute - m) / 60;
  return {h, m, s, ms};
};
const timeText = ({h, m, s, ms}) => {
  return `${h.toString().padStart(2)}h${m.toString().padStart(2, "0")}m${s.toString().padStart(2, "0")}s`;  
};

const infoMark = (latlng, angle, color, size) => {
  if (angle === null) return L.circle(latlng, {color, radius: size});
  const leftAngle = angle - Math.PI / 9;
  const rightAngle = angle + Math.PI / 9;
  const left = destination(latlng, leftAngle, size * 2);
  const right = destination(latlng, rightAngle, size * 2);
  return L.polygon([left, latlng, right], {color});
};
const destination = ({lat, lng}, angle, distance) => {
  const {PI, sin, cos, asin, atan2} = Math, r = 6371000, rad = PI / 180;
  const d = distance / r, p1 = lat * rad, q1 = lng * rad;
  const cosP1 = cos(p1), sinP1 = sin(p1), cosD = cos(d), sinD = sin(d);
  const sinP2 = sinP1 * cosD + cosP1 * sinD * cos(angle);
  const p2 = asin(sinP2);
  const q2 = q1 + atan2(cosP1 * sinD * sin(angle), cosD - sinP1 * sinP2);
  return new L.LatLng(p2 / rad, q2 / rad);
};

const degreeNf = new Intl.NumberFormat(undefined, {
  unit: "degree", style: "unit", unitDisplay: "narrow",
  maximumFractionDigits: 6, minimumFractionDigits: 6});
const speedNf = new Intl.NumberFormat(undefined, {
  unit: "kilometer", style: "unit", unitDisplay: "narrow",
  maximumFractionDigits: 1, minimumFractionDigits: 1});
const eleNf = new Intl.NumberFormat(undefined, {
  unit: "meter", style: "unit", unitDisplay: "narrow",
  maximumFractionDigits: 2, minimumFractionDigits: 2});
const distanceNf = new Intl.NumberFormat(undefined, {
  unit: "kilometer", style: "unit", unitDisplay: "narrow",
  maximumFractionDigits: 3, minimumFractionDigits: 3});
  
const infoPopup = ({latlng, date, speed, ele, distance, time, moving, angle, maxSpeed, elePlus, eleMinus}) => {
  const lat = Math.abs(latlng.lat), lng = Math.abs(latlng.lng);
  const ns = "NS"[Number(Math.sign(latlng.lat) < 0)], ew = "EW"[Number(Math.sign(latlng.lng) < 0)];
  const total = msecToTime(time);
  const totalTime = timeText(total);
  const movingTotal = msecToTime(moving);
  const movingTime = timeText(movingTotal);
  const totalAve = time === 0 ? 0 : distance / time * 1000;
  const movingAve = moving === 0 ? 0 : distance / moving * 1000;
  const labels = [
    `${ns}${degreeNf.format(lat).padStart(11)} ${ew}${degreeNf.format(lng).padStart(11)}\n`,
    Number.isFinite(speed) ? `speed      : ${speedNf.format(speed * 3.6).padStart(9)}/h` : "",
    Number.isFinite(ele) ?  `elevation  : ${eleNf.format(ele).padStart(8)}` : "",
    Number.isFinite(distance) ? `distance   : ${distanceNf.format(distance / 1000).padStart(9)}` : "",
    Number.isFinite(total.s) ? `total time : ${totalTime.padStart(9)}` : "",
    Number.isFinite(movingTotal.s) ? `moving time: ${movingTime.padStart(9)}` : "",
    Number.isFinite(totalAve) ? `total ave  : ${speedNf.format(totalAve * 3.6).padStart(9)}/h` : "",
    Number.isFinite(movingAve) ? `moving ave : ${speedNf.format(movingAve * 3.6).padStart(9)}/h` : "",
    Number.isFinite(maxSpeed) ? `max speed  : ${speedNf.format(maxSpeed * 3.6).padStart(9)}/h` : "",
    Number.isFinite(elePlus) ?  `elevation+ : +${eleNf.format(elePlus).padStart(7)}` : "",
    Number.isFinite(eleMinus) ?  `elevation- : -${eleNf.format(eleMinus).padStart(7)}` : "",
    Number.isFinite(date.getTime()) ? `\n        ${date.toLocaleString()}` : "",
  ].filter(e => e).join("\n");
  return `<pre style='font-size: 12px; font-family: "Noto Mono", "Menlo", "Consolas", monospace !important;'>${labels}</pre>`;
};

const setGpx = (map, infos, {span = 60, size = 10, colors = ["cyan", "magenta"]} = {}) => {
  // path
  const layer = L.layerGroup().addTo(map);
  const coords = infos.map(({latlng}) => latlng);
  const path = L.polyline(coords, {color: "blue", weight: 5, opacity: 0.5}).addTo(layer);

  map.fitBounds(path.getBounds());

  // info popup
  const picked = infos.filter((info, i) => i % span === 0 || i === infos.length - 1);
  const colorFactor = colors.length / picked.length;
  picked.forEach((info, i) => {
    const color = colors[Math.trunc(i * colorFactor)];
    const mark = infoMark(info.latlng, info.angle, color, size);
    mark.addTo(layer).
      on("mouseover", ev => ev.target.openPopup()).on("mouseout", ev => ev.target.closePopup()).
      on("mousedown", ev => ev.target.openPopup()).
      bindPopup(infoPopup(info));
  });
  return layer;
};

const setDownloadLink = (map, gpx, xml) => {
  const name = gpx.querySelector("name")?.textContent?.replaceAll(/[ :]/g, "_") ?? "untitled";
  const fileName = `${name}.gpx`;
  const dataUrl = `data:application/xml,${encodeURIComponent(xml)}`;
  const download = document.createElement("a");
  download.download = fileName;
  download.href = dataUrl;
  download.textContent = "Download GPX file";
  download.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
  download.style.padding = "1vmin";
  const DownloadControl = L.Control.extend({
    onAdd(map) {
      return download;
    }
  });
  const control = new DownloadControl().addTo(map);
  return control;
};

// must register at last
customElements.define("leaflet-gpx", LeafletGpx, {});
