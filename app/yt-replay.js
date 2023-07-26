const jsonToHash = json => new URLSearchParams(json).toString();
const hashToJson = hash => {
  const json = Object.fromEntries(new URLSearchParams(hash).entries());
  json.speed = Number(json.speed);
  json.offset = Number(json.offset);
  return json;
};

await new Promise(f => {window.onYouTubeIframeAPIReady = f;});
const viewer = document.querySelector("leaflet-gpx#main");
const submap = document.querySelector("leaflet-gpx#sub");
viewer.addEventListener("cursor-changed", ev => {
  submap.setCursor(ev.detail);
});
const video = new YT.Player("yt", {
  //width: "960px", height: "540px",
  playerVars: {autoplay: 0, cc_lang_pref: "ja", cc_load_policy: 1, rel: 0},
  events: {onStateChange: ev => videoStateChange(ev)},
});

const gpxInput = document.getElementById("gpx");
const vidInput = document.getElementById("vid");
const speedInput = document.getElementById("speed");
const offsetInput = document.getElementById("offset");
const openButton = document.getElementById("open");
const skipsInput = document.getElementById("skips");

const dialog = document.querySelector("dialog");
dialog.addEventListener("close", ev => {
  const gpx = gpxInput.value.trim();
  const vid = vidInput.value.trim();
  const speed = Number(speedInput.value);
  const offset = Number(offsetInput.value);
  const skips = skipsInput.value;
  const json = {gpx, vid, speed, offset, skips};
  history.pushState(json, null, `${location.pathname}#${jsonToHash(json)}`);
  play();
});

const chooser = document.getElementById("chooser");
const entries = await (await fetch("./yt-index.json")).json();
//console.log(entries);
for (let i = 0; i < entries.length; i++) {
  if (!entries[i] || !entries[i].vid || !entries[i].gpx) continue;
  const option = document.createElement("option");
  option.value = JSON.stringify(entries[i]);
  option.textContent = JSON.stringify(entries[i]);
  chooser.append(option);
}
chooser.addEventListener("change", ev => {
  if (chooser.selectedIndex === 0) {
    history.replaceState(null, null, location.pathname);
    return;
  };
  const json = JSON.parse(chooser.value);
  if (json.skips) json.skips = JSON.stringify(json.skips);
  history.pushState(json, null, `${location.pathname}#${jsonToHash(json)}`);
  loadHashState();
});

const vidFromUrl = url => {
  return new URL(url).searchParams.get("v");
};
const state = {};
const play = () => {
  const vid = vidInput.value.trim();
  const gpx = gpxInput.value.trim();
  if (state.vid !== vid) {
    video.loadVideoById({videoId: vid, suggestedQuality: "hd1080"});
    video.getOptions("cc");
    video.setOption("cc", "reload", true);
    //video.pauseVideo();
  }
  if (state.gpx !== gpx) {
    fetch(gpxInput.value.trim()).then(res => res.text()).then(xml => {
      viewer.setGpx(xml);
      submap.setGpx(xml);
    });
  }
  state.vid = vid;
  state.gpx = gpx;
};
const loadHashState = () => {
  console.log("loadHashState", location.hash);
  const hash = location.hash.replace(/^#/, "");
  if (!hash) {
    return;
  }
  const json = hashToJson(hash);
  chooser.value = JSON.stringify(json);
  gpxInput.value = json.gpx;
  vidInput.value = json.vid;
  speedInput.value = json.speed;
  offsetInput.value = json.offset;
  if (json.skips) skipsInput.value = json.skips;
  dialog.showModal();
};
window.addEventListener("popstate", loadHashState);

const updateInfo = async () => {
  const vid = vidInput.value.trim();
  const gpx = gpxInput.value.trim();
  const speed = speedInput.value;
  const offset = offsetInput.value;
  const skips = skipsInput.value;
  const setting = {gpx, vid, speed, offset, skips};
  history.pushState(setting, null, `${location.pathname}#${jsonToHash(setting)}`);
};
document.body.addEventListener("contextmenu", ev => {dialog.showModal();});
const getSkips = () => {
  try {
    const json = JSON.parse(skipsInput.value);
    if (!Array.isArray(json)) return [{"video-at": 0, "gps-sec": 0}];
    const skips = json.filter(o => Number.isFinite(o["video-at"]) && Number.isFinite(o["gps-sec"]) && o["video-at"] >= 0);
    if (skips.length === 0) return [{"video-at": 0, "gps-sec": 0}];
    return skips.sort((a, b) => a["video-at"] - b["video-at"]);
  } catch (err) {
    return [{"video-at": 0, "gps-sec": 0}];
  }
};

const syncViewerToVideo = () => {
  if (video.getPlayerState() === YT.PlayerState.PLAYING) return;
  const speed = Number(speedInput.value);
  const offset = Number(offsetInput.value);
  const skips = getSkips();
  
  const start = viewer.infos[0].time;
  const cur = viewer.infos[Number(viewer.slider.value)].time;
  const time = (cur - start) / 1000;
  const videoTime = (time - offset) / speed;
  const skip = skips.findLast(s => s["video-at"] < videoTime) ?? {"video-at": 0, "gps-sec": 0};
  const skipTime = skip["gps-sec"] / speed;
  video.seekTo((skip["video-at"] > videoTime - skipTime) ? skip["video-at"] : videoTime - skipTime, true);
  //video.seekTo((time - offset) / speed, true);
};
viewer.addEventListener("cursor-changed", syncViewerToVideo);

const syncVideoToViewer = () => {
  if (video.getPlayerState() !== YT.PlayerState.PLAYING) return;
  if (!viewer.infos) return;
  const speed = Number(speedInput.value);
  const offset = Number(offsetInput.value);
  const skips = getSkips();

  const skip = skips.findLast(s => s["video-at"] < video.getCurrentTime()) ?? {"video-at": 0, "gps-sec": 0};
  const current = Number(viewer.slider.value);
  const msec = (offset + speed * video.getCurrentTime() + skip["gps-sec"]) * 1000;
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
let timer = null;
const videoStateChange = ev => {
  // YT.Player: cannot detect pause & seeking state. so not support seeking to sync viewer
  if (ev.data === YT.PlayerState.PLAYING) {
    if (timer) clearInterval(timer);
    timer = setInterval(syncVideoToViewer, 100);
  }
  if (ev.data === YT.PlayerState.PAUSED || ev.data === YT.PlayerState.ENDED) {
    clearInterval(timer);
    timer = null;
  }
};

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

loadHashState();
