//import "https://cdn.jsdelivr.net/npm/obs-websocket-js";

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
  }).catch(alert);
});

const video = document.querySelector("video");
const videoTrack = video.querySelector("track");
const videoSource = video.querySelector("source");
const recInput = document.querySelector("input#rec");
recInput.addEventListener("input", ev => {
  const file = recInput.files[0];
  if (!file) return;
  videoSource.src = URL.createObjectURL(file);
  video.load();
});

const subInput = document.querySelector("input#sub");
subInput.addEventListener("input", ev => {
  const file = subInput.files[0];
  if (!file) return;
  video.textTracks[0].mode = "hidden";
  videoTrack.src = URL.createObjectURL(file);
  video.load();
  video.textTracks[0].mode = "showing";
});

if (globalThis.OBSWebSocket) {
  const obs = new OBSWebSocket();
  video.addEventListener("ended", () => {
    setTimeout(() => {
      // OBS WebSocket send commands:
      // https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#requests
      obs.call("StopStream").catch(console.error);
      obs.call("StopRecord").catch(console.error);
    }, 30 * 1000); // delay required
  });
  // OBS WebSocket sent events:
  // https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#events
  obs.on("StreamStateChanged", ev => {
    //console.log("StreamStateChanged", ev);
    if (ev.outputState === "OBS_WEBSOCKET_OUTPUT_STARTED") {
      video.play();
    }
  });
  obs.on("RecordStateChanged", ev => {
    //console.log("RecordStateChanged", ev);
    if (ev.outputState === "OBS_WEBSOCKET_OUTPUT_STARTED") {
      video.play();
    }
  });
  const onClosed = ev => {
    connectButton.textContent = "connect";
  };
  obs.on("ExitStarted", onClosed);
  obs.on("ConnectionError", onClosed);
  obs.on("ConnectionClosed", onClosed);
  
  const connectButton = document.getElementById("obs-connect");
  connectButton.addEventListener("click", ev => {
    ev.preventDefault();
    if (connectButton.textContent === "connect") {
      const url = document.getElementById("obs-url").value;
      obs.connect(url, undefined, {eventSubscriptions: OBSWebSocket.EventSubscription.Outputs}).then(() => {
        connectButton.textContent = "disconnect";
      });
    } else {
      obs.disconnect().then(() => {
        connectButton.textContent = "connect";
      });
    }
  });
}

const speedInput = document.getElementById("speed");
const offsetInput = document.getElementById("offset");
const syncViewerToVideo = () => {
  //if (video.seeking || !video.paused) return;
  if (!video.paused) return;
  if (!viewer.infos || viewer.infos.length === 0) return;
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

document.querySelector("dialog").showModal();
document.body.addEventListener("contextmenu", ev => {document.querySelector("dialog").showModal();});
