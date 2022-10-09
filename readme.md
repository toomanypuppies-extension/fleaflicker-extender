# Fleaflicker extended

A chrome/firefox extension to extend the capabilities of the fleaflicker site.

## Build

1. Clone this repo locally and `cd` into the repo root
2. Have yarn installed and run `yarn`

> yarn version 1.22 should be used. Install instructions can be found at https://classic.yarnpkg.com/lang/en/docs/install/
> This was built on a windows machine, but no difference would be expected if building this on linux/mac

### Chrome build
3. Run `yarn build:chrome`
4. (Optional if packaging for upload to store) Use 7z or other zip util to zip `extension-build-chrome`

### Firefox build
3. Run `yarn build:firefox`
4. (Optional if packaging for upload to store) Use 7z or other zip util to zip the contents of `extension-build-firefox`

## Local Dev

1. Clone this repo locally and `cd` into the repo root
2. Have yarn installed and run `yarn`
3. Run `yarn watch`
4. Open chrome and go to extension manager page
5. Toggle developer mode on
6. Click "Load Unpacked"
7. Navigate to fleaflicker site to see extension load in

## Local Dev for standalone site
Using https://chrome.google.com/webstore/detail/allow-cors-access-control/lhobafahddgcelffkeicbaginigeejlf/related?hl=en extension for CORS. Will need a proxy setup for prod.

Need to use https://github.com/chimurai/http-proxy-middleware and setup an express server. That server will handle the proxies and also be the one that hosts the static files for the site

>
> Any changes to the extension require that you hit the refresh button on the extensions page for the unpacked extension. Hot module reloading does not work.
>

## Todo
- Check FetchLeagueActivity on load and see if last any activity occurred since cache update. If so, then re-fetch. Else re-fetch if last fetch was yesterday.
- Find a way to see what days each player has games this week. Be able to display column showing "M, Tu, Th, Sa"
  - Integrate with nhlstats to get games for this week, join with players:
  - https://statsapi.web.nhl.com/api/v1/schedule?startDate=2022-02-21&endDate=2022-02-27
  - Build in "Has games these days select dropdown"
- Create select dropdown to filter by fantasy owner(s) (lets people quickly compare player to player for their matchup)
- Build in "Current week or future week dropdown"
- Modualize components to support multiple sports using this extension
- Build in pruning for localStorage entries to keep usage at minimum
- See if unlimited storage permission should be requested for localstorage use
- Add in search by nickname easter egg. "Johnny Hockey" === "Johnny Gaudrea"
