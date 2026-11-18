import { componer, tamanoEscena, type Escena } from './componer';

/** Formato de grabación: MP4/H.264 si WebView2 lo admite; si no, WebM/VP9. */
function formato(): { mime: string; ext: string } {
  const opciones = [
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  return opciones.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? opciones[2];
}

/**
 * Graba la escena (vídeo + marco) a 2×. En cada fotograma pide la escena actual,
 * así sigue los giros y cambios de color durante la grabación.
 * v1: sin audio (lo reproduce UxPlay fuera de la web).
 */
export function grabar(escena: () => Escena, escala = 2) {
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d')!;
  const { mime, ext } = formato();
  const trozos: Blob[] = [];

  // El tamaño del vídeo se fija con la orientación del principio. Si se gira el iPhone
  // durante la grabación, la escena se encaja dentro sin cortarse.
  const inicial = tamanoEscena(escena().horizontal);
  lienzo.width = Math.round(inicial.w * escala);
  lienzo.height = Math.round(inicial.h * escala);

  let activo = true;
  const bucle = () => {
    if (!activo) return;
    const e = escena();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    const { w, h } = tamanoEscena(e.horizontal);
    const k = Math.min(lienzo.width / w, lienzo.height / h);
    ctx.setTransform(k, 0, 0, k, (lienzo.width - w * k) / 2, (lienzo.height - h * k) / 2);
    componer(ctx, e);
    requestAnimationFrame(bucle);
  };
  bucle();

  const rec = new MediaRecorder(lienzo.captureStream(60), {
    mimeType: mime,
    videoBitsPerSecond: 12_000_000,
  });
  rec.ondataavailable = (ev) => {
    if (ev.data.size > 0) trozos.push(ev.data);
  };
  rec.start(2000);

  return {
    ext,
    /** Para la grabación y devuelve el vídeo completo. */
    parar(): Promise<Blob> {
      return new Promise((resolve) => {
        rec.onstop = () => {
          activo = false;
          resolve(new Blob(trozos, { type: mime }));
        };
        rec.stop();
      });
    },
  };
}
