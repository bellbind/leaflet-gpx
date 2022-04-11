# HTML custom element for GPX file viewer <leaflet-gpx>

- demo: https://bellbind.github.io/leaflet-gpx/

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

NOTE: `<leaflet-gpx>` requires some size setting (e.g. CSS width & height)

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

- [simple-url.html](https://bellbind.github.io/leaflet-gpx/examples/simple-url.html): `<leaflet-gpx>` with `data-src` only
- [customized-url.html](https://bellbind.github.io/leaflet-gpx/examples/customized-url.html): `<leaflet-gpx>` with customzing attributes
- [file.html](https://bellbind.github.io/leaflet-gpx/examples/file.html): Displaying a local GPX file with `setGpx(xml)` method
- [dnd.html](https://bellbind.github.io/leaflet-gpx/examples/dnd.html): Displaying a Drag & Drop-ed GPX file with `setGpx(xml)` method

## `<leaflet-gpx>` attributes

- `data-src`: fetch URL of a displaying GPX XML file
- `data-info-span`: marker span of `trkpt`s (default: `"60"`) 
- `data-info-size`: base meter size of marker (defalut: `"10"`)
- `data-info-colors`: comma separated color names (default: `"cyan,magenta"`)
- `data-cursor-text`: cursor icon text (default: `"&#x1f3c3;"` as "Runner" emoji)
- `data-home-text`: cursor icon text (default: `"&#x1f3e0;"` as "House" emoji)

### Unstable features

- `data-ipfs-cid`: [IPFS](http://ipfs.io/) cid of a displaying GPX XML file

## `LeafletGpx` class API

- `this.setGpx(xml, dataset = this.dataset)`: update GPX XML text
- `this.map`: a `Map` object of Leaflet
- `this.cursor`: a `Marker` object for slider controlling
- `this.home`: a `Marker` object for base position of cursor info
- `this.layer`: a `LayerGroup` object contains lines, markers, and the `cursor`
- `this.infos`: a list of info from GPX `trkpt` elements
- `this.slider`: a `<input type="range">` element for moving the `cursor`
- `this.homeSlider`: a `<input type="range">` element for moving the `home`
- `this.control`: a `Control` object for the top-right download link panel

## Reference

- Leaflet a JavaScript library for interactive maps: https://leafletjs.com/
