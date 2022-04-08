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

## Working [examples](./examples/)

- [simple-url.html](./examples/simple-url.html): `<leaflet-gpx>` with `data-src` only
- [customized-url.html](./examples/customized-url.html): `<leaflet-gpx>` with customzing attributes
- [dnd.html](./examples/dnd.html): Displaying a Drag & Drop-ed GPX file with `setGpx(xml)` method

## `<leaflet-gpx>` attributes

- `data-src`: fetch URL of a displaying GPX XML file
- `data-info-span`: marker span of `trkpt`s (default: `"60"`) 
- `data-info-size`: base meter size of marker (defalut: `"10"`)
- `data-info-colors`: comma separated color names (default: `"cyan,magenta"`)

### Unstable features

- `data-ipfs-cid`: [IPFS](http://ipfs.io/) cid of a displaying GPX XML file

## `LeafletGpx` class API

- `this.setGpx(xml, dataset = this.dataset)`: update GPX XML text
- `this.map`: a `Map` object of Leaflet
- `this.cursor: a `Marker` object for slider controlling
- `this.layer`: a `LayerGroup` object contains lines, markers, and the `cursor`
- `this.infos`: a list of info from GPX `trkpt` elements
- `this.slider`: a `<input type="range">` element for moving the `cursor`
- `this.control`: a `Control` object for the top-right download link panel

## Reference

- Leaflet a JavaScript library for interactive maps: https://leafletjs.com/
