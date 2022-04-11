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

const gpx = index.find(({href}) => href === location.hash.replace(/#/, ""));
if (gpx) {
  fetch(gpx.href).then(res => res.text()).then(xml => viewer.setGpx(xml));
  chooser.value = gpx.href;
}
