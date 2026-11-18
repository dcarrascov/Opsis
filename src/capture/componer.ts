import { svgMarco } from '../frame/frame';
import { CAJA, IPHONE13 as M } from '../frame/iphone13';

/** Imagen del marco lista para pintar en un canvas (se cachea por color). */
const cache = new Map<string, HTMLImageElement>();
export async function imagenMarco(canto: string): Promise<HTMLImageElement> {
  let img = cache.get(canto);
  if (!img) {
    img = new Image();
    const svg = svgMarco(canto, CAJA);
    img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    await img.decode();
    cache.set(canto, img);
  }
  return img;
}

export interface Escena {
  pantalla: HTMLCanvasElement; // el vídeo
  marco: HTMLImageElement;
  horizontal: boolean;
  giro: number; // grados: 0, -90 o 90
}

/** Tamaño de la escena en u (vertical 440 × 894, horizontal 894 × 440). */
export const tamanoEscena = (horizontal: boolean) =>
  horizontal ? { w: CAJA.h, h: CAJA.w } : { w: CAJA.w, h: CAJA.h };

/**
 * Pinta vídeo + marco en un contexto ya escalado (1 unidad = 1 u), con fondo transparente.
 * Lo usan la captura PNG y la grabación.
 */
export function componer(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, e: Escena) {
  const { w: W, h: H } = tamanoEscena(e.horizontal);
  const [sw, sh] = e.horizontal ? [M.pantalla.h, M.pantalla.w] : [M.pantalla.w, M.pantalla.h];
  const x = (W - sw) / 2;
  const y = (H - sh) / 2;

  ctx.clearRect(0, 0, W, H);

  // 1) el vídeo, recortado con la forma de la pantalla
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, sw, sh, M.pantalla.r);
  ctx.clip();
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, sw, sh);
  if (e.pantalla.width > 0 && e.pantalla.height > 0) ctx.drawImage(e.pantalla, x, y, sw, sh);
  ctx.restore();

  // 2) el marco encima, girado si toca
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((e.giro * Math.PI) / 180);
  ctx.drawImage(e.marco, -CAJA.w / 2, -CAJA.h / 2, CAJA.w, CAJA.h);
  ctx.restore();
}
