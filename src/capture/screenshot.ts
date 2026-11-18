import { componer, tamanoEscena, type Escena } from './componer';

/** PNG con marco a 3× (≈ resolución real del iPhone) y fondo transparente. */
export async function capturaPng(e: Escena, escala = 3): Promise<Blob> {
  const { w, h } = tamanoEscena(e.horizontal);
  const c = new OffscreenCanvas(Math.round(w * escala), Math.round(h * escala));
  const ctx = c.getContext('2d')!;
  ctx.scale(escala, escala);
  componer(ctx, e);
  return c.convertToBlob({ type: 'image/png' });
}

/** Copia el PNG al portapapeles (API web; WebView2 la admite con la ventana enfocada). */
export async function copiarAlPortapapeles(png: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
