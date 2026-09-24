# User-supplied demo footage

Prepared and independently verified on **2026-09-24** for phone VR and Render delivery. These are ordinary 2D video textures, not stereoscopic or 360° recordings. `Rescue.svg` remains the standby slate.

## Rights and provenance

`Input A.mp4`, `Input B.mp4`, and `Break.mp4` were supplied directly by the project owner for this build. No public-source or third-party licence is asserted here. Deploy only if you are authorized to publish the underlying footage, audio, people, brands, and locations; a public Render site makes these files publicly accessible.

Source-file checksums:

```text
dee28d6c563bbcf0b542dfc295da8514d61f882c8048b3e36a671a0b1af8fbf7  Input A source.mp4
6c2e1ceac844282e15f07a0f4af6ba2cc3ea244347a4ae3c2cba6f8d2fa65ba2  Input B source.mp4
3d6bec56e3008785a2255fe448afcd3d2f9b4398ab07f7d486e662e2f021db4a  Break source.mp4
```

The source uploads and temporary encoding files are outside the app and are not packaged.

## Delivered files

| App asset | Duration | Frame rate | Audio | Exact size |
| --- | ---: | ---: | --- | ---: |
| `Input A.mp4` | 13.247 s | 29.97 fps | None | 6,833,643 bytes |
| `Input B.mp4` | 15.000 s | 25 fps | None | 7,731,776 bytes |
| `Break.mp4` | 12.811 s | 29.97 fps | AAC-LC stereo, 48 kHz | 545,935 bytes |

**Combined MP4 size: 15,111,354 bytes (14.41 MiB).** The two large originals were reduced from about 24 MB and 96 MB respectively; the packaged clips remain well below GitHub's per-file limit.

All three use:

- MP4 with **H.264 High Profile, Level 3.1**, hardware-friendly `yuv420p`, progressive 8-bit BT.709 video.
- **1280×720**, square pixels, with the source aspect ratio preserved and no cropping.
- A maximum of **30 fps** to halve the decode work of the two 59.94 fps sources; the native 25 fps clip remains 25 fps.
- CRF 21 with a 4 Mbit/s VBV ceiling and 8 Mbit buffer; keyframes at most roughly two seconds apart.
- MP4 **faststart** (`moov` before `mdat`) for progressive loading and byte-range playback on Render.
- Source metadata removed and a local app title added. Input A and Input B have no audio stream because their sources had none. Break audio is AAC-LC; program audio remains off by default in the app.

Matching **1280×720 JPEG posters** were extracted from the optimized clips. Input A and Input B use a frame at 5 seconds; Break uses a readable frame at 8 seconds.

## Output checksums

```text
1ffa571fd8fca0965db873c6a6795c0d98309737c67f784061d4d55eb222432e  Input A.mp4
b0c3dd3284718e060211dba59c198072ced421bbcd12ed3c40facf02ad103c1c  Input B.mp4
e2907c1b0a0ab39e2fe4a21b4b4c8d297a99d0baa480dfbeb78725303b9d2140  Break.mp4
cba933c608256aa84372e07a2a904d3e8358e53f6e7b6084905cb281383d0309  Input A.jpg
e658a627e4f7c5a3c19cad3b535a3d6c28fa883ac83052d60e53683f54fcfa6a  Input B.jpg
f4fe8c3c1cec7a5aa2ce6fc46446e56bdaefadb135c9cf736307f9bf110c5671  Break.jpg
```

## Verification

FFprobe confirmed codecs, profiles, dimensions, rates, frame counts, audio, and durations. FFmpeg 6.1.1 fully decoded every output with fatal-error checking: **397**, **375**, and **382** video frames respectively. Independent atom checks confirmed faststart on every MP4, and all three posters were visually reviewed before packaging.
