# HTML custom element for GPX file viewer <leaflet-gpx>

- demo: https://bellbind.github.io/leaflet-gpx-element/

## Usage

```html
<html>
  <head>
    <meta charset="utf-8" />
    <script type="module" src="leaflet-gpx.js"></script>
  </head>
  <body>
    <leaflet-gpx
      style="width: 80vmin; height: 80vmin;"
      data-src="./fetchable-gpx-file.gpx"
    ></leaflet-gpx>
  </body>
</html>
```

NOTE: `<leaflet-gpx>` element requires some size setting (e.g. CSS width & height)

## Key bind of slider

- `ArrowRight` key: go cursor forward
- `ArrowLeft` key: go cursor backward
- `ArrowDown` key: move home at cursor
- `ArrowDown` key: move cursor at home

Decorations for steps

- `ShiftKey`: amount * 10 
- `ControlKey`: amount * 4 
- `AltKey`: amount * 3
- `MetaKey`: amount * 2

## Working [examples](./examples/)

- [simple-url.html](https://bellbind.github.io/leaflet-gpx-element/examples/simple-url.html): `<leaflet-gpx>` with `data-src` only
- [customized-url.html](https://bellbind.github.io/leaflet-gpx-element/examples/customized-url.html): `<leaflet-gpx>` with customzing attributes
- [file.html](https://bellbind.github.io/leaflet-gpx-element/examples/file.html): Displaying a local GPX file with `setGpx(xml)` method
- [dnd.html](https://bellbind.github.io/leaflet-gpx-element/examples/dnd.html): Displaying a Drag & Drop-ed GPX file with `setGpx(xml)` method
- [inline.html](https://bellbind.github.io/leaflet-gpx-element/examples/inline.html): use `<leaflet-gpx>` as `inline-block`.

## `<leaflet-gpx>` attributes

- `data-src`: fetch URL of a displaying GPX XML file
- `data-info-span`: marker span of `trkpt`s (default: `"60"`) 
- `data-info-size`: base meter size of marker (defalut: `"10"`)
- `data-info-colors`: comma separated color names (default: `"cyan,magenta"`)
- `data-cursor-size`: pixel size of cursor/home icons (default: `"30"`)
- `data-cursor-text`: cursor icon text (default: `"&#x1f3c3;"` as "Runner" emoji)
- `data-home-text`: cursor icon text (default: `"&#x1f3e0;"` as "House" emoji)
- `data-popup-font-size`: CSS font-size of info popup text (default: `"16px"`)
- `data-hide-download`: hide "Download GPX file" panel when "true" (default: "")
- `data-tile-template`: tile template url (default: `"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"`)
- `data-attribution`: Leaflet attribution panel (default: `"&copy; &lt;a href="https://www.openstreetmap.org/copyright"&gt;OpenStreetMap&lt;/a&gt; contributors"`)
- `data-show-side-view`: show info in the fixed side view instead of popup on the cursor when "left" or "right", or "hide" side view (default: "none" as popup)

### Unstable features

- `data-ipfs-cid`: [IPFS](http://ipfs.io/) cid of a displaying GPX XML file

## `LeafletGpx` class API

- `this.clearGpx()` -> `this`: remove a GPX Layer
- `this.setGpx(xml, dataset = this.dataset)` -> `this`: update GPX XML text
- `this.getCursor()` -> `{cursor: <non-negative integer>, home: <non-negative integer>}`: get cursor & home position
- `this.setCursor({cursor, home} = {})` -> `this`: set cursor & home position
- `this.createGpxPath(xml, dataset = this.dataset)` -> `gpxPath = {layer, xml, infos, ...}`: cachable state of GPX Path layer
- `this.setGpxPath(gpxPath, dataset = this.dataset)` -> `this`: set GPX Path layer 

- `this.map`: a `Map` object of Leaflet
- `this.tile`: a `TileLayer` of Leaflet
- `this.cursor`: a `Marker` object for slider controlling
- `this.home`: a `Marker` object for base position of cursor info
- `this.layer`: a `LayerGroup` object contains lines, markers, and the `cursor`
- `this.infos`: a list of info from GPX `trkpt` elements
- `this.slider`: a `<input type="range">` element for moving the `cursor`
- `this.homeSlider`: a `<input type="range">` element for moving the `home`
- `this.control`: a `Control` object for the top-right download link panel

## `leafletGpx` event API

- `"cursor-changed"`: when values of cursor or home changed, where the `CustomEvent` has `event.detail: {cursor, home}`

## Reference

- Leaflet a JavaScript library for interactive maps: https://leafletjs.com/
