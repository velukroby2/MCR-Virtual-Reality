# Demo footage — Sintel excerpts

Prepared and independently verified on **2026-09-22**.

These three small demonstration videos were made from **one user-supplied film**, not a stock-footage bundle. They are ordinary 2D video textures for the browser/phone VR app, not stereoscopic or 360° recordings. `Rescue.svg` remains the existing standby slate and was not modified.

## Attribution and license

**Sintel (2010) — © copyright Blender Foundation | [durian.blender.org](https://durian.blender.org/)**

Licensed under **[Creative Commons Attribution 3.0 Unported (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/)**.

Authoritative sources checked:

- [Blender Foundation / Durian — Sharing](https://durian.blender.org/sharing/): explicitly licenses the project content under CC BY 3.0 and specifies the attribution above for reuse other than redistribution of the movie itself.
- [Blender Foundation / Durian — About](https://durian.blender.org/about/): identifies Sintel, the Blender Foundation project, and the film's release and running time.
- [Creative Commons license deed](https://creativecommons.org/licenses/by/3.0/): permits sharing and adaptation, including commercial reuse, subject to its terms.

**Changes:** the source was trimmed into the ranges below, downscaled, letterboxed without cropping, recompressed, and given short audio-edge fades. The JPG posters are resized stills extracted from the resulting clips. No endorsement by the Blender Foundation is implied.

Keep this attribution and license link with the clips and posters when distributing them. The official sharing page requires the entire credit scroll when redistributing/screening/broadcasting the movie itself; these are short edited excerpts, not the full movie. The film's full credit scroll is not included in these samples. Logos and trademarks are excluded from the project's CC license as explained on the sharing page.

## Source provenance

- User-supplied public URL: <https://drive.google.com/file/d/1UNmPDVKiyRZi4n2lZ2GCfes-iOM9quDM/view?usp=sharing>
- Drive title: **Sintel - Open Movie by Blender Foundation.mp4**.
- Download: followed the ordinary public Google Drive download form and its standard “too large to scan for viruses” / “Download anyway” confirmation. No authentication, imported cookies, private API, or restriction bypass was used.
- Actual downloaded original: **184,792,502 bytes**; **888.094 s**; **1920×818**, **24 fps**, H.264/yuv420p video with AAC-LC stereo audio at 44.1 kHz.
- Original SHA-256: `f25b74c58212b1a9bd16c007626a86f38b1945eebf0e486239a4f18cf2ea1ad5`.
- Original work file: `../.mcr-media-work/Sintel-source.mp4`, relative to the app root. It is **not an app asset and must not be packaged**.

The license is verified from the official film/project pages, not inferred merely from the Drive file's public availability.

## Delivered excerpts

Times are measured from the beginning of the downloaded original; each end time is exclusive. The selections avoid the opening fight, title/credit sequences, and graphic scenes. Contact sheets were visually reviewed before selection and again from the encoded outputs at one frame per second.

| App asset | Source range | Duration | Scene | Exact size | Size (MiB) |
| --- | --- | ---: | --- | ---: | ---: |
| `Input A.mp4` | 00:04:16–00:04:40 | 24.000 s | Daylight market, Sintel, and the young dragon | 1,680,558 bytes | 1.603 |
| `Input B.mp4` | 00:04:44–00:05:08 | 24.000 s | Sunset rooftops and the young dragon's flight, before the predator scene | 2,100,942 bytes | 2.004 |
| `Break.mp4` | 00:06:06–00:06:26 | 20.000 s | Moon/sun transition, desert dunes, and bamboo journey, before the canyon action | 1,595,102 bytes | 1.521 |

**Combined MP4 size: 5,376,602 bytes (5.128 MiB).** One MiB is 1,048,576 bytes.

All three share these browser/phone-oriented settings:

- MP4 container; **H.264 / `avc1`, Constrained Baseline, Level 3.0**.
- **640×360**, square pixels, **yuv420p**, constant **24 fps**. The wider original picture is letterboxed rather than stretched or cropped.
- Two-second keyframe spacing; libx264 slow preset, CRF 26, 900 kbit/s maximum video rate, 1,800 kbit buffer.
- **AAC-LC**, stereo, **44,100 Hz**, nominal **96 kbit/s** audio. Original soundtrack retained; 60 ms fade-in and 120 ms fade-out reduce edge clicks.
- MP4 **faststart**: the `moov` index precedes `mdat`, so playback need not wait for the whole file to download.
- Embedded title, Blender Foundation credit, license links, and modification/source-range notes.
- Natural editorial cuts are retained; these are not advertised as seamless-loop footage.

### Optional poster images

Each JPEG is **640×360**, from the encoded clip, and covered by the same attribution/license above.

| Poster | Time within clip | Exact size |
| --- | ---: | ---: |
| `Input A.jpg` | 12 s | 25,959 bytes |
| `Input B.jpg` | 10 s | 21,676 bytes |
| `Break.jpg` | 4 s | 10,174 bytes |

### Output checksums

```text
021682476ace39caba7eb67b474d4ba7886bed8f29ac2c982f093ea2678ba18e  Input A.mp4
b489f1a311a05737b8ec59ffae36372d28f12892fa8465a4b5d9b22474a37469  Input B.mp4
e294594972a0f6557309708872d1e973f6e74287efbf0a928d3055e1e0a1eccd  Break.mp4
```

## Verification and tooling

- **FFprobe 9.0.2** independently checked the final codec/profile/level, dimensions, pixel format, frame rate, audio format, duration, and decoded-frame counts: **576**, **576**, and **480** video frames respectively.
- **FFmpeg 9.0.2** fully decoded both video and audio of every output with `-xerror -err_detect explode`; all completed successfully.
- A black-picture detector found no black segment lasting at least 0.25 s in the central active picture (excluding the intentional letterbox bars).
- Independent MP4 atom inspection confirmed `moov` before `mdat` for all three files.
- Visual inspection used extracted contact sheets, not a browser. Physical phone/browser/VR playback was not exercised by this media-preparation step and should be checked during app integration.

The Windows encoding tools came from [gyan.dev's FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/), a provider linked by the [official FFmpeg download page](https://ffmpeg.org/download.html). The exact package was `ffmpeg-9.0.2-essentials_build.7z`, and its SHA-256 matched the [publisher's checksum](https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.7z.sha256):

```text
4705843ccaaf54257c16ad90f3e952ece33c17df964ecf7bfdbb0f49c7171077
```

The original download, FFmpeg package/binaries, preparation scripts, contact sheets, probe results, and decode logs are confined to **`../.mcr-media-work/` outside the app**. Do not include that working directory in an app archive. Only the three MP4s, three small JPGs, and this attribution document are new app media deliverables.
