#!/usr/bin/env bash
# Compila UxPlay en una terminal MSYS2 UCRT64 (C:\msys64\ucrt64.exe).
# Uso:  ./scripts/build-uxplay.sh [tag]     (por defecto, el tag fijado abajo)
set -euo pipefail

# Fija SIEMPRE una versión concreta. La 1.74 (mDNS propio, sin Bonjour) aún no tiene tag
# (18-11-2026: el último es v1.73.7), así que se usa este commit de master.
TAG="${1:-48f5ce47c9ef694afccfac907c9e8828329657fe}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$DIR/../UxPlay"

pacman -S --needed --noconfirm git \
  mingw-w64-ucrt-x86_64-cmake mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-ninja \
  mingw-w64-ucrt-x86_64-openssl mingw-w64-ucrt-x86_64-libplist \
  mingw-w64-ucrt-x86_64-gstreamer mingw-w64-ucrt-x86_64-gst-plugins-base \
  mingw-w64-ucrt-x86_64-gst-plugins-good mingw-w64-ucrt-x86_64-gst-plugins-bad \
  mingw-w64-ucrt-x86_64-gst-libav

if [ ! -d "$SRC" ]; then
  git clone https://github.com/FDH2/UxPlay "$SRC"
fi
cd "$SRC"
git fetch --tags
git checkout "$TAG"

mkdir -p build && cd build
cmake -G Ninja ..        # plan B si el iPhone no ve el PC: cmake -G Ninja -DUSE_DNS_SD=1 ..
ninja

echo
echo "Hecho: $SRC/build/uxplay.exe"
echo "Prueba:  ./uxplay -p -n Prueba -nh"
