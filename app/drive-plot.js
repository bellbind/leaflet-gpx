import {Dexie} from "https://unpkg.com/dexie@latest/dist/dexie.mjs";
import * as L from "https://unpkg.com/leaflet@1.8.0/dist/leaflet-src.esm.js";
const leafletCssUrl = "https://unpkg.com/leaflet@1.8.0/dist/leaflet.css";

const viewer = document.querySelector("leaflet-gpx#main");
const submap = document.querySelector("leaflet-gpx#sub");
viewer.addEventListener("cursor-changed", ev => {
  submap.setCursor(ev.detail);
});

const gpxInput = document.querySelector("input#gpx");
gpxInput.addEventListener("input", ev => {
  const file = gpxInput.files[0];
  if (!file) return;
  file.text().then(xml => {
    viewer.setGpx(xml);
    submap.setGpx(xml);
    loadGpx(xml);
  }).catch(alert);
});

const video = document.querySelector("video");
const videoSource = video.querySelector("source");
let recName = "";
const recInput = document.querySelector("input#rec");
recInput.addEventListener("input", ev => {
  const file = recInput.files[0];
  if (!file) return;
  recName = file.name;
  videoSource.src = URL.createObjectURL(file);
  video.load();
  // db
  loadPlots();
});

const videoTrack = video.querySelector("track");

const speedInput = document.getElementById("speed");
const offsetInput = document.getElementById("offset");
const syncViewerToVideo = () => {
  //if (video.seeking || !video.paused) return;
  if (!video.paused) return;
  const speed = Number(speedInput.value);
  const offset = Number(offsetInput.value);
  const start = viewer.infos[0].time;
  const cur = viewer.infos[Number(viewer.slider.value)].time;
  const time = (cur - start) / 1000;
  video.currentTime = (time - offset) / speed;
};
offsetInput.addEventListener("input", syncViewerToVideo);
viewer.addEventListener("cursor-changed", syncViewerToVideo);

const syncVideoToViewer = () => {
  //if (!video.seeking && video.paused) return;
  if (video.paused) return;
  forceSyncVideoToViewer();
};
const forceSyncVideoToViewer = () => {
  if (!viewer.infos) return;
  const speed = Number(speedInput.value);
  const offset = Number(offsetInput.value);
  const current = Number(viewer.slider.value);
  const msec = (offset + speed * video.currentTime) * 1000;
  const vtime = (viewer.infos[0].time || 0) + msec;
  const curtime = viewer.infos[current].time;
  if (vtime === curtime) return;
  if (vtime < curtime) {
    for (let i = current; i >= 0; i--) {
      if (viewer.infos[i].time <= vtime) {
        //console.log("[vtime < curtime]", vtime, curtime, current, i);
        if (i === viewer.infos.length - 1) {
          viewer.setCursor({cursor: i});
        } else {
          const dnext = viewer.infos[i + 1].time - curtime;
          const dprev = curtime - viewer.infos[i].time;
          viewer.setCursor({cursor: dprev < dnext ? i : i + 1});
        }
        break;
      }
    }
  } else if (vtime > curtime) {
    for (let i = current; i < viewer.infos.length; i++) {
      if (viewer.infos[i].time >= vtime) {
        //console.log("[vtime > curtime]", vtime, curtime, current, i);
        if (i === 0) {
          viewer.setCursor({cursor: i});
        } else {
          const dnext = viewer.infos[i].time - curtime;
          const dprev = curtime - viewer.infos[i - 1].time;
          viewer.setCursor({cursor: dprev < dnext ? i - 1 : i});
        }
        break;
      }
    }
  }
};
video.addEventListener("timeupdate", syncVideoToViewer);
//video.addEventListener("seeking", syncVideoToViewer);

const infoLeft = document.getElementById("info-left");
const infoMiddle = document.getElementById("info-middle");
const infoRight = document.getElementById("info-right");
viewer.addEventListener("cursor-changed", ev => {
  const date = viewer.sideView.querySelector(".info-date").innerHTML;
  const lat = viewer.sideView.querySelector(".info-lat").innerHTML;
  const lng = viewer.sideView.querySelector(".info-lng").innerHTML;
  const toward = viewer.sideView.querySelector(".info-toward").innerHTML;
  const speed = viewer.sideView.querySelector(".info-speed").innerHTML;
  const ele = viewer.sideView.querySelector(".info-ele").innerHTML;
  const distance = viewer.sideView.querySelector(".info-distance").innerHTML;
  const totalTime = viewer.sideView.querySelector(".info-total-time").innerHTML;
  const movingTime = viewer.sideView.querySelector(".info-moving-time").innerHTML;
  const totalAve = viewer.sideView.querySelector(".info-total-ave").innerHTML;
  const movingAve = viewer.sideView.querySelector(".info-moving-ave").innerHTML;
  const elePlus = viewer.sideView.querySelector(".info-ele-plus").innerHTML;
  const eleMinus = viewer.sideView.querySelector(".info-ele-minus").innerHTML;
  const minSpeed = viewer.sideView.querySelector(".info-min-speed").innerHTML;
  const maxSpeed = viewer.sideView.querySelector(".info-max-speed").innerHTML;
  const minEle = viewer.sideView.querySelector(".info-min-ele").innerHTML;
  const maxEle = viewer.sideView.querySelector(".info-max-ele").innerHTML;
  const bearing = viewer.sideView.querySelector(".info-bearing").innerHTML;
  const length = viewer.sideView.querySelector(".info-length").innerHTML;
  infoLeft.innerHTML = `   ${lat}  ${lng}

<span style="color: #aaaaaa">         speed:</span> ${speed}
<span style="color: #aaaaaa"> moving toward:</span> ${toward}
<span style="color: #aaaaaa">      distance:</span> ${distance}

<span style="color: #aaaaaa">   moving time:</span> ${movingTime}
<span style="color: #aaaaaa">moving average:</span> ${movingAve}
`;
  infoMiddle.innerHTML = `        ${date}

<span style="color: #aaaaaa">       max speed:</span> ${maxSpeed}
<span style="color: #aaaaaa">         bearing:</span> ${bearing}
<span style="color: #aaaaaa"> direct distance:</span> ${length}

<span style="color: #aaaaaa">      total time:</span> ${totalTime}
<span style="color: #aaaaaa">   total average:</span> ${totalAve}
`;        
  infoRight.innerHTML = `

<span style="color: #aaaaaa">    elevation:</span> ${ele}

<span style="color: #aaaaaa">max elevation:</span> ${maxEle}
<span style="color: #aaaaaa">min elevation:</span> ${minEle}
<span style="color: #aaaaaa">         ele+:</span> ${elePlus}
<span style="color: #aaaaaa">         ele-:</span> ${eleMinus}
`;
});

// plot editor
const plotElem = document.getElementById("plot");
const leafletLink = document.createElement("link");
[leafletLink.rel, leafletLink.href] = ["stylesheet", leafletCssUrl];
plotElem.append(leafletLink);

const map = L.map(plotElem).setView([0, 0], 0);
const tileTemplate = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const attribution = `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`;
L.tileLayer(tileTemplate, {attribution}).addTo(map);

// draw gpx path
let polyline = null;
const loadGpx = xml => {
  const parser = new DOMParser();
  const gpx = parser.parseFromString(xml, "application/xml");
  const latlons = [...gpx.querySelectorAll("trkpt")].map(trkpt => [trkpt.getAttribute("lat"), trkpt.getAttribute("lon")]);
  if (polyline) polyline.remove();
  polyline = L.polyline(latlons, {color: "blue", weight: 5, opacity: 0.5}).addTo(map);
  map.fitBounds(polyline.getBounds());
};

// marker plot
const secToTime = sec => {
  const s = sec % 60;
  const minute = (sec - s) / 60;
  const m = minute % 60;
  const h = (minute - m) / 60;
  return {h, m, s};
};
const secToText = sec => {
  const {h, m, s} = secToTime(sec);
  const list = h === 0 ? [] : [h.toString()];
  return [...list, m.toString().padStart(2, "0"), s.toString().padStart(2, "0")].join(":");
};

const listElem = document.getElementById("list");
const plots = [];
const updateList = () => {
  listElem.textContent = plots.map(({sec, label}) => `${secToText(sec)} ${label}`).join("\n");
  // update VTT cue
  const tt = video.textTracks[0];
  const cues = [...tt.cues];
  for (const cue of cues) tt.removeCue(cue);
  const span = Number(document.getElementById("vtt-span").value);
  for (const {sec, label} of plots) {
    const cue = new VTTCue(sec, sec + span, label);
    cue.snapToLines = false;
    cue.line = 90;
    tt.addCue(cue);
  }
};

const newPlot = ({sec, lat, lng, label}) => {
  const marker = L.marker({lat, lng}, {draggable: true});
  const plot = {sec, lat, lng, label, marker};
  const labelInput = document.createElement("input");
  labelInput.value = label;
  labelInput.addEventListener("input", ev => {
    plot.label = labelInput.value;
    updateList();
    putPlot(plot);
  });
  const delButton = document.createElement("button");
  delButton.textContent = "\u{1f5d1}";
  delButton.addEventListener("click", ev => {
    plot.marker.remove();
    plots.splice(plots.indexOf(plot), 1);
    updateList();
    // db
    deletePlot(plot);
  });
  const jumpButton = document.createElement("button");
  jumpButton.textContent = "\u{23eb}";
  jumpButton.addEventListener("click", ev => {
    viewer.removeEventListener("cursor-changed", syncViewerToVideo);
    video.currentTime = plot.sec;
    forceSyncVideoToViewer();
    viewer.addEventListener("cursor-changed", syncViewerToVideo);
  });
  const content = document.createElement("div");
  content.append(labelInput, `${sec}s`, jumpButton, delButton);
  marker.bindPopup(content);
  marker.on("dragend", () => {
    const {lat, lng} = marker.getLatLng();
    [plot.lat, plot.lng] = [lat, lng];
  });
  return plot;
};
const addPlot = (sec, lat, lng, label = "") => {
  const {h, m, s} = secToTime(sec);
  label = label || (h > 0 ? `${h}h` : ``) + (h > 0 || m > 0 ? `${m}m` : ``) + `${s}s`;
  const plot = newPlot({sec, lat, lng, label});
  plot.marker.addTo(map);
  plot.marker.openPopup();
  const i = plots.findIndex(p => p.sec > plot.sec);
  if (i < 0) plots.push(plot); else plots.splice(i, 0, plot);
  updateList();
  putPlot(plot);
};

map.on("click", ev => {
  if (!video.currentSrc) return;
  const sec = Math.floor(video.currentTime);
  if (plots.find(p => p.sec === sec)) return; 
  const {lat, lng} = ev.latlng;
  addPlot(sec, lat, lng);
});
const putMarkerFromViewer = () => {
  if (!video.currentSrc) return;
  const {lat, lng} = viewer.cursor.getLatLng();
  const sec = Math.floor(video.currentTime);
  const plot = plots.find(p => p.sec === sec);
  if (plot) {
    [plot.lat, plot.lng] = [lat, lng];
    plot.marker.setLatLng({lat, lng});
    plot.marker.openPopup();
    putPlot(plot);
  } else {
    addPlot(sec, lat, lng);
  }
};

document.getElementById("put").addEventListener("click", ev => {
  putMarkerFromViewer();
});

// exports
const plotsToKml = (plots, title, baseUrl = "") => {
  // export as KML placemarks
  const ns = "http://www.opengis.net/kml/2.2";
  const kml = document.implementation.createDocument(ns, "kml");
  const doc = kml.createElementNS(ns, "Document");
  const name = kml.createElementNS(ns, "name");
  kml.documentElement.appendChild(doc);
  name.appendChild(kml.createTextNode(`${title}`));
  doc.appendChild(name);

  for (const {sec, lat, lng, label} of plots) {
    const mark = kml.createElementNS(ns, "Placemark");
    const name = kml.createElementNS(ns, "name");
    const desc = kml.createElementNS(ns, "description");
    const point = kml.createElementNS(ns, "Point");
    const coord = kml.createElementNS(ns, "coordinates");
    name.appendChild(kml.createTextNode(`${label}`));
    desc.appendChild(kml.createCDATASection(`${baseUrl}${sec}s`));
    coord.appendChild(kml.createTextNode(`${lng},${lat},0`));
    point.appendChild(coord);
    mark.appendChild(name);
    mark.appendChild(desc);
    mark.appendChild(point);
    doc.appendChild(mark);
  }

  const xs = new XMLSerializer();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>${xs.serializeToString(kml)}`;
  return xml;
};

const plotsToVtt = (plots, span = 1) => {
  const pad2 = n => n.toString().padStart(2, "0");
  const vttTime = ({h, m, s}) => `${pad2(h)}:${pad2(m)}:${pad2(s)}.000`;

  const cues = plots.map(({sec, label}, i) => {
    const start = vttTime(secToTime(sec));
    const end = vttTime(secToTime(sec + span));
    const id = `plot-${i}`;
    return `${id}\n${start} --> ${end}\n${label}\n\n`;
  });
  return `WEBVTT\n\n${cues.join("")}`;
};

const downloadText = (contentType, text, name) => {
  const a = document.createElement("a");
  a.href = `data:${contentType},${text}`;
  a.download = name;
  a.click();
};

document.getElementById("kml").addEventListener("click", ev => {
  const title = recName;
  const yt = document.getElementById("yt").value.trim();
  const baseUrl = `${yt}?t=`;
  const xml = plotsToKml(plots, title, baseUrl);
  downloadText("application/xml;charset=utf-8", xml, `${title}.kml`);
  ev.preventDefault();
});
document.getElementById("vtt").addEventListener("click", ev => {
  const title = recName;
  const span = Number(document.getElementById("vtt-span").value);
  const vtt = plotsToVtt(plots, span);
  downloadText("text/plain;charset=utf-8", vtt, `${title}.vtt`);
  ev.preventDefault();
});
document.getElementById("copy").addEventListener("click", ev => {
  navigator.clipboard.writeText(listElem.value);
  ev.preventDefault();
});

// key binding
const controls = document.getElementById("controls");
controls.tabIndex = 0;
controls.addEventListener("keydown", ev => {
  switch (ev.code) {
  case "ArrowLeft":
    viewer.removeEventListener("cursor-changed", syncViewerToVideo);
    video.currentTime = Math.ceil(video.currentTime) - (ev.shiftKey ? 10 : 1);
    forceSyncVideoToViewer();
    viewer.addEventListener("cursor-changed", syncViewerToVideo);
    break;
  case "ArrowRight":
    viewer.removeEventListener("cursor-changed", syncViewerToVideo);
    video.currentTime = Math.ceil(video.currentTime) + (ev.shiftKey ? 10 : 1);
    forceSyncVideoToViewer();
    viewer.addEventListener("cursor-changed", syncViewerToVideo);
    break;
  case "ArrowUp":
    map.setView(viewer.cursor.getLatLng(), map.getZoom());
    break;
  case "ArrowDown":
    putMarkerFromViewer();
    map.setView(viewer.cursor.getLatLng(), map.getZoom());
    break;
  }
});

// import kml
const kmlToPlotData = xml => {
  const parser = new DOMParser();
  const kml = parser.parseFromString(xml, "application/xml");
  // use Placemark Point only
  const markers = [...kml.querySelectorAll("Placemark")];
  const plots = markers.map(pm => {
    const point = pm.querySelector("Point");
    if (!point) return null;
    const label = pm.querySelector("name").textContent;
    const desc = pm.querySelector("description").textContent;
    const [lng, lat, alt] = point.querySelector("coordinates").textContent.split(",").map(t => Number(t));
    let secText = desc;
    try {
      secText = new URL(desc).searchParams.get("t");
    } catch (ex) {}
    const match = secText.match(/^(\d+)s$/);
    if (!match) return null;
    const sec = Number(match[1]);
    return {sec, lat, lng, label};
  });
  return plots.filter(p => p);
};
const addPlotData = plotData => {
  for (const {sec, lat, lng, label} of plotData) {
    if (plots.find(p => p.sec === sec)) continue;
    const plot = newPlot({sec, lat, lng, label});
    plot.marker.addTo(map);
    const i = plots.findIndex(p => p.sec > plot.sec);
    if (i < 0) plots.push(plot); else plots.splice(i, 0, plot);
    putPlot(plot);
  }
  updateList();
};

const kmlImport = document.getElementById("kml-import");
kmlImport.addEventListener("input", ev => {
  const file = kmlImport.files[0];
  if (!file) return;
  file.text().then(xml => {
    addPlotData(kmlToPlotData(xml));
  });
});

// TBD: load/store indexeddb, import kml
const db = new Dexie("TimeMap");
//db.delete();
db.version(1).stores({
  plots: "++id,[video+sec],lat,lng,label",
});
const loadPlots = () => {
  if (!recName) return;
  db.transaction("r", db.plots, async () => {
    const plotData = await db.plots.where("video").equals(recName).toArray();
    addPlotData(plotData);
  });
};
const putPlot = plot => {
  if (!recName) return;
  db.transaction("rw", db.plots, async () => {
    await db.plots.where({video: recName, sec: plot.sec}).delete();
    await db.plots.put({
      video: state.video, sec: plot.sec,
      lat: plot.lat, lng: plot.lng,
      label: plot.label, desc: plot.desc,
    });
  });
};
const deletePlot = plot => {
  if (!recName) return;
  db.transaction("rw", db.plots, async () => {
    await db.plots.where({video: recName, sec: plot.sec}).delete();
  });
};


document.querySelector("dialog").showModal();
document.body.addEventListener("contextmenu", ev => {document.querySelector("dialog").showModal();});
