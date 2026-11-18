import { CAJA, IPHONE13 as M, PAD } from './iphone13';

/** Mezcla un color hex con blanco (t = 0…1). */
function aclarar(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 0xff, n & 0xff].map((v) => Math.round(v + (255 - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Genera el SVG del marco: canto de aluminio + cristal negro con un HUECO (mask) donde va
 * la pantalla, muesca encima del vídeo, altavoz y botones.
 * `tamano` añade width/height (necesario al pintarlo en un canvas).
 */
export function svgMarco(canto: string, tamano?: { w: number; h: number }): string {
  const { w: W, h: H } = CAJA; // 440 × 894
  const cx = W / 2;
  const sx = PAD + (M.cuerpo.w - M.pantalla.w) / 2; // esquina de la pantalla
  const sy = PAD + (M.cuerpo.h - M.pantalla.h) / 2;
  const n = M.muesca;
  const nx = cx - n.w / 2;

  // Muesca: «orejas» curvas arriba y esquinas redondeadas abajo
  const muesca = `M${nx - n.oreja},${sy} Q${nx},${sy} ${nx},${sy + n.oreja}
    L${nx},${sy + n.h - n.r} Q${nx},${sy + n.h} ${nx + n.r},${sy + n.h}
    L${nx + n.w - n.r},${sy + n.h} Q${nx + n.w},${sy + n.h} ${nx + n.w},${sy + n.h - n.r}
    L${nx + n.w},${sy + n.oreja} Q${nx + n.w},${sy} ${nx + n.w + n.oreja},${sy} Z`;

  const boton = (lado: 'izq' | 'der', b: { y: number; h: number }) => {
    const x = lado === 'izq' ? PAD - M.botones.fondo : PAD + M.cuerpo.w - 1;
    return `<rect x="${x}" y="${PAD + b.y}" width="${M.botones.fondo + 1}" height="${b.h}" rx="1.5" fill="url(#metal)"/>`;
  };

  const dims = tamano ? ` width="${tamano.w}" height="${tamano.h}"` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${dims}>
    <defs>
      <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${aclarar(canto, 0.28)}"/>
        <stop offset="0.45" stop-color="${canto}"/>
        <stop offset="1" stop-color="${aclarar(canto, 0.1)}"/>
      </linearGradient>
      <mask id="hueco">
        <rect width="${W}" height="${H}" fill="#fff"/>
        <rect x="${sx}" y="${sy}" width="${M.pantalla.w}" height="${M.pantalla.h}" rx="${M.pantalla.r}" fill="#000"/>
      </mask>
    </defs>
    ${M.botones.izq.map((b) => boton('izq', b)).join('')}
    ${M.botones.der.map((b) => boton('der', b)).join('')}
    <g mask="url(#hueco)">
      <rect x="${PAD}" y="${PAD}" width="${M.cuerpo.w}" height="${M.cuerpo.h}" rx="${M.cuerpo.r}" fill="url(#metal)"/>
      <rect x="${PAD + M.canto}" y="${PAD + M.canto}" width="${M.cuerpo.w - 2 * M.canto}"
            height="${M.cuerpo.h - 2 * M.canto}" rx="${M.cuerpo.r - M.canto}" fill="#0a0a0a"/>
    </g>
    <path d="${muesca}" fill="#0a0a0a"/>
    <rect x="${cx - M.altavoz.w / 2}" y="${PAD + M.canto + 2}" width="${M.altavoz.w}"
          height="${M.altavoz.h}" rx="${M.altavoz.h / 2}" fill="#1c1c1e"/>
  </svg>`;
}
