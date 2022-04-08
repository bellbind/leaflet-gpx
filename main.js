const viewer = document.getElementById("viewer");
const index = await (await fetch("./index.json")).json();
const chooser = document.getElementById("chooser");
chooser.addEventListener("change", ev => {
  if (chooser.selectedIndex === 0) return;
  fetch(chooser.value).then(res => res.text()).then(xml => viewer.setGpx(xml));
});

const options = index.map(gpx => {
  const option = document.createElement("option");
  option.value = option.textContent = gpx.href;
  return option;
});
chooser.append(...options);

