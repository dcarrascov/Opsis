/** Recorre los NAL de un fotograma Annex B (separados por 00 00 01 o 00 00 00 01). */
export function* nals(au: Uint8Array): Generator<Uint8Array> {
  let i = 0;
  let inicio = -1;
  while (i + 2 < au.length) {
    if (au[i] === 0 && au[i + 1] === 0 && au[i + 2] === 1) {
      if (inicio >= 0) yield au.subarray(inicio, au[i - 1] === 0 ? i - 1 : i);
      i += 3;
      inicio = i;
    } else i++;
  }
  if (inicio >= 0) yield au.subarray(inicio);
}

/** Devuelve el SPS (NAL tipo 7) del fotograma, si lo lleva. */
export function buscarSps(au: Uint8Array): Uint8Array | null {
  for (const n of nals(au)) if ((n[0] & 0x1f) === 7) return n;
  return null;
}

/** 'avc1.PPCCLL' a partir de profile_idc, constraint flags y level_idc del SPS. */
export function codecDesdeSps(sps: Uint8Array): string {
  const h = (b: number) => b.toString(16).padStart(2, '0').toUpperCase();
  return `avc1.${h(sps[1])}${h(sps[2])}${h(sps[3])}`;
}
