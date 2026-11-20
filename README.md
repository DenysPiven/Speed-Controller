# Speed Controller

A Chrome extension that changes the playback speed of any HTML5 video or audio. Everything is controlled from the toolbar popup — there are no keyboard shortcuts, so it never steals keys in games or text fields.

## Features

- **Three scopes.** Set the speed **for this tab**, **for this domain** or **for all tabs**. A tab setting wins over a domain setting, and a domain setting wins over the global one. Tab settings are forgotten when the tab closes; domain and global settings are saved.
- **Fine and quick control.** `-5%`, `-1%`, `+1%`, `+5%` buttons, a field to type any value (7–1600%), and presets: 25, 50, 75, 90, 100, 110, 125, 150, 175, 200, 250 and 1600%.
- **Now playing.** When the page has media, the popup shows which site the media is playing on (including players inside iframes), whether it is playing or paused, and the current time.
- **Badge.** The toolbar icon shows the current speed of the tab, e.g. `2.00`.
- **ON / OFF and Reset all.** Turn the extension off without losing settings, or clear every saved speed at once.
- **Sticky speed.** Players that reset the speed on load or between videos are set back to the chosen speed.
- **No shortcuts.** The extension registers no keyboard listeners at all. Until you pick a speed, it leaves the site's own speed setting alone.

## Installation

1. Download `speed-controller-<version>.zip` from the [latest release](https://github.com/DenysPiven/Speed-Controller/releases/latest) and unzip it to a folder you'll keep (Chrome loads the extension from there).
2. Open `chrome://extensions` and turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the unzipped `speed-controller` folder.
4. Pin the extension icon to the toolbar.

To update, replace the folder's contents with a newer release and click the reload button on the extension's card. You can also `git clone` the repository and load that folder instead.

If a page was open before the extension was installed, reload it.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (Manifest V3) |
| `background.js` | Stores speeds per tab, domain and globally; updates the badge and open tabs |
| `content.js` | Applies the speed to every `<video>`/`<audio>` in the page and its frames |
| `popup.html`, `popup.css`, `popup.js` | Popup: scope, speed controls, presets, now playing |
| `icons/` | Logo and toolbar icons |
| `fonts/` | Poppins (SIL Open Font License, see `fonts/OFL.txt`) |
