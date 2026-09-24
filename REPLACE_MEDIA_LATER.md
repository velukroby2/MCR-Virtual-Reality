# Replace the demo media later

The current user-supplied clips can stay in place while you test the room, resolution and headset comfort. Replacing them later does not require any JavaScript changes.

## Quick private test on the phone

1. Open the site normally (before entering headset mode).
2. Expand **Your footage & quick controls**.
3. Select one or more files with these exact names:

   - `Input A.mp4`
   - `Input B.mp4`
   - `Break.mp4`
   - `Rescue.mp4` (optional; the SVG standby slate can remain)

4. Enter headset mode and test. These files remain only in that browser tab. Reloading restores the deployed media.

## Permanent replacement on GitHub and Render

1. Open the repository's `media` folder.
2. Replace `Input A.mp4`, `Input B.mp4`, and `Break.mp4` without changing their spelling or capitalization. Add `Rescue.mp4` only if you want moving rescue content.
3. Replace each matching poster (`Input A.jpg`, `Input B.jpg`, `Break.jpg`) with a frame from the new clip, or delete the old poster. Never leave an old poster beside a new clip.
4. Commit and push the changes.
5. Let Render redeploy automatically, or choose **Manual Deploy → Deploy latest commit**.
6. Hard-refresh the phone browser and verify each source before entering the headset.

The build automatically selects media in this order: MP4, WebM, PNG, JPG/JPEG, then SVG. The existing SVG placeholders may remain in the folder.

## Phone-friendly video settings

Use H.264 MP4 with AAC audio, `yuv420p`, 24 or 30 fps, and web fast-start. **1280×720** is the recommended balance: the simulator's screen canvases are 1024×576, so 1080p usually adds decoding load without visible benefit. Keep clips short and avoid 4K media; simultaneous decoding can cause heat and frame judder in phone VR.

Example FFmpeg command (run once for each source):

```powershell
ffmpeg -i source.mp4 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -r 30 -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -crf 21 -maxrate 4M -bufsize 8M -movflags +faststart -c:a aac -b:a 128k "Input A.mp4"
```

Change only the final output name for Input B and Break. If the source has no audio, add `-an` instead of the AAC options.

## Rights and documentation after a swap

Update `media/FOOTAGE.md` with the new files' provenance, encoding facts, and licence or authorization requirements. Also update the short description inside **Your footage & quick controls** in `index.html` if the format changes. Keep any attribution required by the replacement footage's licence.
