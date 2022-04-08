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

## API

- `setGpx(xml, dataset = this.dataset)`: update GPX XML text

## Reference

- Leaflet a JavaScript library for interactive maps: https://leafletjs.com/
