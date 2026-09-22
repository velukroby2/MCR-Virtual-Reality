# MCR Live — Reference Studio 1.1

**Photo-referenced browser/phone-VR simulator. Six controls. Two monitors and one TV.**

## Updating the already-working Render site

Upload/replace the **complete contents** of this ZIP in your existing GitHub repository, then commit and use **Render → Manual Deploy → Deploy latest commit**. This is a full scene/media update, not just the earlier one-file server fix. Include the new `assets/` folder, `src/room.js`, `vendor/RoundedBoxGeometry.js`, and all media files. Back up any custom media first.

Your current working Web Service settings can remain **`yarn install; yarn build`** and **`yarn start`**. The `0.0.0.0` / Render `PORT` fix is retained. After deployment, refresh the browser (hard-refresh if you see the old room). The build log now identifies **MCR Reference Studio 1.1**.

## Upload this ZIP to GitHub → Render

1. Extract this ZIP. Upload **the extracted contents**, not the ZIP, to a GitHub repository. `index.html`, `package.json`, `render.yaml`, `src/`, `vendor/`, `assets/`, and `media/` should be at the repository root. Keep the `vendor/` folder: it contains the bundled Three.js runtime.
2. In Render choose **New → Static Site**, connect the repository, then set:
   - **Build Command:** `node scripts/build.mjs`
   - **Publish Directory:** `dist`
   - **Root Directory:** leave blank (if the files are at repository root).
   - **Environment:** `NODE_VERSION` = `24.21.0`, `SKIP_INSTALL_DEPS` = `true`.
3. Deploy. Open the generated **HTTPS** address in your browser. No backend, database, npm install, start command, or SPA rewrite is needed.

Alternatively, Render **New → Blueprint** can use the included `render.yaml` to fill in these settings. Upload `render.yaml` at repository root for this option.

### If you already created a Render Web Service

You can keep that service with this updated package:

- **Build Command:** `node scripts/build.mjs` (the existing `yarn install; yarn build` also works).
- **Start Command:** `node scripts/serve.mjs` (the existing `yarn start` also works).
- Leave Render's `PORT` environment variable alone; the server reads it automatically.
- The server now binds to **`0.0.0.0`**, so Render can detect the port. If you configured `HOST` yourself, set it to `0.0.0.0` or remove it.
- If an earlier deploy reported “No open ports detected on 0.0.0.0”, replace `scripts/serve.mjs` with this version, commit/push, then redeploy the latest commit.

A Static Site is still the simpler option for this entirely client-side app. An existing Web Service is not converted merely by adding `render.yaml`; create a new Static Site or keep the corrected Web Service.

## The upgraded room

- Blue fabric acoustic panels, dark frame joints, woven carpet and a mottled acoustic ceiling.
- Curved laminate desk with rounded edges, cyan base/desk lighting and contact shadows.
- Glass rear doorway, warm office lighting, ceiling grilles and downlights.
- Detailed monitor arms, keyboard, mouse, speakers, red audio interface, intercom, gooseneck mic, headphones, cables and an operator chair. These props are decorative; the six playout controls are the functional equipment.
- Physical materials, soft cached shadows, and reflections derived from your supplied panorama.
- A thin desk-level console instead of the tall panel that obscured the monitors. The lower monitors no longer mask the bottom of the TV either. Feedback in VR sits below the monitor sightline.

**3D room** is a rebuilt approximation based on the references, not a measured scan or a claim of exact dimensions. The left screen is a **Cloudport-style mock**, not Amagi software or an integration with it.

**Original 360** lets you inspect the actual supplied 2896×1448 panorama. It is deliberately labeled a **static photograph**: the screens captured in that photograph are not live. Return to **3D room** or **Large screens** for live video displays. The six main controls keep the same simulation state across views. In a headset, the **ORIGINAL 360 / 3D ROOM** utility switches back and forth.

The supplied photograph **is now included** as `assets/room-reference.jpg`, used locally for reflections and the original-photo view. Publishing this app also makes that photo (including visible people and room details) publicly accessible. No other reference photos or original film downloads are bundled.

If an older phone struggles, enable **Lighter graphics** before entering the headset. This reduces resolution, disables shadow rendering and lowers screen-refresh work; the controls and footage remain available.

## Exactly what the controls do

| Control | Result |
|---|---|
| INPUT A | Select Input A on the left monitor; channel stays unchanged. |
| INPUT B | Select Input B on the left monitor; channel stays unchanged. |
| TAKE LIVE | Send the selected input to the channel preview. |
| AD BREAK | Send Break to the channel, remembering the last live input. Requires live mode. |
| RETURN LIVE | Return from the break to that previous live input, even if you selected another input meanwhile. |
| TURN OFF LIVE | Send Rescue to the channel. |

**TV 1:** all four sources, selected/on-channel tallies, and US Eastern/UTC/IST clocks.

**Left monitor:** selected source inside a compact dark/orange Cloudport-style rundown layout.

**Right monitor:** the channel preview/output — Input A, Input B, Break, or Rescue.

Breaks and video inputs loop. Return from a break manually. This is local browser simulation, not real broadcast transmission. Each visitor has independent state; it is not a shared control room.

## Included low-resolution footage / replacing media

Your Drive link contains one film, **Sintel**, not a multi-video bundle. This edition includes three different short excerpts, all **640×360 at 24 fps, H.264 Baseline/yuv420p + AAC, with MP4 faststart**:

- **Input A:** 24 seconds — daylight market / young dragon.
- **Input B:** 24 seconds — sunset rooftops / flight.
- **Break:** 20 seconds — moon/sun transition, desert and bamboo journey.
- **Rescue:** the existing quiet standby slate (SVG).

The three MP4s total about **5.13 MiB**; they loop independently. Matching JPG posters avoid a blank tile while a clip starts. These are ordinary 2D videos shown on the screens, not 360 or stereo video.

**Sintel © Blender Foundation | [durian.blender.org](https://durian.blender.org/) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).** Clips/posters were trimmed, downscaled, letterboxed and recompressed; no endorsement is implied. Keep the UI attribution and `media/FOOTAGE.md`, which contains source timings, attribution, checksums and encoding details.

To replace a clip, put files with these **exact case-sensitive names** in the `media/` folder, commit/push, and Render will rebuild:

```text
media/
  Input A.mp4
  Input B.mp4
  Break.mp4
  Rescue.mp4
```

Use small **H.264 MP4** clips (AAC audio if needed); 720p is a sensible phone starting point. WebM, PNG, JPG/JPEG, or SVG also work when supported by the browser. Do not rename an unsupported file's extension and expect conversion.

When replacing a supplied MP4, also replace or delete its matching `.jpg` poster so a loading tile does not show the old footage. If you want a source to revert to its SVG, remove both its MP4 and JPG (higher-priority media wins).

You can leave the four supplied `.svg` placeholders in place: the build prefers `.mp4`, then `.webm`, `.png`, `.jpg`, `.jpeg`, and finally `.svg`. You do **not** need to edit any code or JSON. Only the matching source is replaced; the other sources keep their existing media. Respect GitHub's upload/file-size limits; use short demo clips rather than full programmes.

For a quick test, expand **Your footage & quick controls** and choose correctly named files from your device. Those files remain in that browser session and are **not uploaded or saved to the deployed site**. Reload returns to the repository's media.

**Program audio** is off initially. Enable the checkbox to hear only the current channel's video audio. Placeholders have no sound; monitor meters/real audio hardware are not simulated. Changing tabs mutes audio for safety. Unsupported/blocked media gets a visible fallback notice.

## Desktop and phone VR

- **3D room:** drag to look; click the desk buttons or the button row on the left monitor.
- **Large screens:** the same three live displays at a readable size, with the same controls. Also works as a fallback if WebGL is unavailable.
- Keyboard: **1**, **2**, **Space** (take), **B** (break), **L** (return), **O** (off), **R** (recenter).
- **Cardboard/JioDive:** open the Render HTTPS URL directly in current Chrome (Android) or Safari (iPhone). Tap **Enter headset → Start with head tracking**, grant motion permission, rotate to landscape, and insert the phone.
- Hold your gaze on a button for **1.3 seconds**. Look away before repeating it. Look below the desk controls for **ORIGINAL 360 / 3D ROOM**, **RECENTER** and **EXIT VR**. A touch trigger or standard gamepad A button can also activate the looked-at control. Space/Enter acts as the trigger in VR.
- Adjust FOV and lens correction in the headset dialog. These are generic starting points, not manufacturer-certified lens profiles. Set lens correction to zero when viewing stereo without lenses.
- Dragging switches to manual looking. Exit and re-enter headset mode to re-enable sensors. Unsupported or denied motion falls back to drag-to-look. Browser fullscreen/orientation locking is best-effort, especially on iPhone.

This is **rotation-only phone VR**, not a native Quest/Pico WebXR application. Stay seated; stop if uncomfortable or your phone gets warm. Hardware compatibility and optical fit require testing on your actual device.

## Local use / development

Node 24:

```powershell
npm start     # builds and serves http://localhost:4180
npm test      # state, media naming, orientation, gaze and CPU geometry tests
npm run build
```

No dependency installation is needed. Do not open `index.html` with `file://`. Phone head tracking needs trusted HTTPS; use Render rather than your computer's localhost address on the phone.

The Node server now listens on all network interfaces by default for hosted compatibility. For a local-only preview in PowerShell, run `$env:HOST='127.0.0.1'` before `npm start`. Only built-site files are served; do not expose private media unintentionally.

The built site uses only local assets/modules. No accounts, analytics, camera or microphone recording, or real broadcast connections. Uploaded repository media becomes publicly accessible with the Render site: only publish material you are authorized to share. A private GitHub repository does not make the deployed website private.

## Validation limits

Unit/geometry tests and build/resource checks are included. The visibility regression casts a 25×17 grid over each screen from the center eye and both stereo eyes: **3,825 screen-area rays**, plus physical-button picking and viewport framing checks. This catches the actual panel/monitor occlusion, rather than testing only button centers. Video encoding was independently probed and fully decoded with FFmpeg; faststart and decoded frame counts were checked.

Browser automation remains blocked by Windows application policy in this development environment; these geometry/media checks are **not a claim of visually verified WebGL shaders or physical headset performance**. Test on your actual phone, and use Lighter graphics if needed.

Three.js 0.180.0 and its RoundedBoxGeometry helper are included under the MIT license; see `vendor/LICENSE.txt`. Media has its separate license described above. The supplied room photo is not covered by the film or Three.js licenses. Product names are descriptive references only; no affiliation is claimed.
