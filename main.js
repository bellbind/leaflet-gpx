// <leaflet-gpx> with cache
const viewer = document.getElementById("viewer");
const cache = new Map();
const keep = document.getElementById("keep");
const prevLayers = new Set();
const keepLayers = layer => {
  if (!layer) return;
  if (!keep.checked) {
    for (const layer of prevLayers) if (layer !== viewer.layer) layer.remove();
    prevLayers.clear();
    return;
  }
  if (!prevLayers.has(layer)) {
    layer.addTo(viewer.map);
    prevLayers.add(layer);
  }
};
const clear = () => {
  const layer = viewer.layer;
  viewer.clearGpx();
  keepLayers(layer);
  viewer.map.setView([0, 0], 0);
};
const load = async (file) => {
  if (cache.has(file)) {
    const layer = viewer.layer;
    const gpxPath = cache.get(file);
    viewer.setGpxPath(gpxPath);
    keepLayers(layer);
    return;
  }
  return fetch(file).then(res => {
    if (res.ok) return res.text();
    throw res;
  }).then(xml => {
    const layer = viewer.layer;
    const gpxPath = viewer.createGpxPath(xml);
    viewer.setGpxPath(gpxPath);
    cache.set(chooser.value, gpxPath);
    keepLayers(layer);
  });
};
// Event "cursor-changed" from <leaflet-gpx>
viewer.addEventListener("cursor-changed", ({detail: {cursor, home}}) => {
  const hash = location.hash.replace(/#/, "");
  const file = hash.includes("?") ? hash.slice(0, hash.indexOf("?")) : hash;
  history.replaceState(file, null, `${location.pathname}#${file}?${new URLSearchParams(viewer.getCursor())}`);
});

// GPX chooser UI
const chooser = document.getElementById("chooser");
const index = await (await fetch("./index.json")).json();
const options = index.map(gpx => {
  const option = document.createElement("option");
  option.textContent = gpx.href;
  return option;
});
chooser.append(...options);
chooser.addEventListener("change", ev => {
  if (chooser.selectedIndex === 0) {
    clear();
    history.replaceState(null, null, location.pathname);
  } else {
    load(chooser.value).then(() => {
      history.pushState(chooser.value, null, `${location.pathname}#${chooser.value}`);
    });
  }
});

// load location.hash state
const loadHashState = () => {
  const hash = location.hash.replace(/#/, "");
  if (!hash) {
    clear();
    return;
  }
  const file = hash.includes("?") ? hash.slice(0, hash.indexOf("?")) : hash;
  const cursor = Object.fromEntries(new URLSearchParams(hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : ""));
  const gpx = index.find(({href}) => href === file);
  if (gpx) load(gpx.href).then(() => {
    viewer.setCursor(cursor);
    chooser.value = gpx.href;
  });
};
loadHashState();
window.addEventListener("popstate", loadHashState);
