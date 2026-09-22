# MCR Live Lite

**Small, independent browser/phone-VR simulator. Six controls. Two monitors and one TV.**

## Upload this ZIP to GitHub → Render

1. Extract this ZIP. Upload **the extracted contents**, not the ZIP, to a GitHub repository. `index.html`, `package.json`, `render.yaml`, `src/`, `vendor/`, and `media/` should be at the repository root. Keep the `vendor/` folder: it contains the bundled Three.js runtime.
2. In Render choose **New → Static Site**, connect the repository, then set:
   - **Build Command:** `node scripts/build.mjs`
   - **Publish Directory:** `dist`
   - **Root Directory:** leave blank (if the files are at repository root).
   - **Environment:** `NODE_VERSION` = `24.21.0`, `SKIP_INSTALL_DEPS` = `true`.
3. Deploy. Open the generated **HTTPS** address in your browser. No backend, database, npm install, start command, or SPA rewrite is needed.

Alternatively, Render **New → Blueprint** can use the included `render.yaml` to fill in these settings. Upload `render.yaml` at repository root for this option.

The original reference photos are **not included in this ZIP**. The room and interface are simplified recreations. The left screen is a **Cloudport-style mock**, not Amagi software or an integration with it.

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

## Replace the very basic placeholders

Put files with these **exact case-sensitive names** in the `media/` folder, commit/push, and Render will rebuild:

```text
media/
  Input A.mp4
  Input B.mp4
  Break.mp4
  Rescue.mp4
```

Use small **H.264 MP4** clips (AAC audio if needed); 720p is a sensible phone starting point. WebM, PNG, JPG/JPEG, or SVG also work when supported by the browser. Do not rename an unsupported file's extension and expect conversion.

You can leave the four supplied `.svg` placeholders in place: the build prefers `.mp4`, then `.webm`, `.png`, `.jpg`, `.jpeg`, and finally `.svg`. You do **not** need to edit any code or JSON. If you only add Input A, the other three sources keep their placeholders. Respect GitHub's upload/file-size limits; use short demo clips rather than full programmes.

For a quick test, expand **Your media & quick controls** and choose correctly named files from your device. Those files remain in that browser session and are **not uploaded or saved to the deployed site**. Reload returns to the repository's media.

**Program audio** is off initially. Enable the checkbox to hear only the current channel's video audio. Placeholders have no sound; monitor meters/real audio hardware are not simulated. Changing tabs mutes audio for safety. Unsupported/blocked media gets a visible fallback notice.

## Desktop and phone VR

- **3D room:** drag to look; click the desk buttons or the button row on the left monitor.
- **Large screens:** the same three live displays at a readable size, with the same controls. Also works as a fallback if WebGL is unavailable.
- Keyboard: **1**, **2**, **Space** (take), **B** (break), **L** (return), **O** (off), **R** (recenter).
- **Cardboard/JioDive:** open the Render HTTPS URL directly in current Chrome (Android) or Safari (iPhone). Tap **Enter headset → Start with head tracking**, grant motion permission, rotate to landscape, and insert the phone.
- Hold your gaze on a button for **1.3 seconds**. Look away before repeating it. Look below the desk controls for **RECENTER** and **EXIT VR**. A touch trigger or standard gamepad A button can also activate the looked-at control. Space/Enter acts as the trigger in VR.
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

The built site uses only local assets/modules. No accounts, analytics, camera or microphone recording, or real broadcast connections. Uploaded repository media becomes publicly accessible with the Render site: only publish material you are authorized to share. A private GitHub repository does not make the deployed website private.

## Validation limits

Unit/geometry tests and build/resource checks are included/performed. Browser automation was blocked by Windows application policy in the development environment; rendered WebGL output and real phone/headset behavior have not been certified. Test a short session on your own phone before relying on this for training.

Three.js 0.180.0 is included under the MIT license; see `vendor/LICENSE.txt`. Product names are descriptive references only; no affiliation is claimed.
