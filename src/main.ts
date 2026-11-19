import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { getCurrentWindow, LogicalSize, PhysicalPosition } from '@tauri-apps/api/window';

import { imagenMarco, type Escena } from './capture/componer';
import { grabar } from './capture/recorder';
import { capturaPng, copiarAlPortapapeles } from './capture/screenshot';
import { svgMarco } from './frame/frame';
import { CAJA, COLORES, MARGEN, TAMANOS, type Color, type Tamano } from './frame/iphone13';
import { pintarDemo } from './ui/demo';
import { cargarPrefs, guardarPrefs } from './ui/prefs';
import { crearDecodificador, type Orientacion } from './video/decoder';

const enTauri = isTauri();
const ventana = enTauri ? getCurrentWindow() : null;

const disp = document.querySelector<HTMLElement>('.dispositivo')!;
const pantalla = document.querySelector<HTMLCanvasElement>('#pantalla')!;
const marco = document.querySelector<HTMLElement>('.marco')!;

const prefs = cargarPrefs();
let horizontal = false;

// ---------- Aspecto: color, tamaño, orientación ----------

function aplicarColor(c: Color) {
  prefs.color = c;
  marco.innerHTML = svgMarco(COLORES[c].canto);
  guardarPrefs(prefs);
}

async function ajustarVentana() {
  const k = TAMANOS[prefs.tamano];
  document.documentElement.style.setProperty('--k', String(k));
  if (!ventana) return;
  const w = Math.ceil(CAJA.w * k + MARGEN * 2);
  const h = Math.ceil(CAJA.h * k + MARGEN * 2);
  const [nw, nh] = horizontal ? [h, w] : [w, h];

  // Cambiar de tamaño manteniendo el centro de la ventana
  const escala = await ventana.scaleFactor();
  const pos = await ventana.outerPosition();
  const antes = await ventana.outerSize();
  const cx = pos.x + antes.width / 2;
  const cy = pos.y + antes.height / 2;
  await ventana.setSize(new LogicalSize(nw, nh));
  await ventana.setPosition(
    new PhysicalPosition(Math.round(cx - (nw * escala) / 2), Math.round(cy - (nh * escala) / 2)),
  );
}

function aplicarTamano(t: Tamano) {
  prefs.tamano = t;
  guardarPrefs(prefs);
  void ajustarVentana();
}

function aplicarOrientacion(o: Orientacion) {
  const nueva = o === 'horizontal';
  if (nueva === horizontal) return;
  horizontal = nueva;
  document.body.classList.toggle('horizontal', horizontal);
  void ajustarVentana();
}

function aplicarLadoMuesca(derecha: boolean) {
  prefs.muescaDerecha = derecha;
  document.body.classList.toggle('muesca-derecha', derecha);
  guardarPrefs(prefs);
}

async function aplicarSiempreEncima(si: boolean) {
  prefs.siempreEncima = si;
  guardarPrefs(prefs);
  await ventana?.setAlwaysOnTop(si);
}

aplicarColor(prefs.color);
aplicarLadoMuesca(prefs.muescaDerecha);
void ajustarVentana();
void aplicarSiempreEncima(prefs.siempreEncima);

// ---------- Vídeo ----------

const dec = crearDecodificador(pantalla, aplicarOrientacion);

function ponerEstado(estado: string) {
  document.body.dataset.estado = estado;
  if (estado === 'esperando') {
    dec.limpiar();
    aplicarOrientacion('vertical');
  }
  if (estado.startsWith('error')) {
    const codigo = estado.split(':')[1];
    document.querySelector('#mensaje-error')!.textContent =
      `El receptor AirPlay se ha cerrado${codigo && codigo !== 'None' ? ` (código ${codigo})` : ''}.`;
  }
}

/** Nombre del receptor y PIN (si está activado) en la pantalla de espera. */
function mostrarReceptor(nombre: string, pin: string | null) {
  document.querySelector('#nombre-receptor')!.textContent = nombre;
  document.querySelector('#pin')!.textContent = pin ?? '';
  document.querySelector<HTMLElement>('.paso-pin')!.hidden = !pin;
}

async function iniciarOpsis() {
  ponerEstado('arrancando');
  const canal = new Channel<ArrayBuffer>();
  canal.onmessage = (buf) => {
    const v = new DataView(buf);
    if (v.getUint8(0) !== 1) return; // 1 = vídeo
    dec.push(new Uint8Array(buf, 8), (v.getUint8(1) & 1) === 1, v.getUint32(4, true));
  };
  try {
    const r = await invoke<{ nombre: string; pin: string | null }>('iniciar_opsis', { onVideo: canal });
    mostrarReceptor(r.nombre, r.pin);
  } catch (e) {
    console.error(e);
    ponerEstado(`error:${e}`);
  }
}

if (enTauri) {
  await listen<string>('estado', (e) => ponerEstado(e.payload));
  void iniciarOpsis();
} else {
  // Navegador (desarrollo y GIF del README): `?demo` o `?demo=horizontal` pinta una pantalla
  // de prueba; `color=azul` y `tamano=L` cambian el marco y `fondo` pone un fondo de escritorio.
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo');
  const color = params.get('color');
  if (color && Object.hasOwn(COLORES, color)) marco.innerHTML = svgMarco(COLORES[color as Color].canto);
  const tamano = params.get('tamano');
  if (tamano && Object.hasOwn(TAMANOS, tamano)) document.documentElement.style.setProperty('--k', String(TAMANOS[tamano as Tamano]));
  if (params.has('fondo')) document.documentElement.classList.add('fondo-demo');
  if (params.has('pin')) mostrarReceptor('Opsis', params.get('pin') || '4827');
  if (demo !== null) {
    const h = demo === 'horizontal';
    pintarDemo(pantalla, h);
    aplicarOrientacion(h ? 'horizontal' : 'vertical');
    ponerEstado('conectado');
  } else {
    ponerEstado('esperando');
  }
}

document.querySelector('#reintentar')!.addEventListener('click', () => void iniciarOpsis());

// ---------- Capturas y grabación ----------

async function escenaActual(): Promise<Escena> {
  return {
    pantalla,
    marco: await imagenMarco(COLORES[prefs.color].canto),
    horizontal,
    giro: horizontal ? (prefs.muescaDerecha ? 90 : -90) : 0,
  };
}

async function guardar(blob: Blob, ext: string): Promise<void> {
  const datos = new Uint8Array(await blob.arrayBuffer());
  if (enTauri) {
    const ruta = await invoke<string>('guardar_archivo', datos, { headers: { 'x-ext': ext } });
    console.info('Guardado en', ruta);
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `opsis-${Date.now()}.${ext}`;
    a.click();
  }
}

async function capturar(portapapeles: boolean) {
  const png = await capturaPng(await escenaActual());
  if (portapapeles) await copiarAlPortapapeles(png);
  else await guardar(png, 'png');
}

let grabacion: ReturnType<typeof grabar> | null = null;
async function alternarGrabacion() {
  if (grabacion) {
    const g = grabacion;
    grabacion = null;
    document.body.classList.remove('grabando');
    await guardar(await g.parar(), g.ext);
  } else {
    const marcoImg = await imagenMarco(COLORES[prefs.color].canto);
    grabacion = grabar(() => ({
      pantalla,
      marco: marcoImg,
      horizontal,
      giro: horizontal ? (prefs.muescaDerecha ? 90 : -90) : 0,
    }));
    document.body.classList.add('grabando');
  }
}

// ---------- Interacción ----------

disp.addEventListener('mousedown', (e) => {
  if (e.button === 0 && !(e.target as HTMLElement).closest('button')) void ventana?.startDragging();
});

const atajos: Record<string, () => unknown> = {
  'ctrl+s': () => capturar(false),
  'ctrl+shift+s': () => capturar(true),
  'ctrl+r': () => alternarGrabacion(),
  'ctrl+t': () => aplicarSiempreEncima(!prefs.siempreEncima),
  'ctrl+1': () => aplicarTamano('S'),
  'ctrl+2': () => aplicarTamano('M'),
  'ctrl+3': () => aplicarTamano('L'),
  'ctrl+g': () => aplicarLadoMuesca(!prefs.muescaDerecha),
  escape: () => ventana?.hide(),
};

window.addEventListener('keydown', (e) => {
  const tecla = [e.ctrlKey && 'ctrl', e.shiftKey && 'shift', e.key.toLowerCase()].filter(Boolean).join('+');
  const accion = atajos[tecla];
  if (accion) {
    e.preventDefault();
    Promise.resolve(accion()).catch(console.error);
  }
});

window.addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  if (!enTauri) return;
  const sep = () => PredefinedMenuItem.new({ item: 'Separator' });
  const menu = await Menu.new({
    items: [
      await CheckMenuItem.new({
        text: 'Siempre encima',
        checked: prefs.siempreEncima,
        accelerator: 'Ctrl+T',
        action: () => void aplicarSiempreEncima(!prefs.siempreEncima),
      }),
      await Submenu.new({
        text: 'Tamaño',
        items: await Promise.all(
          (Object.keys(TAMANOS) as Tamano[]).map((t, i) =>
            CheckMenuItem.new({
              text: t,
              checked: prefs.tamano === t,
              accelerator: `Ctrl+${i + 1}`,
              action: () => aplicarTamano(t),
            }),
          ),
        ),
      }),
      await Submenu.new({
        text: 'Color',
        items: await Promise.all(
          (Object.keys(COLORES) as Color[]).map((c) =>
            CheckMenuItem.new({
              text: COLORES[c].nombre,
              checked: prefs.color === c,
              action: () => aplicarColor(c),
            }),
          ),
        ),
      }),
      await MenuItem.new({
        text: 'Cambiar lado de la muesca',
        accelerator: 'Ctrl+G',
        action: () => aplicarLadoMuesca(!prefs.muescaDerecha),
      }),
      await sep(),
      await MenuItem.new({ text: 'Capturar', accelerator: 'Ctrl+S', action: () => void capturar(false) }),
      await MenuItem.new({
        text: 'Copiar captura',
        accelerator: 'Ctrl+Shift+S',
        action: () => void capturar(true),
      }),
      await MenuItem.new({
        text: grabacion ? 'Parar grabación' : 'Grabar',
        accelerator: 'Ctrl+R',
        action: () => void alternarGrabacion(),
      }),
      await sep(),
      await MenuItem.new({ text: 'Ocultar', accelerator: 'Esc', action: () => void ventana?.hide() }),
      await MenuItem.new({ text: 'Salir', action: () => void invoke('salir') }),
    ],
  });
  await menu.popup();
});
