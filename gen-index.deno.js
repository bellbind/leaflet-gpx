#!/usr/bin/env -S deno run --allow-read 
// deno run --allow-read gen-index.deno.js
const data = [];
for await (const entry of Deno.readDir("gpx")) {
  if (entry.isFile) data.push({href: `./gpx/${entry.name}`});
}
data.sort((a, b) => a.href < b.href ? -1 : a.href.localeCompare(b.href));
//console.log(JSON.stringify(data));
console.log("[");
console.log(`  ${data.map(entry => JSON.stringify(entry)).join(",\n  ")}`);
console.log("]");
