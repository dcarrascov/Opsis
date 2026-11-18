import { buscarSps, codecDesdeSps } from './h264';

export type Orientacion = 'vertical' | 'horizontal';

/**
 * Decodificador H.264 con WebCodecs que pinta en un canvas.
 * - Se (re)configura con el primer IDR y cada vez que cambia el SPS (al girar el iPhone).
 * - Solo pinta el fotograma más reciente en cada requestAnimationFrame: no acumula latencia.
 */
export function crearDecodificador(canvas: HTMLCanvasElement, onOrientacion: (o: Orientacion) => void) {
  const ctx = canvas.getContext('2d')!;
  let decoder: VideoDecoder | null = null;
  let huellaSps = '';
  let ultimo: VideoFrame | null = null;

  const nuevo = () =>
    new VideoDecoder({
      output: (f) => {
        ultimo?.close();
        ultimo = f; // solo el más reciente
      },
      error: (e) => {
        console.error('[decoder]', e);
        decoder = null; // se recrea en el próximo IDR
        huellaSps = '';
      },
    });

  const pintar = () => {
    if (ultimo) {
      const f = ultimo;
      ultimo = null;
      if (canvas.width !== f.displayWidth || canvas.height !== f.displayHeight) {
        canvas.width = f.displayWidth;
        canvas.height = f.displayHeight;
        onOrientacion(f.displayWidth > f.displayHeight ? 'horizontal' : 'vertical');
      }
      ctx.drawImage(f, 0, 0);
      f.close();
    }
    requestAnimationFrame(pintar);
  };
  requestAnimationFrame(pintar);

  return {
    push(au: Uint8Array, key: boolean, ts: number) {
      if (key) {
        const sps = buscarSps(au);
        const huella = sps ? sps.join(',') : '';
        if (sps && (!decoder || huella !== huellaSps)) {
          // primer IDR o SPS nuevo (rotación)
          if (!decoder || decoder.state === 'closed') decoder = nuevo();
          decoder.configure({
            codec: codecDesdeSps(sps),
            optimizeForLatency: true,
            hardwareAcceleration: 'prefer-hardware',
          });
          huellaSps = huella;
        }
      }
      if (!decoder || !huellaSps) return; // esperando el primer IDR
      // Si el decodificador se atasca, descartar fotogramas delta hasta el siguiente IDR
      if (!key && decoder.decodeQueueSize > 8) return;
      try {
        decoder.decode(
          new EncodedVideoChunk({
            type: key ? 'key' : 'delta',
            timestamp: Math.round((ts * 1e6) / 90000), // 90 kHz → µs
            data: au,
          }),
        );
      } catch (e) {
        console.error('[decoder]', e);
        decoder = null;
        huellaSps = '';
      }
    },

    /** Vacía la pantalla (al volver a la espera). */
    limpiar() {
      ultimo?.close();
      ultimo = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
