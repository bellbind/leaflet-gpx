import * as L from "https://unpkg.com/leaflet@1.8.0/dist/leaflet-src.esm.js";

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
    //const mapStyle = window.getComputedStyle(mapDiv);
    new ResizeObserver(() => {
      this.map.invalidateSize(true);
    }).observe(mapDiv);
    mapDiv.style.flex = "9";

    const control = this.ownerDocument.createElement("div");
    mapDiv.style.flex = "1";
    control.style.minHeight = "10%";
    control.style.display = "flex";
    control.style.alignItems = "center";
    control.style.justifyContent = "center";
    control.style.flexDirection = "column";

    const graph = this.graph = document.createElement("canvas");
    graph.style.position = "absolute";
    graph.style.height = "5%";
    graph.style.width = "90%";
    graph.style.zIndex = "-1";
    bindGraph(this);
    control.append(graph);
    
    const slider = this.slider = this.ownerDocument.createElement("input");
    slider.style.flex = "1";
    slider.style.width = "90%";
    
    slider.style.marginLeft = slider.style.marginRight = "5%";
    slider.style.backgroundColor = "rgba(0, 0, 0, 0)";
    
    slider.type = "range";
    slider.value = slider.min = slider.max = 0;
    control.append(slider);
    slider.addEventListener("input", ev => {
      if (!this.cursor) return;
      const info = this.infos[slider.value | 0];
      this.cursor.setLatLng(info.latlng);
      this.cursor.setPopupContent(infoPopup(this.infos, this.segTrees, slider.value | 0, homeSlider.value | 0));
      this.map.setView(info.latlng, this.map.getZoom());
      this.cursor.openPopup();
      drawGraphs(this);
      this.dispatchEvent(new CustomEvent("cursor-changed", {detail: this.getCursor()}));
    });

    // home
    const homeSlider = this.homeSlider = this.ownerDocument.createElement("input");
    homeSlider.style.flex = "1";
    homeSlider.style.width = "90%";
    homeSlider.style.webkitAppearance = "none"; 
    homeSlider.style.backgroundColor = "rgba(0, 0, 0, 0)";
    
    homeSlider.style.marginLeft = homeSlider.style.marginRight = "5%";
    homeSlider.type = "range";
    homeSlider.value = homeSlider.min = homeSlider.max = 0;
    control.append(homeSlider);
    homeSlider.addEventListener("input", ev => {
      if (!this.home) return;
      const info = this.infos[homeSlider.value | 0];
      this.home.setLatLng(info.latlng);
      this.cursor.setPopupContent(infoPopup(this.infos, this.segTrees, slider.value | 0, homeSlider.value | 0));
      drawGraphs(this);
      this.dispatchEvent(new CustomEvent("cursor-changed", {detail: this.getCursor()}));
    });
    
    // slider keybind
    control.tabIndex = 0;
    control.addEventListener("keydown", ev => {
      if (!this.cursor) return;
      if (ev.code === "ArrowDown") {
        this.homeSlider.value = this.slider.value;
        this.home.setLatLng(this.infos[this.homeSlider.value | 0].latlng);
      } else if (ev.code === "ArrowUp") {
        this.slider.value = this.homeSlider.value;
      } else {
        const step = (ev.controlKey ? 4 : 1) * (ev.shiftKey ? 10 : 1) * (ev.altKey ? 3 : 1) * (ev.metaKey ? 2 : 1);
        const amount = ev.code === "ArrowRight" ? step : ev.code === "ArrowLeft" ? -step : 0;
        if (amount === 0) return;
        this.slider.value = Number(this.slider.value) + amount;
      }
      ev.preventDefault();
      const info = this.infos[this.slider.value | 0];
      this.cursor.setLatLng(info.latlng);
      this.cursor.setPopupContent(infoPopup(this.infos, this.segTrees, slider.value | 0, homeSlider.value | 0));
      this.map.setView(info.latlng, this.map.getZoom());
      this.cursor.openPopup();
      drawGraphs(this);
      this.dispatchEvent(new CustomEvent("cursor-changed", {detail: this.getCursor()}));
    });
    
    //leaflet css
    const cssLink = this.ownerDocument.createElement("link");
    [cssLink.rel, cssLink.href] = ["stylesheet", "https://unpkg.com/leaflet@1.8.0/dist/leaflet.css"];
    mapDiv.append(cssLink);
    container.append(mapDiv);
    container.append(control);
    shadow.append(container);
    const map = this.map = L.map(mapDiv).setView([0, 0], 0);
    //this.map.locate({setView: true, maxZoom: 16});
  }
  connectedCallback() {
    if (!this.tile) {
      const tileTemplate = this.dataset.tileTemplate ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      const attribution = this.dataset.attribution ?? `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`;
      this.tile = L.tileLayer(tileTemplate, {attribution}).addTo(this.map);
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
    drawGraphs(this);
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
    const size = dataSpan > 0 ? dataSize : 10;
    const colors = dataColors.length > 0 ? dataColors : ["cyan", "magenta"];
    const layer = createGpxLayer(infos, maxSpeedTree, {span, size, colors});
    return {layer, gpx, xml, infos, segTrees};
  }
  setGpxPath({layer, gpx, xml, infos, maxSpeedTree, segTrees}, dataset = this.dataset) {
    this.clearGpx();
    [this.layer, this.infos, this.segTrees] = [layer, infos, segTrees]; 
    this.slider.value = this.homeSlider.value = 0;
    this.slider.max = this.homeSlider.max = this.infos.length - 1;
    this.layer.addTo(this.map);
    this.map.fitBounds(this.layer.getBounds());
    drawGraphs(this);

    const cursorText = dataset.cursorText ?? "&#x1f3c3;";
    const homeText = dataset.homeText ?? "&#x1f3e0;";
    const {cursor, home} = createCursorHome(infos, segTrees, {cursorText, homeText});
    this.cursor = cursor.addTo(this.map);
    this.home = home.addTo(this.map);
    this.control = createDownloadLink(gpx, xml).addTo(this.map);
    return this;
  }
  
  getCursor() {
    return {cursor: Number(this.slider.value), home: Number(this.homeSlider.value)};
  }
  setCursor({cursor, home} = {}) {
    if (!this.cursor) return;
    if (cursor !== undefined) this.slider.value = Math.min(Math.max(0, Number(cursor)), Number(this.slider.max));;
    if (home !== undefined) this.homeSlider.value = Math.min(Math.max(0, Number(home)), Number(this.homeSlider.max));
    const info = this.infos[this.slider.value | 0];
    this.home.setLatLng(this.infos[this.homeSlider.value | 0].latlng);
    this.cursor.setLatLng(info.latlng);
    this.cursor.setPopupContent(infoPopup(this.infos, this.segTrees, this.slider.value | 0, this.homeSlider.value | 0));
    this.map.setView(info.latlng, this.map.getZoom());
    this.cursor.openPopup();
    drawGraphs(this);
    this.dispatchEvent(new CustomEvent("cursor-changed", {detail: this.getCursor()}));
    return this;
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
  const leftAngle = angle + Math.PI - Math.PI / 9;
  const rightAngle = angle + Math.PI + Math.PI / 9;
  const left = destination(latlng, leftAngle, size * 2);
  const right = destination(latlng, rightAngle, size * 2);
  return L.polygon([left, latlng, right], {color}); // as arrow head
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
  const degree = angle / Math.PI * 180;
  const minutes = ((angle / Math.PI + 2) % 2) * 6 * 60;
  const m = Math.round(minutes % 60), h0 = Math.trunc(minutes / 60), h = h0 === 0 ? 12 : h0;
  const arrowChar = "&#x2b06;";
  const arrow = `<span style="display: inline-block; transform: rotate3d(0, 0, 1, ${degree}deg);">${arrowChar}</span>`;
  return `${arrow} ${h.toString().padStart(2)}:${m.toString().padStart(2, "0")} (${angleNf.format(degree).padStart(4)})`;
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
  
  const dir = direction(base.latlng, latlng);
  const straight = base.latlng.distanceTo(latlng);
  const labels = [
    `${ns}${degreeNf.format(lat).padStart(11)} ${ew}${degreeNf.format(lng).padStart(11)}`,
    "",
    `move toward    : ${Number.isFinite(angle) ? toClock(angle): "(stop)"}`,
    Number.isFinite(speed) ? `speed          : ${speedNf.format(speed * 3.6).padStart(9)}/h` : "",
    Number.isFinite(ele) ? `elevation      : ${eleNf.format(ele).padStart(8)}` : "",
    "",
    Number.isFinite(distance) ? `moving distance: ${distanceNf.format(distance / 1000).padStart(9)}` : "",
    Number.isFinite(total.s) ? `total time     : ${totalTime.padStart(9)}` : "",
    Number.isFinite(movingTotal.s) ? `moving time    : ${movingTime.padStart(9)}` : "",
    Number.isFinite(totalAve) ? `total ave      : ${speedNf.format(totalAve * 3.6).padStart(9)}/h` : "",
    Number.isFinite(movingAve) ? `moving ave     : ${speedNf.format(movingAve * 3.6).padStart(9)}/h` : "",
    Number.isFinite(elePlus) ? `elevation+     : +${eleNf.format(elePlus).padStart(7)}` : "",
    Number.isFinite(eleMinus) ? `elevation-     : -${eleNf.format(eleMinus).padStart(7)}` : "",
    "",
    Number.isFinite(minSpeed) ? `min speed      : ${speedNf.format(minSpeed * 3.6).padStart(9)}/h` : "",
    Number.isFinite(maxSpeed) ? `max speed      : ${speedNf.format(maxSpeed * 3.6).padStart(9)}/h` : "",
    Number.isFinite(minEle) ? `min elevation  :  ${eleNf.format(minEle).padStart(7)}` : "",
    Number.isFinite(maxEle) ? `max elevation  :  ${eleNf.format(maxEle).padStart(7)}` : "",
    "",
    `bearing        : ${Number.isFinite(dir) ? toClock(dir) : "(same point)"}`,
    `direct length  : ${distanceNf.format(straight / 1000).padStart(9)}`,    
    "",
    Number.isFinite(date.getTime()) ? `        ${date.toLocaleString()}` : "",
  ].join("\n");
  return `<pre style='font-size: 12px; font-family: "Noto Mono", "Menlo", "Consolas", monospace !important;'>${labels}</pre>`;
};

const createGpxLayer = (infos, segTrees, {span = 60, size = 10, colors = ["cyan", "magenta"]} = {}) => {
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
    const mark = infoMark(info.latlng, info.angle, color, size);
    mark.addTo(layer).
      on("mouseover", ev => ev.target.openPopup()).on("mouseout", ev => ev.target.closePopup()).
      on("mousedown", ev => ev.target.openPopup()).
      bindPopup(infoPopup(infos, segTrees, i));
  });
  return layer;
};

const createCursorHome = (infos, segTrees, {cursorText, homeText}) => {
  const cursor = L.marker(infos[0].latlng, {
    icon: L.divIcon({
      html: `<span style="font-size: 30px; vertical-slign: middle;">${cursorText}</span>`,
      iconSize: [0, 0],
      iconAnchor: [15, 30],
      popupAnchor: [0, -15],
    }),
  }).bindPopup(infoPopup(infos, segTrees, 0));
  const home = L.marker(infos[0].latlng, {
    icon: L.divIcon({
      html: `<span style="font-size: 30px; vertical-slign: middle;">${homeText}</span>`,
      iconSize: [0, 0],
      iconAnchor: [15, 30],
      popupAnchor: [0, -15],
    }),
    zIndexOffset: -1000,
  });
  return {cursor, home};
};

const createDownloadLink = (gpx, xml) => {
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
  return new DownloadControl();
};


const drawGraphs = self => {
  const {graph, infos} = self;
  const c2d = graph.getContext("2d");
  c2d.save();
  c2d.scale(graph.width, graph.height);
  c2d.clearRect(0, 0, 1, 1);
  if (infos) {
    c2d.fillStyle = "rgba(0, 0, 0, 0.25)";
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
const bindGraph = self => {
  new ResizeObserver(entries => {
    drawGraphs(self);
  }).observe(self.graph);
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
