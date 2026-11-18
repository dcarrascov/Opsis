/**
 * Medidas del iPhone 13 en «u» (1 u = 1 pt de iOS = 1 px CSS a escala 1; 1 u ≈ 0,1657 mm).
 * Única fuente de verdad del marco. Lo marcado «aprox.» se ajusta con una foto frontal real.
 */
export const IPHONE13 = {
  cuerpo: { w: 432, h: 886, r: 68 }, // 71,5 × 146,7 mm
  pantalla: { w: 390, h: 844, r: 47.33 }, // 1170 × 2532 px @3x
  canto: 5, // aluminio visible desde delante (aprox.)
  muesca: { w: 162, h: 32, r: 20, oreja: 6 }, // ≈ 26,8 × 5,35 mm (aprox.)
  altavoz: { w: 56, h: 4 }, // aprox.
  botones: {
    fondo: 3, // lo que sobresalen (aprox.)
    izq: [
      { y: 140, h: 34 }, // silencio
      { y: 205, h: 62 }, // volumen +
      { y: 285, h: 62 }, // volumen −
    ],
    der: [{ y: 232, h: 100 }], // lateral
  },
} as const;

/** Caja total del SVG: cuerpo + hueco para los botones (4 u por lado). */
export const PAD = IPHONE13.botones.fondo + 1;
export const CAJA = { w: IPHONE13.cuerpo.w + PAD * 2, h: IPHONE13.cuerpo.h + PAD * 2 }; // 440 × 894

/** Colores del canto (valores de partida aproximados, a ajustar con fotos). */
export const COLORES = {
  medianoche: { nombre: 'Medianoche', canto: '#2B3138' },
  estrella: { nombre: 'Blanco estrella', canto: '#E8E3DA' },
  azul: { nombre: 'Azul', canto: '#2F5F7C' },
  rosa: { nombre: 'Rosa', canto: '#F0D3CF' },
  verde: { nombre: 'Verde', canto: '#3A4D3F' },
  rojo: { nombre: '(PRODUCT)RED', canto: '#B5121B' },
} as const;

export type Color = keyof typeof COLORES;

/** Tamaños de ventana: escala k sobre las medidas en u. */
export const TAMANOS = { S: 0.6, M: 0.8, L: 1.0 } as const;
export type Tamano = keyof typeof TAMANOS;

/** Margen alrededor del dispositivo (px lógicos) para la sombra CSS. */
export const MARGEN = 32;
