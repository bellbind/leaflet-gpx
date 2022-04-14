const viewer = document.getElementById("viewer");
const index = await (await fetch("./index.json")).json();
const chooser = document.getElementById("chooser");
chooser.addEventListener("change", ev => {
  if (chooser.selectedIndex === 0) return;
  fetch(chooser.value).then(res => res.text()).then(xml => viewer.setGpx(xml));
  location.hash = chooser.value;
});

const options = index.map(gpx => {
  const option = document.createElement("option");
  option.textContent = gpx.href;
  return option;
});
chooser.append(...options);

viewer.addEventListener("cursor-changed", ({detail: {cursor, home}}) => {
  const hash = location.hash.replace(/#/, "");
  const file = hash.includes("?") ? hash.slice(0, hash.indexOf("?")) : hash;
  location.hash = `${file}?${new URLSearchParams(viewer.getCursor())}`;
});

const hash = location.hash.replace(/#/, "");
const file = hash.includes("?") ? hash.slice(0, hash.indexOf("?")) : hash;
const params = Object.fromEntries(new URLSearchParams(hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : ""));
const gpx = index.find(({href}) => href === file);
if (gpx) {
  fetch(gpx.href).then(res => res.text()).then(xml => viewer.setGpx(xml).setCursor(params));
  chooser.value = gpx.href;
}
