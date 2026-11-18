# Third-party notices

Opsis is free software released under the **GNU General Public License v3.0** (see `LICENSE`).
The Windows installer bundles the following third-party software. Each component keeps its
own license; all of them are compatible with distributing Opsis under the GPL-3.0.

## UxPlay — GPL-3.0

Opsis runs an **unmodified** build of UxPlay as a separate program (`uxplay.exe`) to receive
AirPlay. UxPlay does the AirPlay discovery, pairing and decryption; Opsis only receives the
video it forwards over local RTP/UDP.

- Project: <https://github.com/FDH2/UxPlay>
- Exact source used for the bundled binary: commit
  [`48f5ce47c9ef694afccfac907c9e8828329657fe`](https://github.com/FDH2/UxPlay/tree/48f5ce47c9ef694afccfac907c9e8828329657fe)
  (UxPlay 1.74, before its release tag).
- Build: `scripts/build-uxplay.sh` (MSYS2 UCRT64, CMake + Ninja, no source changes).
- License: GNU GPL v3.0 — the same text as this repository's `LICENSE`.

## Runtime libraries (from MSYS2 UCRT64)

`uxplay.exe` depends on DLLs and GStreamer plugins taken from the
[MSYS2](https://www.msys2.org/) UCRT64 packages by `scripts/collect-runtime.sh`. Their source
code is available from the MSYS2 package sources (<https://github.com/msys2/MINGW-packages>)
and from each upstream project.

| Component | License |
|---|---|
| GStreamer core and plugins (base, good, bad, gst-libav) | LGPL-2.1-or-later |
| FFmpeg (libavcodec, libavformat, libavutil, libswscale, libswresample, libavfilter) — MSYS2 build with GPL components (x264, x265, Xvid) | GPL-2.0-or-later |
| x264, x265, Xvid | GPL-2.0-or-later |
| GLib, GObject, GIO | LGPL-2.1-or-later |
| libplist | LGPL-2.1-or-later |
| OpenSSL (libcrypto) | Apache-2.0 |
| GnuTLS, Nettle, libtasn1, libidn2, p11-kit | LGPL-2.1-or-later / GPL-2.0-or-later (dual) |
| Cairo, Pango, HarfBuzz, FreeType, Fontconfig, Pixman, FriBidi | LGPL / MIT / FreeType License |
| libvpx, dav1d, libaom, SVT-AV1, rav1e, Opus, Vorbis, Ogg, Theora, Speex, libwebp | BSD-style |
| LAME, mpg123, libass, libbluray, libgme, libmodplug, libzvbi, opencore-amr | LGPL / GPL (various) |
| zlib, libpng, libjpeg-turbo, libtiff, libxml2, zstd, xz, bzip2, brotli, expat, libffi | permissive (zlib / BSD / MIT style) |
| GCC runtime (libgcc, libstdc++, libgomp), winpthreads | GPL-3.0 with the GCC Runtime Library Exception / MIT and BSD style |

The complete list of bundled files is in `runtime/bin` and `runtime/lib/gstreamer-1.0`
inside the installation folder.

## Application framework

| Component | License |
|---|---|
| [Tauri](https://tauri.app/) and its plugins, and their Rust dependencies | MIT / Apache-2.0 |
| [Vite](https://vitejs.dev/), TypeScript (build tools, not shipped) | MIT / Apache-2.0 |
| Microsoft Edge WebView2 Runtime (provided by Windows) | Microsoft software license |

## Trademarks

AirPlay and iPhone are trademarks of Apple Inc. Opsis is an independent project, not
affiliated with or endorsed by Apple. The device frame is an original drawing made from public
dimensions; no Apple artwork or fonts are included.
