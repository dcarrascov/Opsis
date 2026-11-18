#!/usr/bin/env bash
# Copia uxplay.exe como sidecar y reúne sus DLLs y plugins de GStreamer en src-tauri/runtime.
# Se ejecuta en MSYS2 UCRT64 después de build-uxplay.sh.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
UX="$DIR/../UxPlay/build/uxplay.exe"
OUT="$DIR/src-tauri/runtime"

[ -f "$UX" ] || { echo "No existe $UX: ejecuta antes scripts/build-uxplay.sh"; exit 1; }

mkdir -p "$OUT/bin" "$OUT/lib/gstreamer-1.0" "$DIR/src-tauri/binaries"
cp "$UX" "$DIR/src-tauri/binaries/uxplay-x86_64-pc-windows-msvc.exe"

# Lista inicial de plugins: ajustar ejecutando con GST_DEBUG=2 hasta que no falte ninguno
# (elementos sacados de renderers/*.c de UxPlay: audio = queue, avdec_aac/alac, audioconvert,
#  audioresample, volume, level; vídeo con -vrtp = queue, h264parse, rtph264pay, udpsink;
#  carátulas = jpegdec, videoflip, imagefreeze, textoverlay)
PLUGINS="coreelements app rtp rtpmanager udp playback typefindfunctions videoparsersbad
         audioparsers audioconvert audioresample volume level autodetect wasapi wasapi2
         directsound libav d3d11 d3d12 videoconvertscale videofilter jpeg imagefreeze pango"
for p in $PLUGINS; do
  f="/ucrt64/lib/gstreamer-1.0/libgst$p.dll"
  if [ -f "$f" ]; then cp -u "$f" "$OUT/lib/gstreamer-1.0/"; else echo "aviso: falta el plugin $p"; fi
done

# Todas las DLL de /ucrt64 de las que dependen uxplay.exe y los plugins
for f in "$UX" "$OUT"/lib/gstreamer-1.0/*.dll; do
  ldd "$f" | awk '/\/ucrt64\// {print $3}'
done | sort -u | xargs -I{} cp -u {} "$OUT/bin/"

# gst-plugin-scanner lo necesita GStreamer para leer los plugins
mkdir -p "$OUT/libexec/gstreamer-1.0"
cp -u /ucrt64/libexec/gstreamer-1.0/gst-plugin-scanner.exe "$OUT/libexec/gstreamer-1.0/" 2>/dev/null || true

echo "Runtime listo en $OUT ($(ls "$OUT/bin" | wc -l) DLLs, $(ls "$OUT/lib/gstreamer-1.0" | wc -l) plugins)"
