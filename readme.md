# Fleaflicker extended

A chrome/firefox extension to extend the capabilities of the fleaflicker site.

## Build

1. Clone this repo locally and `cd` into the repo root
2. Have yarn installed and run `yarn`

> yarn version 1.22 should be used. Install instructions can be found at <https://classic.yarnpkg.com/lang/en/docs/install/>
> This was built on a windows machine, but no difference would be expected if building this on linux/mac

### Chrome build

3. Run `yarn ex:build:chrome`
4. (Optional if packaging for upload to store) Use 7z or other zip util to zip `extension-build-chrome`

- important, chrome needs the top level folder (`extension-build-chrome`) and contents in the zip.

### Firefox build

3. Run `yarn ex:build:firefox`
4. (Optional if packaging for upload to store) Use 7z or other zip util to zip the contents of `extension-build-firefox`

- important, firefox needs the contents of the folder only in the zip.

## Local Dev for extension

1. Clone this repo locally and `cd` into the repo root
2. Have yarn installed and run `yarn`
3. Run `yarn ex:dev`
4. Open chrome and go to extension manager page
5. Toggle developer mode on
6. Click "Load Unpacked"
7. Navigate to fleaflicker site to see extension load in

>
> Any changes to the extension require that you hit the refresh button on the extensions page for the unpacked extension. Hot module reloading does not work.
>

## Local Dev for standalone site

Use [fleaflicker-extender-proxy](https://github.com/toomanypuppies-extension/fleaflicker-extender-proxy) to do local development. It should be running. This is deployed live to support the production version.

1. Clone this repo locally and `cd` into the repo root
2. Have yarn installed and run `yarn`
3. Run `yarn si:dev`

## Tests and checks

- `yarn test` runs the tests (node's test runner, no browser needed).
- The extension builds (`ex:build`, `ex:build:chrome`, `ex:build:firefox`) finish with
  `scripts/check-extension-css.mjs`, which fails if the extension's CSS could restyle fleaflicker's
  own page. Keep component styles `<style scoped>`, and put anything global inside `.mainContent`.
- `yarn vuestic-px` regenerates `src/styles/vuestic-px.css`, vuestic's sizes in px so its components
  are the same size on fleaflicker's page (10px root font) as on the standalone site. Run it after
  upgrading vuestic or registering another vuestic component in `src/main.js`.

## Proxy

Both the standalone site and the extension use
[fleaflicker-extender-proxy](https://github.com/toomanypuppies-extension/fleaflicker-extender-proxy):
the site for every fleaflicker and NHL call, the extension for the NHL schedule and
`/proxy/flea-rules`, the league settings fleaflicker's API doesn't have (add limit, waiver timing).
Without that route the app still works, but add limits and waiver status show as unknown.
