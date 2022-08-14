import * as L from "https://unpkg.com/leaflet@1.8.0/dist/leaflet-src.esm.js";
const leafletCssUrl = "https://unpkg.com/leaflet@1.8.0/dist/leaflet.css";

const rootCss = `
.root {
  display: flex;
}
.side {
  display: none;
}
.container {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.map {
  flex: 9;
}
.control {
  position: relative;
  flex: 1;
  min-height: 10%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.graph {
  position: absolute;
  height: 50%;
  width: calc(90% - 1em);
  z-index: -1;
}
.slider {
  flex: 1;
  width: 90%;
  margin-left: 5%;
  margin-right: 5%;
  background-color: rgba(0, 0, 0, 0);
}
.home {
  -webkit-appearance: none;
  appearance: none;
}
.info-popup {
  font-size: 16px; 
  font-family: "Noto Mono", "Menlo", "Consolas", monospace !important;
}
.download {
  background-color: rgba(255, 255, 255, 0.7);
  padding: 10px;
}
`;

const LeafletGpx = class extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: "open"});
    const rootStyle = this.rootStyle = this.ownerDocument.createElement("style");
    rootStyle.textContent = rootCss;

    const root = this.ownerDocument.createElement("div");
    root.classList.add("root");
    const sideView = this.sideView = this.ownerDocument.createElement("div");
    sideView.classList.add("side");
    if (this.dataset.showSideView === "right") {
      sideView.style.display = "block";
      root.style.flexDirection = "row";
    } else if (this.dataset.showSideView === "left") {
      sideView.style.display = "block";
      root.style.flexDirection = "row-reverse";
    }
    
    const container = this.ownerDocument.createElement("div");
    container.classList.add("container");
    
    // size adjustment
    const style = window.getComputedStyle(this);
    [container.style.width, container.style.height] = [style.width, style.height];
    window.addEventListener("resize", ev => {
      // [NOTE] for resize fine when window shrinked, do removeProperty("height") 
      container.style.removeProperty("width");
      container.style.removeProperty("height");
      [container.style.width, container.style.height] = [style.width, style.height];
    });
    const mapDiv = this.ownerDocument.createElement("div");
    mapDiv.classList.add("map");
    //leaflet css
    const cssLink = this.ownerDocument.createElement("link");
    [cssLink.rel, cssLink.href] = ["stylesheet", leafletCssUrl];
    mapDiv.append(cssLink);

    const graph = this.graph = this.ownerDocument.createElement("canvas");
    graph.classList.add("graph");
    new ResizeObserver(entries => updateGraphs(this)).observe(graph);

    const slider = this.slider = this.ownerDocument.createElement("input");
    slider.classList.add("slider");
    slider.type = "range";
    slider.value = slider.min = slider.max = 0;
    slider.addEventListener("input", ev => {
      if (!this.cursor) return;
      this.cursor.setLatLng(this.infos[slider.value | 0].latlng);
      updateCursorInfo(this);
    });
    
    const homeSlider = this.homeSlider = this.ownerDocument.createElement("input");
    homeSlider.classList.add("slider", "home");
    homeSlider.type = "range";
    homeSlider.value = homeSlider.min = homeSlider.max = 0;
    homeSlider.addEventListener("input", ev => {
      if (!this.home) return;
      this.home.setLatLng(this.infos[homeSlider.value | 0].latlng);
      updateCursorInfo(this);
    });

    // bottom control area
    const control = this.ownerDocument.createElement("div");
    control.classList.add("control");
    if (this.dataset.hideControl === "true") {
      control.style.display = "none";
    }
    
    root.tabIndex = 0;
    root.addEventListener("keydown", ev => {
      // slider keybind
      if (!this.cursor) return;
      if (ev.code === "ArrowDown") {
        this.homeSlider.value = this.slider.value;
        this.home.setLatLng(this.infos[this.homeSlider.value | 0].latlng);
      } else if (ev.code === "ArrowUp") {
        this.slider.value = this.homeSlider.value;
      } else {
        const step = (ev.controlKey ? 10 : 1) * (ev.shiftKey ? 4 : 1) * (ev.altKey ? 3 : 1) * (ev.metaKey ? 2 : 1);
        const amount = ev.code === "ArrowRight" ? step : ev.code === "ArrowLeft" ? -step : 0;
        if (amount === 0) return;
        this.slider.value = Number(this.slider.value) + amount;
      }
      ev.preventDefault();
      this.cursor.setLatLng(this.infos[this.slider.value | 0].latlng);
      updateCursorInfo(this);
    });
    
    control.append(graph, slider, homeSlider);
    container.append(mapDiv, control);
    root.append(container, sideView);
    shadow.append(rootStyle, root);
    
    // bind leaflet map
    const map = this.map = L.map(mapDiv).setView([0, 0], 0);
    //this.map.locate({setView: true, maxZoom: 16});
  }
  connectedCallback() {
    if (!this.tile) {
      const tileTemplate = this.dataset.tileTemplate ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      const attribution = this.dataset.attribution ?? `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`;
      this.tile = L.tileLayer(tileTemplate, {attribution}).addTo(this.map);
    }
    if (this.dataset.popupFontSize) {
      this.rootStyle.textContent += `.info-popup {font-size: ${this.dataset.popupFontSize}`;
    }
    if (this.layer) return;
    if (this.dataset.src) {
      loadGpxFromUrl(this.dataset.src).then(xml => this.setGpx(xml, this.dataset)).catch(console.error);
    } else if (this.dataset.ipfsCid) {
      loadGpxFromCid(this.dataset.ipfsCid).then(xml => this.setGpx(xml, this.dataset)).catch(console.error);
    }
  }
  clearGpx() {
    if (!this.layer) return;
    this.layer.remove();
    this.control.remove();
    this.cursor.remove();
    this.home.remove();
    this.layer = this.cursor = this.control = this.home = null;
    this.slider.value = this.homeSlider.value = this.slider.max = this.homeSlider.max = 0;
    this.infos = this.segTrees = null;
    updateGraphs(this);
    return this;
  }
  setGpx(xml, dataset = this.dataset) {
    return this.setGpxPath(this.createGpxPath(xml, dataset), dataset);
  }
  
  createGpxPath(xml, dataset = this.dataset) {
    const gpx = new DOMParser().parseFromString(xml, "application/xml");
    const infos = gpxInfo(gpx);
    const minSpeedTree = createMinSpeedTree(infos);
    const maxSpeedTree = createMaxSpeedTree(infos);
    const maxEleTree = createMaxEleTree(infos);
    const minEleTree = createMinEleTree(infos);
    const segTrees = {minSpeedTree, maxSpeedTree, maxEleTree, minEleTree};
    const dataSpan = Math.trunc(dataset.infoSpan);
    const dataSize = Number(dataset.infoSize);
    const dataColors = dataset.infoColors?.split(",")?.map(c => c.trim()) ?? [];
    const span = dataSpan > 0 ? dataSpan : 60;
    const size = dataSize > 0 ? dataSize : 10;
    const colors = dataColors.length > 0 ? dataColors : ["cyan", "magenta"];
    const layer = createGpxLayer(infos, segTrees, {span, size, colors}, dataset);
    return {layer, gpx, xml, infos, segTrees};
  }
  setGpxPath({layer, gpx, xml, infos, maxSpeedTree, segTrees}, dataset = this.dataset) {
    this.clearGpx();
    if (infos.length === 0) return this;
    [this.layer, this.infos, this.segTrees] = [layer, infos, segTrees]; 
    this.slider.value = this.homeSlider.value = 0;
    this.slider.max = this.homeSlider.max = this.infos.length - 1;
    this.layer.addTo(this.map);
    this.map.fitBounds(this.layer.getBounds());
    updateGraphs(this);

    const cursorText = dataset.cursorText ?? "&#x1f3c3;";
    const homeText = dataset.homeText ?? "&#x1f3e0;";
    const cursorSize = dataset.cursorSize && Number.isFinite(+dataset.cursorSize) && +dataset.cursorSize > 0 ? +dataset.cursorSize : 30;
    const {cursor, home} = createCursorHome(infos, segTrees, {cursorText, homeText, cursorSize});
    this.cursor = cursor.addTo(this.map);
    this.home = home.addTo(this.map);
    this.control = createDownloadLink(this, gpx, xml);
    if (!dataset.hideDownload) this.control.addTo(this.map);
    return this;
  }
  
  getCursor() {
    return {cursor: Number(this.slider.value), home: Number(this.homeSlider.value)};
  }
  setCursor({cursor, home} = {}) {
    if (!this.cursor) return;
    if (home !== undefined) {
      const value = Math.min(Math.max(0, Number(home)), Number(this.homeSlider.max));
      this.homeSlider.value = value
      this.home.setLatLng(this.infos[value].latlng);
    }
    if (cursor !== undefined) {
      const value = Math.min(Math.max(0, Number(cursor)), Number(this.slider.max));
      this.slider.value = value;
      this.cursor.setLatLng(this.infos[value].latlng);      
    }
    updateCursorInfo(this);
    return this;
  }
};

const updateCursorInfo = self => {
  const content = infoPopup(self.infos, self.segTrees, self.slider.value | 0, self.homeSlider.value | 0);
  self.sideView.innerHTML = `<div style="padding: 1em;">${content}</div>`;
  self.cursor.setPopupContent(content);
  if(self.dataset.fixedCenter !== "true") self.map.setView(self.cursor.getLatLng(), self.map.getZoom());
  if (!["left", "right", "hide"].includes(self.dataset.showSideView)) self.cursor.openPopup();
  updateGraphs(self);
  self.dispatchEvent(new CustomEvent("cursor-changed", {detail: self.getCursor()}));
};


// gpx xml resolvers
const loadGpxFromUrl = async url => {
  const res = await fetch(url);
  if (!res.ok) throw res;
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
    info.speed = Number.isFinite(info.speed) ? info.speed :  i === 0 ? 0 : 1000 * info.latlng.distanceTo(infos[i - 1].latlng) / (info.date.getTime() - infos[i - 1].date.getTime());
    info.time = info.date.getTime() - infos[0].date.getTime();
    info.moving = i === 0 ? 0 : infos[i - 1].moving + (info.speed > 0 ? info.date.getTime() - infos[i - 1].date.getTime() : 0);
    info.angle = i === 0 ? null : direction(infos[i - 1].latlng, info.latlng);
    info.minSpeed = i === 0 ? info.speed : Math.min(infos[i - 1].minSpeed, info.speed);
    info.maxSpeed = i === 0 ? info.speed : Math.max(infos[i - 1].maxSpeed, info.speed);
    info.maxEle = i === 0 ? info.ele : Math.max(infos[i - 1].maxEle, info.ele);
    info.minEle = i === 0 ? info.ele : Math.min(infos[i - 1].minEle, info.ele);
    info.lpEle = i === 0 ? info.ele : infos[i - 1].lpEle * 0.95 + info.ele * 0.05; // low-pass 1/20
    info.elePlus = i === 0 ? 0 : infos[i - 1].elePlus + (info.speed > 0 && infos[i - 1].lpEle < info.lpEle ? info.lpEle - infos[i - 1].lpEle : 0);
    info.eleMinus = i === 0 ? 0 : infos[i - 1].eleMinus + (info.speed > 0 && infos[i - 1].lpEle > info.lpEle ? infos[i - 1].lpEle - info.lpEle : 0);
  });
  return infos;
}; 

// direction and destination: the Earth as a sphere model
const direction = (from, to) => {
  if (to.lat === from.lat && to.lng === from.lng) return null;
  const {PI, sin, cos, atan2} = Math, rad = PI / 180;
  const p1 = from.lat * rad, p2 = to.lat * rad, q1 = from.lng * rad, q2 = to.lng * rad;
  const dq = q2 - q1, cosP1 = cos(p1), sinP1 = sin(p1), cosP2 = cos(p2), sinP2 = sin(p2);
  const y = cosP2 * sin(dq);
  const z = cosP1 * sinP2 - sinP1 * cosP2 * cos(dq);
  return atan2(y, z);
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

// binary tree of the max value for maxSpeed search
const createSegTree = (values, start, last, binOp, uniOp = v => v) => {
  const length = last - start;
  if (length === 0) return {start, last};
  if (length === 1) return {v: uniOp(values[start]), start, last};
  const mid = start + (length >> 1);
  const left = createSegTree(values, start, mid, binOp, uniOp);
  const right = createSegTree(values, mid, last, binOp, uniOp);
  return {v: binOp(left.v, right.v), start, last, left, right};
};
const getSegValue = (tree, start, last, binOp, empty) => {
  if (start <= tree.start && tree.last <= last) return tree.v; // when tree is complete inside
  if (last <= tree.start || tree.last <= start) return empty; // when tree is complete outside
  return binOp(getSegValue(tree.left, start, last, binOp, empty), getSegValue(tree.right, start, last, binOp, empty));
};
const createMinSpeedTree = (infos) => createSegTree(infos.map(({speed}) => speed), 0, infos.length, Math.min);
const getMinSpeed = (tree, start, last) => getSegValue(tree, start, last, Math.min, Infinity);
const createMaxSpeedTree = (infos) => createSegTree(infos.map(({speed}) => speed), 0, infos.length, Math.max);
const getMaxSpeed = (tree, start, last) => getSegValue(tree, start, last, Math.max, 0);
const createMaxEleTree = (infos) => createSegTree(infos.map(({ele}) => ele), 0, infos.length, Math.max);
const getMaxEle = (tree, start, last) => getSegValue(tree, start, last, Math.max, -Infinity);
const createMinEleTree = (infos) => createSegTree(infos.map(({ele}) => ele), 0, infos.length, Math.min);
const getMinEle = (tree, start, last) => getSegValue(tree, start, last, Math.min, Infinity);

// text formatters
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
const angleNf = new Intl.NumberFormat(undefined, {
  unit: "degree", style: "unit", unitDisplay: "narrow",
  maximumFractionDigits: 0});
const toClock = angle => {
  const arrowChar = "&#x2b06;";
  if (!Number.isFinite(angle)) {
    const arrow = `<span style="display: inline-block;">${arrowChar}</span>`;
    return `${arrow} ${"".padStart(2)}:${"".padStart(2)} (${"".padStart(5)})`;
  } else {
    const degree = angle / Math.PI * 180;
    const minutes = ((angle / Math.PI + 2) % 2) * 6 * 60;
    const m = Math.round(minutes % 60), h0 = Math.trunc(minutes / 60), h = h0 === 0 ? 12 : h0;
    const arrow = `<span style="display: inline-block; transform: rotate3d(0, 0, 1, ${degree}deg);">${arrowChar}</span>`;
    return `${arrow} ${h.toString().padStart(2)}:${m.toString().padStart(2, "0")} (${angleNf.format(degree).padStart(5)})`;
  }
};

// cursor => home ordering is as a hole of total loop
const findMinSpeed = (infos, minSpeedTree, index, baseIndex) => {
  if (baseIndex === 0) return infos[index].minSpeed;
  if (index === baseIndex) return infos[index].speed;
  if (baseIndex <= index) return getMinSpeed(minSpeedTree, baseIndex, index + 1);
  return Math.min(getMinSpeed(minSpeedTree, 0, index + 1), getMinSpeed(minSpeedTree, baseIndex, infos.length));
};
const findMaxSpeed = (infos, maxSpeedTree, index, baseIndex) => {
  if (baseIndex === 0) return infos[index].maxSpeed;
  if (index === baseIndex) return infos[index].speed;
  if (baseIndex <= index) return getMaxSpeed(maxSpeedTree, baseIndex, index + 1);
  return Math.max(getMaxSpeed(maxSpeedTree, 0, index + 1), getMaxSpeed(maxSpeedTree, baseIndex, infos.length));
};
const findMaxEle = (infos, maxEleTree, index, baseIndex) => {
  if (baseIndex === 0) return infos[index].maxEle;
  if (index === baseIndex) return infos[index].ele;
  if (baseIndex <= index) return getMaxEle(maxEleTree, baseIndex, index + 1);
  return Math.max(getMaxEle(maxEleTree, 0, index + 1), getMaxEle(maxEleTree, baseIndex, infos.length));
};
const findMinEle = (infos, minEleTree, index, baseIndex) => {
  if (baseIndex === 0) return infos[index].minEle;
  if (index === baseIndex) return infos[index].ele;
  if (baseIndex <= index) return getMinEle(minEleTree, baseIndex, index + 1);
  return Math.max(getMinEle(minEleTree, 0, index + 1), getMinEle(minEleTree, baseIndex, infos.length));
};

// Leaflet UI
const infoPopup = (infos, segTrees, index, baseIndex = 0) => {
  const isSpan = baseIndex <= index;
  const info = infos[index], base = infos[baseIndex], last = infos[infos.length - 1];
  const {latlng, date, speed, ele, angle} = info;
  const minSpeed = findMinSpeed(infos, segTrees.minSpeedTree, index, baseIndex);
  const maxSpeed = findMaxSpeed(infos, segTrees.maxSpeedTree, index, baseIndex);
  const maxEle = findMaxEle(infos, segTrees.maxEleTree, index, baseIndex);
  const minEle = findMinEle(infos, segTrees.minEleTree, index, baseIndex);
  const distance = isSpan ? info.distance - base.distance : info.distance + last.distance - base.distance;
  const time = isSpan ? info.time - base.time : info.time + last.time - base.time;
  const moving = isSpan ? info.moving - base.moving : info.moving + last.moving - base.moving;
  const elePlus = isSpan ? info.elePlus - base.elePlus : info.elePlus + last.elePlus - base.elePlus;
  const eleMinus = isSpan ? info.eleMinus - base.eleMinus : info.eleMinus + last.eleMinus - base.eleMinus;
  const lat = Math.abs(latlng.lat), lng = Math.abs(latlng.lng);
  const ns = "NS"[Number(Math.sign(latlng.lat) < 0)], ew = "EW"[Number(Math.sign(latlng.lng) < 0)];
  const total = msecToTime(time);
  const totalTime = timeText(total);
  const movingTotal = msecToTime(moving);
  const movingTime = timeText(movingTotal);
  const totalAve = time === 0 ? 0 : distance / time * 1000;
  const movingAve = moving === 0 ? 0 : distance / moving * 1000;

  const speedRate = !Number.isFinite(speed) || segTrees.maxSpeedTree.v === 0 ? 0 : speed / segTrees.maxSpeedTree.v;
  const speedBar = `<span style="position: absolute; height: 100%; background-color: hsla(${60 + 240 * speedRate}, 75%, 50%, 0.5); font-size: inherit; width: ${speedRate * 10}em;"></span>`;
  const dir = direction(base.latlng, latlng);
  const straight = base.latlng.distanceTo(latlng);
  const labels = [
    `<span class="info-lat">${ns}${degreeNf.format(lat).padStart(11)}</span> <span class="info-lng">${ew}${degreeNf.format(lng).padStart(11)}</span>`,
    "",
    `move toward    : <span class="info-toward">${toClock(angle)}</span>`,
    Number.isFinite(speed) ? `speed          : <span class="info-speed"><span style="position: relative;">${speedBar}<span style="position: absolute;">${speedNf.format(speed * 3.6).padStart(9)}/h</span></span></span>` : "",
    Number.isFinite(ele) ? `elevation      : <span class="info-ele">${eleNf.format(ele).padStart(8)}</span>` : "",
    "",
    Number.isFinite(distance) ? `moving distance: <span class="info-distance">${distanceNf.format(distance / 1000).padStart(9)}</span>` : "",
    Number.isFinite(total.s) ? `total time     : <span class="info-total-time">${totalTime.padStart(9)}</span>` : "",
    Number.isFinite(movingTotal.s) ? `moving time    : <span class="info-moving-time">${movingTime.padStart(9)}</span>` : "",
    Number.isFinite(totalAve) ? `total ave      : <span class="info-total-ave">${speedNf.format(totalAve * 3.6).padStart(9)}/h</span>` : "",
    Number.isFinite(movingAve) ? `moving ave     : <span class="info-moving-ave">${speedNf.format(movingAve * 3.6).padStart(9)}/h</span>` : "",
    Number.isFinite(elePlus) ? `elevation+     : <span class="info-ele-plus">+${eleNf.format(elePlus).padStart(7)}</span>` : "",
    Number.isFinite(eleMinus) ? `elevation-     : <span class="info-ele-minus">-${eleNf.format(eleMinus).padStart(7)}</span>` : "",
    "",
    Number.isFinite(minSpeed) ? `min speed      : <span class="info-min-speed">${speedNf.format(minSpeed * 3.6).padStart(9)}/h</span>` : "",
    Number.isFinite(maxSpeed) ? `max speed      : <span class="info-max-speed">${speedNf.format(maxSpeed * 3.6).padStart(9)}/h</span>` : "",
    Number.isFinite(minEle) ? `min elevation  :  <span class="info-min-ele">${eleNf.format(minEle).padStart(7)}</span>` : "",
    Number.isFinite(maxEle) ? `max elevation  :  <span class="info-max-ele">${eleNf.format(maxEle).padStart(7)}</span>` : "",
    "",
    `bearing        : <span class="info-bearing">${toClock(dir)}</span>`,
    `direct length  : <span class="info-length">${distanceNf.format(straight / 1000).padStart(9)}</span>`,    
    "",
    Number.isFinite(date.getTime()) ? `        <span class="info-date">${date.toLocaleString()}</span>` : "",
  ].join("\n");
  return `<pre class="info-popup">${labels}</pre>`;
};
const infoMark = (latlng, angle, color, size) => {
  if (angle === null) return L.circle(latlng, {color, radius: size});
  const leftAngle = angle + Math.PI - Math.PI / 4;
  const rightAngle = angle + Math.PI + Math.PI / 4;
  const left = destination(latlng, leftAngle, size);
  const right = destination(latlng, rightAngle, size);
  const top = destination(latlng, angle, size);
  return L.polygon([left, latlng, right, top], {color}); // as arrow head
};
const infoMarkArrow = (latlng, angle, color, size) => {
  const iconSize = [0, 0], iconAnchor = [size / 2, size * 0.8], popupAnchor = [0, -size / 2];
  const cursorText = "&#x27a4;";
  const deg = angle * 180 / Math.PI - 90;
  const style = `display: inline-block; font-weight: bold; font-size: ${size}px; color: ${color}; transform: rotate3d(0, 0, 1, ${deg}deg);`;
  return L.marker(latlng, {
    icon: L.divIcon({html: `<span style="${style}">${cursorText}</span>`, iconSize, iconAnchor, popupAnchor}),
  });
};
const createGpxLayer = (infos, segTrees, {span = 60, size = 10, colors = ["cyan", "magenta"]} = {}, dataset = {}) => {
  // path
  const layer = L.featureGroup()
  const coords = infos.map(({latlng}) => latlng);
  const path = L.polyline(coords, {color: "blue", weight: 5, opacity: 0.5}).addTo(layer);
  
  // info popup
  const picked = infos.filter((info, i) => i % span === 0 || i === infos.length - 1);
  const colorFactor = colors.length / infos.length;
  infos.forEach((info, i) => {
    if (i % span !== 0 && i !== infos.length - 1) return;
    const color = colors[Math.trunc(i * colorFactor)];
    //const mark = infoMark(info.latlng, info.angle, color, size);
    const mark = infoMarkArrow(info.latlng, info.angle, color, size);
    mark.addTo(layer).
      on("mouseover", ev => {
        if (!["left", "right", "hide"].includes(dataset.showSideView)) ev.target.openPopup();
      }).on("mouseout", ev => ev.target.closePopup()).
      on("mousedown", ev => {
        if (!["left", "right", "hide"].includes(dataset.showSideView)) ev.target.openPopup();
      }).
      bindPopup(infoPopup(infos, segTrees, i));
  });
  return layer;
};

const createCursorHome = (infos, segTrees, {cursorText, homeText, cursorSize = 30}) => {
  const iconSize = [0, 0], iconAnchor = [cursorSize / 2, cursorSize], popupAnchor = [0, -cursorSize / 2];
  const style = `font-size: ${cursorSize}px; vertical-slign: middle;`;
  const cursor = L.marker(infos[0].latlng, {
    icon: L.divIcon({html: `<span style="${style}">${cursorText}</span>`, iconSize, iconAnchor, popupAnchor}),
    zIndexOffset: 200,
  }).bindPopup(infoPopup(infos, segTrees, 0));
  const home = L.marker(infos[0].latlng, {
    icon: L.divIcon({html: `<span style="${style}">${homeText}</span>`, iconSize, iconAnchor, popupAnchor}),
    zIndexOffset: -1000,
  });
  return {cursor, home};
};

const createDownloadLink = (elem, gpx, xml) => {
  const name = gpx.querySelector("name")?.textContent?.replaceAll(/[ :]/g, "_") ?? "untitled";
  const fileName = `${name}.gpx`;
  const dataUrl = `data:application/xml,${encodeURIComponent(xml)}`;
  const download = elem.ownerDocument.createElement("a");
  download.classList.add("download");
  download.download = fileName;
  download.href = dataUrl;
  download.textContent = "Download GPX file";

  const DownloadControl = L.Control.extend({
    onAdd(map) {
      return download;
    }
  });
  return new DownloadControl();
};

// Graph
const updateGraphs = self => {
  const {graph, infos} = self;
  const c2d = graph.getContext("2d");
  c2d.save();
  c2d.scale(graph.width, graph.height);
  c2d.clearRect(0, 0, 1, 1);
  if (infos) {
    c2d.fillStyle = "hsla(240, 75%, 50%, 0.25)";
    const cursor = self.slider.value / (infos.length - 1), home = self.homeSlider.value / (infos.length - 1);
    if (home <= cursor) {
      c2d.fillRect(home, 0, cursor - home, 1);
    } else {
      c2d.fillRect(0, 0, cursor, 1);
      c2d.fillRect(home, 0, 1 - home, 1);
    }
    c2d.fillStyle = "hsla(30, 75%, 50%, 0.75)";
    drawGraph(c2d, infos.map(({ele}) => ele));
  }
  c2d.restore();
};
const drawGraph = (c2d, values) => {
  let max = -Infinity, min = Infinity;
  for (const v of values) [max, min] = [Math.max(max, v), Math.min(min, v)];
  const scale = max - min;
  if (scale === 0) return;
  c2d.beginPath();
  c2d.moveTo(0, 1);
  for (let i = 0; i < values.length; i++) {
    const x = i / (values.length - 1), y = 1 - (values[i] - min) / scale;
    c2d.lineTo(x, y);
  }
  c2d.lineTo(1, 1);
  c2d.closePath();
  c2d.fill();
};


// must register at last
customElements.define("leaflet-gpx", LeafletGpx, {});
