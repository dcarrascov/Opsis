# Opsis — La pantalla del iPhone en Windows, dentro de un marco de iPhone 13

| | |
|---|---|
| **Nombre** | Opsis *(del griego ὄψις: «vista, aspecto, lo que se ve»; sin «iPhone» en el nombre por temas de marca)* |
| **Plataforma** | Windows 10 / 11 (x64) |
| **Stack** | Tauri 2 (Rust + TypeScript) · UxPlay (receptor AirPlay) · WebCodecs |
| **Autor** | [dimacavidv-lgtm](https://github.com/dimacavidv-lgtm) |
| **Estado** | Diseño inicial · noviembre 2026 |

---

## Índice

1. [Qué es](#1-qué-es)
2. [Cómo funciona (visión general)](#2-cómo-funciona-visión-general)
3. [Tecnologías](#3-tecnologías)
4. [Diseño: el marco de iPhone 13](#4-diseño-el-marco-de-iphone-13)
5. [Cómo se va a hacer (detalle técnico)](#5-cómo-se-va-a-hacer-detalle-técnico)
6. [Estructura del repositorio](#6-estructura-del-repositorio)
7. [Plan por fases](#7-plan-por-fases)
8. [Riesgos y problemas típicos](#8-riesgos-y-problemas-típicos)
9. [Licencias y marca](#9-licencias-y-marca)
10. [Ideas para después](#10-ideas-para-después)
11. [Referencias](#11-referencias)

---

## 1. Qué es

Una app de escritorio para Windows que hace de **receptor AirPlay**. Desde el iPhone abres el **Centro de Control → Duplicar pantalla**, eliges el PC, y en el escritorio aparece una **ventana sin bordes con la forma de un iPhone 13** (canto de aluminio, cristal negro, muesca y botones) con la pantalla del móvil dentro, en tiempo real.

### Flujo de uso

1. Abres Opsis en el PC: aparece el iPhone 13 «apagado» con las instrucciones en su pantalla.
2. En el iPhone: Centro de Control → **Duplicar pantalla** → eliges **«Opsis»** (el nombre se configura).
3. La pantalla del iPhone aparece dentro del marco. Si giras el móvil, el marco gira con él.
4. Arrastras la ventana a donde quieras. Puedes dejarla **siempre encima**, cambiar el tamaño o el color, hacer **capturas** o **grabar**, y las dos cosas salen *con el marco*.
5. Cuando dejas de duplicar en el iPhone, la ventana vuelve a la pantalla de espera.

### Para qué sirve

Demos de apps de iOS, tutoriales, clases, presentaciones o capturas para un portfolio. Ya existen receptores AirPlay para Windows. Lo que aporta este proyecto es **el marco** y que **las capturas y grabaciones salen con el marco**, listas para usar.

### Alcance

| ✅ Sí (v1) | ❌ No (v1) |
|---|---|
| Duplicar pantalla en vertical y horizontal | Controlar el iPhone desde el PC (**AirPlay es solo de ida**: no se puede) |
| Audio por los altavoces del PC (lo reproduce UxPlay) | macOS / Linux |
| Marco de iPhone 13 con sus 6 colores y 3 tamaños | Varios iPhones a la vez (UxPlay atiende un cliente) |
| Siempre encima, arrastrar, bandeja del sistema | Otros modelos de marco (queda para después) |
| Capturas PNG con marco (archivo y portapapeles) | Grabación **con audio** (v2, ver §10) |
| Grabación de vídeo con marco | |
| Ajustes: nombre del receptor, PIN, color, tamaño, inicio con Windows | |
| Instalador que configura el firewall | |

---

## 2. Cómo funciona (visión general)

```
┌──────────────┐  AirPlay (mDNS, emparejamiento, FairPlay, H.264 cifrado)
│   iPhone     │──────────────────────────────────────────────┐
│ «Duplicar    │                                              │
│  pantalla»   │                                              ▼
└──────────────┘                              ┌───────────────────────────────┐
                                              │ uxplay.exe  (sin modificar)   │
                                              │ · se anuncia en la red        │
                                              │ · empareja y descifra         │
                                              │ · reproduce el AUDIO          │
                                              │ · reenvía el VÍDEO con -vrtp  │
                                              └──────────────┬────────────────┘
                                                             │ RTP/H.264 por UDP
                                                             │ 127.0.0.1:<puerto>
                                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ App Tauri                                                                  │
│                                                                            │
│  Backend Rust                              Frontend (WebView2)             │
│  · lanza/para uxplay (sidecar)             · WebCodecs VideoDecoder (GPU)  │
│  · recibe RTP por UDP          Channel     · <canvas> con forma de pantalla│
│  · reconstruye fotogramas H.264 ─────────► · marco SVG del iPhone 13       │
│  · lee los logs → estados     (bytes)      · capturas, grabación, ajustes  │
└────────────────────────────────────────────────────────────────────────────┘
```

### La decisión clave: UxPlay **sin modificar** + `-vrtp`

Desde la versión 1.73, UxPlay tiene la opción **`-vrtp`**: en vez de pintar el vídeo, lo **reenvía ya descifrado como paquetes RTP H.264** a otro programa (está pensada para OBS Studio). Eso nos ahorra hacer un fork en C:

- **No tocamos el protocolo AirPlay** (emparejamiento, FairPlay, cifrado): eso es lo difícil y lo resuelve UxPlay.
- **Actualizar UxPlay es trivial**: recompilar otra versión y listo. No hay que mantener un fork.
- **Licencias más limpias**: UxPlay (GPL-3) va como programa aparte. Ver §9.
- Desde la **1.74**, UxPlay trae **su propio mDNS** y en Windows **ya no hace falta instalar Bonjour**. Esto facilita mucho la distribución.

La parte nuestra es: Rust recibe el RTP, reconstruye cada fotograma H.264 y se lo pasa a la web, que lo decodifica por hardware con WebCodecs y lo pinta dentro del marco.

---

## 3. Tecnologías

| Capa | Tecnología | Para qué |
|---|---|---|
| Receptor AirPlay | **UxPlay ≥ 1.74** (C + GStreamer), compilado con **MSYS2 UCRT64** | mDNS, emparejamiento, descifrado. Reproduce el audio y reenvía el vídeo por RTP |
| App de escritorio | **Tauri 2** | Ventana transparente, *sidecar*, bandeja, instalador |
| Backend | **Rust** + **tokio** (+ `socket2`) | Lanzar UxPlay, recibir UDP, depacketizar RTP → H.264 |
| Comunicación Rust → web | **`tauri::ipc::Channel`** con bytes crudos | Stream de fotogramas al frontend (llegan como `ArrayBuffer`) |
| Frontend | **Vite + TypeScript**, sin framework | La UI es pequeña: no hace falta Angular ni Astro |
| Vídeo | **WebCodecs `VideoDecoder`** + `<canvas>` | Decodificación H.264 por hardware en WebView2 |
| Marco | **SVG generado por código** + CSS | iPhone 13 parametrizado (colores, rotación, escala) |
| Capturas / grabación | `OffscreenCanvas`, `canvas.captureStream()` + `MediaRecorder` | PNG y vídeo con marco |
| Plugins de Tauri | `shell`, `store`, `single-instance`, `autostart`, `window-state`, `clipboard-manager` | Sidecar, ajustes, una sola instancia, inicio con Windows, recordar posición, portapapeles |
| Instalador | **NSIS** (bundler de Tauri) + *hook* | Instalar y crear la regla del firewall |

### Requisitos para desarrollar

- Windows 10/11 x64.
- **MSYS2** (terminal **UCRT64**) para compilar UxPlay.
- **Rust** (rustup, toolchain MSVC) + **Microsoft C++ Build Tools**: requisitos de Tauri.
- **Node.js LTS**.
- **WebView2**: viene con Windows 11 y casi siempre está en Windows 10.
- Un iPhone en **la misma Wi-Fi**, con la red del PC en perfil **Privado**.

---

## 4. Diseño: el marco de iPhone 13

> **Ojo:** el iPhone 13 tiene **muesca** (*notch*), no isla dinámica. La isla llegó con el 14 Pro.

### 4.1 Medidas de referencia

| Dato | Valor | Fuente |
|---|---|---|
| Cuerpo | **71,5 × 146,7 mm** (7,65 mm de grosor) | Apple |
| Pantalla | 6,1″, **2532 × 1170 px a 460 ppp** | Apple |
| Pantalla en puntos de iOS | **390 × 844 pt** (@3x) | Apple / iOS |
| Radio de las esquinas de la pantalla | **47,33 pt** | Medido (ScreenCorners) |
| Muesca | ≈ **26,8 × 5,35 mm** (un 20 % más estrecha que la del 12) | Medidas de prensa, **aprox.** |

**Unidad de trabajo «u»**: 1 u = 1 pt de iOS = 1 px CSS a escala 1.
La pantalla mide 64,6 mm de ancho para 390 pt, así que **1 u ≈ 0,1657 mm**. Con eso se pasa todo a unidades:

- Cuerpo: 71,5 / 0,1657 ≈ **432 u** de ancho · 146,7 / 0,1657 ≈ **886 u** de alto.
- Margen alrededor de la pantalla: (432 − 390) / 2 ≈ **21 u** por los cuatro lados.
- Radio exterior del cuerpo, concéntrico con la pantalla: 47,33 + 21 ≈ **68 u**.
- Muesca: 26,8 mm ≈ **162 u** de ancho · 5,35 mm ≈ **32 u** de alto.

### 4.2 Vista frontal

```
              ←──────────────── 432 u (71,5 mm) ────────────────→
             ╭──────────────────────────────────────────────────╮  ↑
             │   ╭──────────────╮ ▂▂▂▂▂▂ ╭──────────────╮       │  │  21 u = canto 5 u
             │   │              ╰────────╯              │       │  │       + cristal 16 u
   silencio ▌│   │          muesca 162 × 32 u           │       │  │
             │   │                                      │       │▐ lateral
     vol + ▌ │   │                                      │       │▐
             │   │              PANTALLA                │       │  886 u
     vol − ▌ │   │            390 × 844 u               │       │  (146,7 mm)
             │   │          radio 47,33 u               │       │  │
             │   │                                      │       │  │
             │   │                                      │       │  │
             │   ╰──────────────────────────────────────╯       │  │
             ╰──────────────────────────────────────────────────╯  ↓
                         radio exterior ≈ 68 u
```

*(El dibujo no está a escala. Los valores buenos son los de la tabla 4.4.)*

### 4.3 Capas (de atrás hacia delante)

```
.dispositivo                       ← contenedor; arrastrable; lleva la sombra
 ├─ <canvas id="pantalla">         ← el VÍDEO, con border-radius 47,33 u
 ├─ .espera                        ← pantalla de espera (encima del canvas cuando no hay vídeo)
 └─ .marco  <svg>                  ← canto de aluminio + cristal negro con un HUECO
                                     (mask) donde va la pantalla, muesca, altavoz y botones
```

El marco es un SVG **con un agujero** en la pantalla: el canvas de debajo se ve a través. La muesca va **encima** del vídeo, igual que en el móvil real: el stream de AirPlay incluye la barra de estado, así que la hora y la batería quedan a los lados de la muesca.

### 4.4 Medidas del marco en unidades

Esta tabla es la **única fuente de verdad** (en el código será `iphone13.ts`). Lo marcado como *aprox.* se ajusta a ojo comparando con una foto frontal o con las *Accessory Design Guidelines* de Apple, que publican planos acotados.

| Elemento | Valor (u) | Notas |
|---|---|---|
| Cuerpo | 432 × 886, radio 68 | De la medida oficial |
| Pantalla | 390 × 844, radio 47,33 | Exacta |
| Canto de aluminio visible desde delante | 5 | *aprox.* (≈ 0,8 mm). Lleva el color del modelo |
| Cristal negro (bisel) | 16 | *aprox.* (≈ 2,65 mm). Negro `#0a0a0a` en todos los colores |
| Muesca | 162 × 32 | Esquinas inferiores con radio ≈ 20, «orejas» superiores con radio ≈ 6 (*aprox.*) |
| Altavoz (ranura en el borde superior) | 56 × 4 | *aprox.* En el 13 se movió al bisel, encima de la muesca |
| Botón de silencio (izq.) | y = 140, alto 34 | *aprox.* (y medida desde arriba del cuerpo) |
| Volumen + (izq.) | y = 205, alto 62 | *aprox.* |
| Volumen − (izq.) | y = 285, alto 62 | *aprox.* |
| Botón lateral (der.) | y = 232, alto 100 | *aprox.* |
| Lo que sobresalen los botones | 3 | *aprox.* |
| Caja total del SVG (con hueco para los botones) | 440 × 894 | 4 u de margen por lado |

**Detalle de fidelidad:** iOS usa esquinas *continuas* (tipo *squircle*), no circulares. Con `border-radius` casi no se nota. Si se quiere más fidelidad, se recorta el canvas con un `path` SVG.

### 4.5 Colores

El cristal frontal es negro en todos. Solo cambian el **canto** y los **botones**. Los hex son **valores de partida aproximados**, a ajustar con fotos:

| Acabado | Canto (aprox.) |
|---|---|
| Medianoche | `#2B3138` |
| Blanco estrella | `#E8E3DA` |
| Azul | `#2F5F7C` |
| Rosa | `#F0D3CF` |
| Verde | `#3A4D3F` |
| (PRODUCT)RED | `#B5121B` |

Un `linearGradient` suave en el canto (más claro arriba a la izquierda) le da aspecto metálico sin complicarse.

### 4.6 Orientación

- El stream de AirPlay cambia de forma cuando giras el iPhone: llega un **SPS nuevo** con otra resolución. Al detectar `ancho > alto` → modo **horizontal**.
- En horizontal **solo se gira el SVG del marco** (±90°) y el canvas pasa a medir 844 × 390 u. El vídeo ya llega derecho, así que no hay que rotarlo.
- AirPlay **no dice hacia qué lado** has girado el móvil. Por defecto, muesca a la izquierda (`rotate(-90deg)`); con **Ctrl + G** o desde el menú se pasa a la derecha. Se recuerda la última elección.
- Al girar, la ventana cambia de tamaño (ancho ↔ alto) manteniendo su centro.

### 4.7 Ventana y tamaños

- **Transparente, sin bordes, sin sombra nativa** (la sombra la pone CSS con `drop-shadow`, por eso hay 16 px de margen alrededor).
- No redimensionable con el ratón: los tamaños son **presets** para mantener la proporción.

| Tamaño | Escala `k` | Ventana en vertical (px lógicos) | Pantalla visible |
|---|---|---|---|
| S | 0,6 | 296 × 569 | 234 × 506 |
| **M (por defecto)** | 0,8 | 384 × 748 | 312 × 675 |
| L | 1,0 | 472 × 926 | 390 × 844 |

Fórmula: `ancho = 440·k + 32`, `alto = 894·k + 32`; en horizontal se intercambian.
*La L no cabe en un portátil 1080p con escalado al 125 %: por eso la M es la de por defecto.*

**Nitidez:** con la resolución por defecto de UxPlay (`-s 1920x1080`, donde manda la altura), el vertical llega con **1080 px de alto** (≈ 499 × 1080). Sobra para M y L. Si se quiere más, se prueba a pedir más altura con `-s` (es solo una petición al iPhone).

### 4.8 Pantalla de espera y estados

```
╭───────────────────────────────╮
│  ╭─────────╮ ▂▂▂ ╭─────────╮  │
│  │         ╰─────╯         │  │
│  │                         │  │
│  │           ⧉             │  │   icono propio (dos rectángulos)
│  │   Esperando conexión    │  │
│  │                         │  │
│  │  1  Abre el Centro de   │  │
│  │     Control             │  │
│  │  2  Toca «Duplicar      │  │
│  │     pantalla»           │  │
│  │  3  Elige «Opsis»       │  │
│  │                         │  │
│  │  ● Listo · misma Wi-Fi  │  │
│  ╰─────────────────────────╯  │
╰───────────────────────────────╯
```

| Estado | Qué se ve |
|---|---|
| `arrancando` | Pantalla negra con un spinner discreto |
| `esperando` | La pantalla de espera de arriba (fondo degradado oscuro `#0b0b0f → #1c1c24`) |
| `conectado` | El vídeo |
| `error` | Mensaje claro + botón **Reintentar** (UxPlay no arrancó, puerto ocupado…) |

Al dejar de duplicar, el último fotograma se funde (≈ 300 ms) a la pantalla de espera.
**Importante:** si la pantalla del iPhone no cambia, iOS puede **dejar de mandar fotogramas**. Que no llegue vídeo **no significa** que se haya desconectado: se mantiene el último fotograma.

**Tipografía:** `Segoe UI Variable` del sistema o **Inter** (licencia libre OFL) empaquetada. **No usar SF Pro** (su licencia la limita a plataformas de Apple).

### 4.9 Interacción

- **Arrastrar**: en cualquier parte del dispositivo (no hay nada que tocar: AirPlay no permite control).
- **Clic derecho**: menú contextual (API de menús de Tauri):
  `Siempre encima ✓ · Tamaño ▸ · Color ▸ · Cambiar lado de la muesca · Capturar · Grabar · Ajustes… · Ocultar · Salir`
- **Bandeja del sistema**: mostrar/ocultar, estado, ajustes, salir. Al cerrar la ventana se oculta en la bandeja.

| Atajo | Acción |
|---|---|
| `Ctrl + S` | Captura PNG con marco (a `Imágenes\Opsis`) |
| `Ctrl + Shift + S` | Captura al portapapeles |
| `Ctrl + R` | Empezar / parar grabación |
| `Ctrl + T` | Siempre encima sí/no |
| `Ctrl + 1 / 2 / 3` | Tamaño S / M / L |
| `Ctrl + G` | Cambiar el lado de la muesca (en horizontal) |
| `Esc` | Ocultar en la bandeja |

**Ajustes** (ventana aparte, con bordes normales): nombre del receptor, PIN sí/no, permitir que otro iPhone tome el control, FPS (30/60), color, tamaño, carpeta de capturas, iniciar con Windows. Cambiar el nombre o el PIN **reinicia UxPlay** (son argumentos de arranque).

---

## 5. Cómo se va a hacer (detalle técnico)

> Los fragmentos de código son **esqueletos orientativos** para entender la estructura: habrá que ajustar imports y detalles al implementarlos.

### 5.1 Compilar UxPlay en Windows

En una terminal **MSYS2** (instalado en `C:\msys64`) ejecuta `pacman -Syu`. Después, en una terminal **MSYS2 UCRT64**:

```bash
pacman -S git \
  mingw-w64-ucrt-x86_64-cmake mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-ninja \
  mingw-w64-ucrt-x86_64-openssl mingw-w64-ucrt-x86_64-libplist \
  mingw-w64-ucrt-x86_64-gstreamer mingw-w64-ucrt-x86_64-gst-plugins-base \
  mingw-w64-ucrt-x86_64-gst-plugins-good mingw-w64-ucrt-x86_64-gst-plugins-bad \
  mingw-w64-ucrt-x86_64-gst-libav

git clone https://github.com/FDH2/UxPlay
cd UxPlay
git checkout <tag>          # fija SIEMPRE una versión concreta (≥ 1.74)
mkdir build && cd build
cmake ..                    # ≥ 1.74: mDNS interno, sin Bonjour
ninja
./uxplay -p -n "Prueba" -nh # prueba: el iPhone debería ver «Prueba»
```

- **Plan B, si el iPhone no ve el PC** con el mDNS interno: compilar con `cmake -DUSE_DNS_SD=1 ..`, que usa Bonjour. Necesita el *Bonjour SDK for Windows* (variable `BONJOUR_SDK_HOME` si no está en `C:\Program Files\Bonjour SDK`) y el servicio Bonjour instalado.
- **Firewall** (PowerShell como administrador), y comprobar que la Wi-Fi está en perfil **Privado**:

```powershell
New-NetFirewallRule -DisplayName "Opsis (UxPlay)" -Direction Inbound -Action Allow `
  -Program "C:\ruta\a\uxplay.exe" -Profile Private
```

### 5.2 Cómo lanza la app a UxPlay

```
uxplay.exe -n "Opsis" -nh -p -fps 60
           -vrtp "config-interval=1 ! udpsink host=127.0.0.1 port=<P>"
           [-pin] [-reg <appdata>\uxplay.register] [-nohold]
```

| Opción | Para qué la usamos |
|---|---|
| `-n "<nombre>"` + `-nh` | Nombre que aparece en «Duplicar pantalla», sin el «@equipo» |
| `-p` | Puertos fijos para el firewall: **TCP 7000, 7001, 7100 · UDP 6000, 6001, 7011** (+ UDP 5353 para mDNS). Sin `-p` son aleatorios y el firewall los bloquea |
| `-fps 60` | Hasta 60 fps (por defecto UxPlay pide 30) |
| `-vrtp "<pipeline>"` | El vídeo descifrado va por RTP/UDP a nuestra app y UxPlay no lo pinta. `<P>` es el puerto que abre Rust |
| `-pin` / `-reg <fichero>` | *(Ajuste)* Pedir PIN al conectar (útil en redes compartidas) y recordar los dispositivos ya autorizados |
| `-nohold` | *(Ajuste)* Un iPhone nuevo puede quitarle la conexión al actual (por defecto UxPlay se queda con el primero) |
| `-s AxH` | *(Avanzado)* Resolución que se pide al iPhone; manda la **altura** |
| `-vdmp [n]` | *(Depuración)* Vuelca el H.264 a `videodump.x.h264` |
| `-mp4` | *(Idea, por probar con `-vrtp`)* Grabación nativa sin marco y con audio |
| ⚠️ `-vs 0` | **No usar**: suprime el vídeo y el iPhone baja a ~1 fps |

**Sincronía audio/vídeo (a medir en la fase 1):** el audio lo reproduce UxPlay. En teoría, con el `udpsink` por defecto (`sync=true`), los paquetes de vídeo salen a su hora de presentación, ya sincronizados con ese audio. Como nosotros pintamos según llegan, debería ir a la par. Si se prioriza latencia mínima: `udpsink ... sync=false` (el vídeo irá algo por delante del audio). Se puede ofrecer como «Modo baja latencia».

### 5.3 Backend Rust

**`Cargo.toml`** (dependencias principales):

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-store = "2"
tauri-plugin-single-instance = "2"
tauri-plugin-autostart = "2"
tauri-plugin-window-state = "2"
tauri-plugin-clipboard-manager = "2"
tokio = { version = "1", features = ["net"] }
socket2 = "0.5"
serde = { version = "1", features = ["derive"] }
```

**`lib.rs`**: estado, comando principal y cierre limpio.

```rust
use std::sync::{atomic::AtomicBool, Arc, Mutex};
use tauri::{ipc::{Channel, InvokeResponseBody}, AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::CommandChild;

#[derive(Default)]
struct Estado {
    uxplay: Mutex<Option<CommandChild>>,
    activo: Arc<AtomicBool>, // ¿está llegando vídeo de un iPhone?
}

#[tauri::command]
async fn iniciar_opsis(
    app: AppHandle,
    estado: State<'_, Estado>,
    on_video: Channel<InvokeResponseBody>,
) -> Result<(), String> {
    let sock = stream::socket_local().map_err(|e| e.to_string())?;
    let puerto = sock.local_addr().map_err(|e| e.to_string())?.port();

    let ajustes = ajustes::cargar(&app);
    let hijo = uxplay::lanzar(&app, puerto, &ajustes, estado.activo.clone())?;
    if let Some(viejo) = estado.uxplay.lock().unwrap().replace(hijo) {
        let _ = viejo.kill(); // si ya había uno (p. ej. al cambiar ajustes)
    }

    tauri::async_runtime::spawn(stream::bucle(app.clone(), sock, on_video, estado.activo.clone()));
    let _ = app.emit("estado", "esperando");
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| { /* enfocar la ventana */ }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(Estado::default())
        .invoke_handler(tauri::generate_handler![iniciar_opsis, guardar_archivo])
        .build(tauri::generate_context!())
        .expect("error al construir la app")
        .run(|app, ev| {
            if let tauri::RunEvent::Exit = ev {
                // que no se quede uxplay.exe huérfano
                if let Some(h) = app.state::<Estado>().uxplay.lock().unwrap().take() {
                    let _ = h.kill();
                }
            }
        });
}
```

**`uxplay.rs`**: lanzar el *sidecar* con sus DLLs y vigilar sus logs.

```rust
use std::sync::{atomic::{AtomicBool, Ordering}, Arc};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::{process::{CommandChild, CommandEvent}, ShellExt};

// TODO fase 0: copiar aquí el texto exacto que imprime UxPlay al desconectarse un cliente
const TEXTO_DESCONEXION: &str = "???";

pub fn lanzar(app: &AppHandle, puerto: u16, a: &Ajustes, activo: Arc<AtomicBool>)
    -> Result<CommandChild, String>
{
    let rt = app.path().resource_dir().map_err(|e| e.to_string())?.join("runtime");
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;

    let mut args = vec![
        "-n".to_string(), a.nombre.clone(), "-nh".into(),
        "-p".into(),
        "-fps".into(), a.fps.to_string(),
        "-vrtp".into(), format!("config-interval=1 ! udpsink host=127.0.0.1 port={puerto}"),
    ];
    if a.pin   { args.push("-pin".into()); }
    if a.ceder { args.push("-nohold".into()); }

    let path = format!("{};{}", rt.join("bin").display(), std::env::var("PATH").unwrap_or_default());
    let (mut rx, hijo) = app.shell().sidecar("uxplay").map_err(|e| e.to_string())?
        .args(args)
        .env("PATH", path)                                                       // DLLs empaquetadas
        .env("GST_PLUGIN_SYSTEM_PATH_1_0", rt.join("lib").join("gstreamer-1.0")) // solo NUESTROS plugins
        .env("GST_REGISTRY_1_0", cache.join("gst-registry.bin"))
        .spawn().map_err(|e| e.to_string())?;

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(ev) = rx.recv().await {
            match ev {
                CommandEvent::Stdout(l) | CommandEvent::Stderr(l) => {
                    let linea = String::from_utf8_lossy(&l);
                    eprintln!("[uxplay] {linea}");
                    if linea.contains(TEXTO_DESCONEXION) {
                        activo.store(false, Ordering::SeqCst);
                        let _ = app.emit("estado", "esperando");
                    }
                }
                CommandEvent::Terminated(t) => {
                    let _ = app.emit("estado", format!("error:{:?}", t.code)); // la UI ofrece «Reintentar»
                }
                _ => {}
            }
        }
    });
    Ok(hijo)
}
```

**`stream.rs`**: socket UDP local y bucle RTP → frontend.

```rust
use std::sync::{atomic::{AtomicBool, Ordering}, Arc};
use tauri::{ipc::{Channel, InvokeResponseBody}, AppHandle, Emitter};
use tokio::net::UdpSocket;
use crate::rtp::H264Depay;

pub fn socket_local() -> std::io::Result<UdpSocket> {
    use socket2::{Domain, Socket, Type};
    let s = Socket::new(Domain::IPV4, Type::DGRAM, None)?;
    s.set_recv_buffer_size(8 * 1024 * 1024)?; // buffer grande: que no se pierdan ráfagas (key frames)
    s.bind(&std::net::SocketAddr::from(([127, 0, 0, 1], 0)).into())?; // puerto libre
    s.set_nonblocking(true)?;
    UdpSocket::from_std(s.into())
}

pub async fn bucle(app: AppHandle, sock: UdpSocket, canal: Channel<InvokeResponseBody>,
                   activo: Arc<AtomicBool>) {
    let mut buf = vec![0u8; 65_536];
    let mut depay = H264Depay::default();
    while let Ok(n) = sock.recv(&mut buf).await {
        if !activo.swap(true, Ordering::SeqCst) {
            let _ = app.emit("estado", "conectado");
        }
        if let Some(au) = depay.push(&buf[..n]) {
            let mut msg = Vec::with_capacity(8 + au.datos.len());
            msg.push(1);                                        // tipo: vídeo
            msg.push(au.key as u8 | (au.perdida as u8) << 1);  // flags
            msg.extend_from_slice(&[0, 0]);                     // reservado
            msg.extend_from_slice(&au.ts.to_le_bytes());        // timestamp RTP (90 kHz)
            msg.extend_from_slice(&au.datos);                   // fotograma H.264 (Annex B)
            if canal.send(InvokeResponseBody::Raw(msg)).is_err() { break; } // la web cerró el canal
        }
    }
}
```

**`rtp.rs`**: depacketizador RTP → H.264 (RFC 6184: NAL simple, STAP-A y FU-A). Son unas 80 líneas y se entiende muy bien cómo viaja el vídeo. Alternativa: el crate `rtp` de webrtc-rs trae un depacketizador H.264 hecho.

```rust
pub struct AccessUnit {
    pub datos: Vec<u8>,  // NALs con start code 00 00 00 01
    pub key: bool,       // contiene un IDR (NAL tipo 5)
    pub ts: u32,         // timestamp RTP
    pub perdida: bool,   // faltó algún paquete
}

#[derive(Default)]
pub struct H264Depay { au: Vec<u8>, fu: Vec<u8>, key: bool, perdida: bool, ultimo_seq: Option<u16> }

const START: [u8; 4] = [0, 0, 0, 1];

impl H264Depay {
    pub fn push(&mut self, pkt: &[u8]) -> Option<AccessUnit> {
        // Cabecera RTP: 12 bytes + CSRC + extensión opcional
        if pkt.len() < 12 || pkt[0] >> 6 != 2 { return None; }
        let marker = pkt[1] & 0x80 != 0;
        let seq = u16::from_be_bytes([pkt[2], pkt[3]]);
        let ts = u32::from_be_bytes([pkt[4], pkt[5], pkt[6], pkt[7]]);
        let mut ini = 12 + (pkt[0] & 0x0F) as usize * 4;
        if pkt[0] & 0x10 != 0 {
            if pkt.len() < ini + 4 { return None; }
            ini += 4 + 4 * u16::from_be_bytes([pkt[ini + 2], pkt[ini + 3]]) as usize;
        }
        let mut fin = pkt.len();
        if pkt[0] & 0x20 != 0 { fin = fin.saturating_sub(pkt[fin - 1] as usize); } // padding
        if ini >= fin { return None; }

        if let Some(u) = self.ultimo_seq {
            if seq != u.wrapping_add(1) { self.perdida = true; self.fu.clear(); }
        }
        self.ultimo_seq = Some(seq);

        let p = &pkt[ini..fin];
        match p[0] & 0x1F {
            1..=23 => self.nal(p),                       // NAL simple
            24 => {                                      // STAP-A: [tamaño u16][NAL]…
                let mut i = 1;
                while i + 2 <= p.len() {
                    let n = u16::from_be_bytes([p[i], p[i + 1]]) as usize;
                    i += 2;
                    if i + n > p.len() { break; }
                    self.nal(&p[i..i + n]);
                    i += n;
                }
            }
            28 if p.len() > 2 => {                       // FU-A: un NAL troceado
                let (ind, cab) = (p[0], p[1]);
                if cab & 0x80 != 0 { self.fu.clear(); self.fu.push((ind & 0xE0) | (cab & 0x1F)); }
                if !self.fu.is_empty() {
                    self.fu.extend_from_slice(&p[2..]);
                    if cab & 0x40 != 0 { let nal = std::mem::take(&mut self.fu); self.nal(&nal); }
                }
            }
            _ => {}
        }

        // El bit marker marca el último paquete del fotograma
        if marker && !self.au.is_empty() {
            return Some(AccessUnit {
                datos: std::mem::take(&mut self.au),
                key: std::mem::take(&mut self.key),
                ts,
                perdida: std::mem::take(&mut self.perdida),
            });
        }
        None
    }

    fn nal(&mut self, nal: &[u8]) {
        if nal.is_empty() { return; }
        if nal[0] & 0x1F == 5 { self.key = true; }
        self.au.extend_from_slice(&START);
        self.au.extend_from_slice(nal);
    }
}
```

**`guardar_archivo`**: la web le manda bytes crudos (PNG o vídeo) y Rust los guarda, así el frontend no necesita permisos de sistema de archivos.

```rust
#[tauri::command]
fn guardar_archivo(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(datos) = request.body() else { return Err("se esperaban bytes".into()) };
    let ext = request.headers().get("x-ext").and_then(|v| v.to_str().ok()).unwrap_or("bin");
    let base = if ext == "png" { app.path().picture_dir() } else { app.path().video_dir() };
    let dir = base.map_err(|e| e.to_string())?.join("Opsis");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let seg = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    let ruta = dir.join(format!("opsis-{seg}.{ext}")); // mejor con fecha legible (crate chrono)
    std::fs::write(&ruta, datos).map_err(|e| e.to_string())?;
    Ok(ruta.display().to_string())
}
```

### 5.4 Formato de los mensajes Rust → web

Cada mensaje del `Channel` es un `ArrayBuffer` con un fotograma completo:

| Bytes | Campo | Descripción |
|---|---|---|
| 0 | tipo | `1` = vídeo |
| 1 | flags | bit 0 = *key frame* (IDR) · bit 1 = hubo pérdida de paquetes |
| 2–3 | reservado | `0` |
| 4–7 | ts | Timestamp RTP (90 kHz), `u32` *little-endian* |
| 8… | datos | Fotograma H.264 en formato **Annex B** (NALs con `00 00 00 01`) |

Los **estados** van aparte, como eventos de Tauri (`"estado"`: `esperando`, `conectado`, `error:…`).

### 5.5 Frontend: decodificar y pintar

**`video/h264.ts`**

```ts
/** Recorre los NAL de un fotograma Annex B. */
export function* nals(au: Uint8Array): Generator<Uint8Array> {
  let i = 0, inicio = -1;
  while (i + 2 < au.length) {
    if (au[i] === 0 && au[i + 1] === 0 && au[i + 2] === 1) {
      if (inicio >= 0) yield au.subarray(inicio, au[i - 1] === 0 ? i - 1 : i);
      i += 3; inicio = i;
    } else i++;
  }
  if (inicio >= 0) yield au.subarray(inicio);
}

export const buscarSps = (au: Uint8Array) => {
  for (const n of nals(au)) if ((n[0] & 0x1f) === 7) return n;
  return null;
};

/** 'avc1.PPCCLL' a partir de profile_idc, constraint flags y level_idc del SPS. */
export function codecDesdeSps(sps: Uint8Array): string {
  const h = (b: number) => b.toString(16).padStart(2, '0').toUpperCase();
  return `avc1.${h(sps[1])}${h(sps[2])}${h(sps[3])}`;
}
```

**`video/decoder.ts`**: se reconfigura cuando cambia el SPS (al girar) y solo pinta el último fotograma, para no acumular latencia.

```ts
import { buscarSps, codecDesdeSps } from './h264';

export function crearDecodificador(
  canvas: HTMLCanvasElement,
  onOrientacion: (o: 'vertical' | 'horizontal') => void,
) {
  const ctx = canvas.getContext('2d')!;
  let decoder: VideoDecoder | null = null;
  let huellaSps = '';
  let ultimo: VideoFrame | null = null;

  const nuevo = () => new VideoDecoder({
    output: (f) => { ultimo?.close(); ultimo = f; },                     // solo el más reciente
    error: (e) => { console.error(e); decoder = null; huellaSps = ''; }, // se recrea en el próximo IDR
  });

  const pintar = () => {
    if (ultimo) {
      const f = ultimo; ultimo = null;
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
        if (sps && (!decoder || huella !== huellaSps)) {    // primer IDR o SPS nuevo (rotación)
          decoder ??= nuevo();
          decoder.configure({
            codec: codecDesdeSps(sps),
            optimizeForLatency: true,
            hardwareAcceleration: 'prefer-hardware',
          });
          huellaSps = huella;
        }
      }
      if (!decoder || !huellaSps) return;                  // esperando el primer IDR
      decoder.decode(new EncodedVideoChunk({
        type: key ? 'key' : 'delta',
        timestamp: Math.round((ts * 1e6) / 90000),          // 90 kHz → µs
        data: au,
      }));
    },
  };
}
```

**`main.ts`**: unirlo todo.

```ts
import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { crearDecodificador } from './video/decoder';
import { svgMarco } from './frame/frame';

const ventana = getCurrentWindow();
const disp = document.querySelector<HTMLElement>('.dispositivo')!;
const pantalla = document.querySelector<HTMLCanvasElement>('#pantalla')!;
document.querySelector('.marco')!.innerHTML = svgMarco('#2B3138'); // medianoche

let k = 0.8; // tamaño M
async function ajustarVentana(horizontal: boolean) {
  const w = Math.ceil(440 * k + 32), h = Math.ceil(894 * k + 32);
  await ventana.setSize(new LogicalSize(horizontal ? h : w, horizontal ? w : h));
}

const dec = crearDecodificador(pantalla, (o) => {
  document.body.classList.toggle('horizontal', o === 'horizontal');
  ajustarVentana(o === 'horizontal');
});

disp.addEventListener('mousedown', (e) => { if (e.button === 0) ventana.startDragging(); });

const canal = new Channel<ArrayBuffer>();
canal.onmessage = (buf) => {
  const v = new DataView(buf);
  if (v.getUint8(0) !== 1) return;
  dec.push(new Uint8Array(buf, 8), (v.getUint8(1) & 1) === 1, v.getUint32(4, true));
};

await listen<string>('estado', (e) => { document.body.dataset.estado = e.payload; });
await invoke('iniciar_opsis', { onVideo: canal });
```

### 5.6 El marco: SVG generado por código

**`frame/iphone13.ts`**: los valores de la tabla 4.4.

```ts
/** Medidas en «u» (1 u = 1 pt de iOS = 1 px CSS a escala 1). */
export const IPHONE13 = {
  cuerpo:   { w: 432, h: 886, r: 68 },          // 71,5 × 146,7 mm
  pantalla: { w: 390, h: 844, r: 47.33 },       // 1170 × 2532 px @3x
  canto: 5,                                      // aluminio visible (aprox.)
  muesca:   { w: 162, h: 32, r: 20, oreja: 6 },  // ≈ 26,8 × 5,35 mm
  altavoz:  { w: 56, h: 4 },                     // aprox.
  botones: {
    fondo: 3,                                    // lo que sobresalen (aprox.)
    izq: [{ y: 140, h: 34 }, { y: 205, h: 62 }, { y: 285, h: 62 }], // silencio, vol +, vol −
    der: [{ y: 232, h: 100 }],                   // lateral
  },
} as const;
```

**`frame/frame.ts`**

```ts
import { IPHONE13 as M } from './iphone13';

export function svgMarco(canto: string): string {
  const pad = M.botones.fondo + 1;
  const W = M.cuerpo.w + pad * 2, H = M.cuerpo.h + pad * 2;   // 440 × 894
  const cx = W / 2;
  const sx = pad + (M.cuerpo.w - M.pantalla.w) / 2;           // esquina de la pantalla
  const sy = pad + (M.cuerpo.h - M.pantalla.h) / 2;
  const n = M.muesca, nx = cx - n.w / 2;

  // Muesca: «orejas» curvas arriba y esquinas redondeadas abajo
  const muesca = `M${nx - n.oreja},${sy} Q${nx},${sy} ${nx},${sy + n.oreja}
    L${nx},${sy + n.h - n.r} Q${nx},${sy + n.h} ${nx + n.r},${sy + n.h}
    L${nx + n.w - n.r},${sy + n.h} Q${nx + n.w},${sy + n.h} ${nx + n.w},${sy + n.h - n.r}
    L${nx + n.w},${sy + n.oreja} Q${nx + n.w},${sy} ${nx + n.w + n.oreja},${sy} Z`;

  const boton = (lado: 'izq' | 'der', b: { y: number; h: number }) => {
    const x = lado === 'izq' ? pad - M.botones.fondo : pad + M.cuerpo.w - 1;
    return `<rect x="${x}" y="${pad + b.y}" width="${M.botones.fondo + 1}" height="${b.h}" rx="1.5" fill="${canto}"/>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
    <defs>
      <mask id="hueco">
        <rect width="${W}" height="${H}" fill="#fff"/>
        <rect x="${sx}" y="${sy}" width="${M.pantalla.w}" height="${M.pantalla.h}" rx="${M.pantalla.r}" fill="#000"/>
      </mask>
    </defs>
    ${M.botones.izq.map((b) => boton('izq', b)).join('')}
    ${M.botones.der.map((b) => boton('der', b)).join('')}
    <g mask="url(#hueco)">
      <rect x="${pad}" y="${pad}" width="${M.cuerpo.w}" height="${M.cuerpo.h}" rx="${M.cuerpo.r}" fill="${canto}"/>
      <rect x="${pad + M.canto}" y="${pad + M.canto}" width="${M.cuerpo.w - 2 * M.canto}"
            height="${M.cuerpo.h - 2 * M.canto}" rx="${M.cuerpo.r - M.canto}" fill="#0a0a0a"/>
    </g>
    <path d="${muesca}" fill="#0a0a0a"/>
    <rect x="${cx - M.altavoz.w / 2}" y="${pad + M.canto + 2}" width="${M.altavoz.w}"
          height="${M.altavoz.h}" rx="${M.altavoz.h / 2}" fill="#1c1c1e"/>
  </svg>`;
}
```

**`frame/frame.css`**

```css
:root { --k: 0.8; }                                   /* 0.6 / 0.8 / 1 */
html, body { margin: 0; background: transparent; overflow: hidden; user-select: none; }

.dispositivo {
  position: absolute; inset: 16px;                    /* margen para la sombra */
  filter: drop-shadow(0 10px 18px rgb(0 0 0 / 0.35));
}
#pantalla, .espera {
  position: absolute; left: 50%; top: 50%;
  width: calc(390px * var(--k)); height: calc(844px * var(--k));
  transform: translate(-50%, -50%);
  border-radius: calc(47.33px * var(--k));
  background: #000; object-fit: contain;
}
.horizontal :is(#pantalla, .espera) { width: calc(844px * var(--k)); height: calc(390px * var(--k)); }

.marco {
  position: absolute; left: 50%; top: 50%;
  width: calc(440px * var(--k)); height: calc(894px * var(--k));
  transform: translate(-50%, -50%) rotate(var(--giro, 0deg));
  pointer-events: none;
}
.marco svg { width: 100%; height: 100%; display: block; }
.horizontal .marco { --giro: -90deg; }                /* muesca a la izquierda */
.horizontal.muesca-derecha .marco { --giro: 90deg; }

.espera { display: none; }
body:not([data-estado="conectado"]) .espera { display: grid; place-content: center; }
```

### 5.7 Capturas y grabación

**Captura PNG con marco** (exporta a 3×, con fondo transparente):

```ts
export async function capturar(pantalla: HTMLCanvasElement, svg: string, horizontal: boolean, giro: number) {
  const k = 3;
  const [W, H] = horizontal ? [894, 440] : [440, 894];
  const [sw, sh] = horizontal ? [844, 390] : [390, 844];
  const c = new OffscreenCanvas(W * k, H * k);
  const ctx = c.getContext('2d')!;
  ctx.scale(k, k);

  // 1) el vídeo, recortado con la forma de la pantalla
  ctx.save();
  ctx.beginPath();
  ctx.roundRect((W - sw) / 2, (H - sh) / 2, sw, sh, 47.33);
  ctx.clip();
  ctx.drawImage(pantalla, (W - sw) / 2, (H - sh) / 2, sw, sh);
  ctx.restore();

  // 2) el marco encima (SVG → imagen), girado si toca
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await img.decode();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((giro * Math.PI) / 180);
  ctx.drawImage(img, -220, -447, 440, 894);

  const png = await c.convertToBlob({ type: 'image/png' });
  return invoke<string>('guardar_archivo', new Uint8Array(await png.arrayBuffer()), {
    headers: { 'x-ext': 'png' },
  });
}
```

- **Portapapeles:** el mismo PNG con `tauri-plugin-clipboard-manager`.
- **Grabación:** un canvas «compuesto» que en cada `requestAnimationFrame` hace lo mismo que la captura (vídeo recortado + marco) a 2×. Después `canvas.captureStream(60)` → `MediaRecorder` con `video/mp4;codecs=avc1` si `MediaRecorder.isTypeSupported()` lo admite, y si no, `video/webm;codecs=vp9`. Los trozos de `ondataavailable` se mandan a Rust cada pocos segundos, para no tener todo el vídeo en memoria.
- **Limitación v1:** la grabación va **sin audio**, porque el audio lo reproduce UxPlay fuera de la web (ver §10).

### 5.8 Ajustes y persistencia

- `tauri-plugin-store` → `ajustes.json`: nombre del receptor, PIN, ceder conexión, FPS, color, tamaño, lado de la muesca, carpeta de capturas.
- `tauri-plugin-window-state` → recordar la posición de la ventana.
- `tauri-plugin-autostart` → «Iniciar con Windows» (arrancando oculto en la bandeja).
- `tauri-plugin-single-instance` → si se abre dos veces, se enfoca la ventana existente (nunca dos UxPlay a la vez).

### 5.9 Configuración de Tauri

**`tauri.conf.json`** (lo importante):

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Opsis",
  "version": "0.1.0",
  "identifier": "io.github.dimacavidv.opsis",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Opsis",
        "width": 384,
        "height": 748,
        "transparent": true,
        "decorations": false,
        "shadow": false,
        "resizable": false,
        "alwaysOnTop": true,
        "center": true
      },
      {
        "label": "ajustes",
        "title": "Ajustes de Opsis",
        "url": "ajustes.html",
        "width": 480,
        "height": 560,
        "visible": false
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/icon.ico"],
    "externalBin": ["binaries/uxplay"],
    "resources": { "runtime/": "runtime/" },
    "windows": {
      "nsis": { "installMode": "perMachine", "installerHooks": "./windows/hooks.nsh" }
    }
  }
}
```

- **Sidecar:** el binario tiene que llamarse `binaries/uxplay-x86_64-pc-windows-msvc.exe` (sufijo = *target triple* de la build de Tauri, aunque UxPlay se compile con MinGW). Al empaquetar, Tauri lo instala como `uxplay.exe`. Tiene que existir también para `tauri dev`.
- **`resources`:** revisa en la doc de Tauri 2 la sintaxis exacta para copiar una carpeta entera (admite lista o mapa origen → destino).

**`capabilities/default.json`**: UxPlay se lanza **desde Rust**, así que el frontend **no necesita permisos de shell**:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "windows": ["main", "ajustes"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-set-always-on-top",
    "core:window:allow-show",
    "core:window:allow-hide",
    "store:default",
    "clipboard-manager:allow-write-image"
  ]
}
```

### 5.10 Empaquetado

UxPlay compilado con MSYS2 depende de **muchas DLLs** (GLib, GStreamer, libplist, OpenSSL, FFmpeg…) y de **plugins de GStreamer**. Van en `runtime/`, y al lanzar el sidecar se ajustan `PATH` y las variables `GST_*` (ver `uxplay.rs`).

**`scripts/collect-runtime.sh`** (se ejecuta en MSYS2 UCRT64):

```bash
#!/usr/bin/env bash
set -euo pipefail
UX=../UxPlay/build/uxplay.exe
OUT=src-tauri/runtime
mkdir -p "$OUT/bin" "$OUT/lib/gstreamer-1.0" src-tauri/binaries
cp "$UX" src-tauri/binaries/uxplay-x86_64-pc-windows-msvc.exe

# Lista inicial de plugins: ajustar ejecutando con GST_DEBUG=2 hasta que no falte ninguno
PLUGINS="coreelements app rtp udp playback typefindfunctions videoparsersbad
         audioparsers audioconvert audioresample autodetect wasapi wasapi2 directsound libav"
for p in $PLUGINS; do
  f="/ucrt64/lib/gstreamer-1.0/libgst$p.dll"
  [ -f "$f" ] && cp "$f" "$OUT/lib/gstreamer-1.0/"
done

# Todas las DLL de /ucrt64 de las que dependen uxplay.exe y los plugins
for f in "$UX" "$OUT"/lib/gstreamer-1.0/*.dll; do
  ldd "$f" | awk '/\/ucrt64\// {print $3}'
done | sort -u | xargs -I{} cp -u {} "$OUT/bin/"
```

**`windows/hooks.nsh`**: regla del firewall al instalar y borrado al desinstalar (por eso `installMode: perMachine`, que necesita permisos de administrador):

```nsis
!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Opsis (UxPlay)" dir=in action=allow program="$INSTDIR\uxplay.exe" enable=yes profile=private'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Opsis (UxPlay)"'
!macroend
```

- **Referencia útil:** el proyecto `leapbtw/uxplay-windows` ya empaqueta UxPlay para Windows con instalador e icono en la bandeja. Merece la pena mirar qué DLLs incluye.
- Sin firma de código, **SmartScreen/Defender avisarán** al instalar. Se documenta en el README y la firma se deja para más adelante.

---

## 6. Estructura del repositorio

```
opsis/
├─ README.md
├─ LICENSE
├─ docs/
│  └─ proyecto.md                 ← este documento
├─ scripts/
│  ├─ build-uxplay.sh             # MSYS2 UCRT64: clona el tag fijado y compila
│  └─ collect-runtime.sh          # copia uxplay.exe, DLLs y plugins
├─ index.html                     # ventana principal
├─ ajustes.html                   # ventana de ajustes
├─ src/                           # frontend (Vite + TypeScript)
│  ├─ main.ts                     # arranque, estados, atajos, menú
│  ├─ video/
│  │  ├─ h264.ts                  # NAL / SPS → codec string
│  │  └─ decoder.ts               # WebCodecs + canvas
│  ├─ frame/
│  │  ├─ iphone13.ts              # medidas y colores (única fuente de verdad)
│  │  ├─ frame.ts                 # genera el SVG
│  │  └─ frame.css
│  ├─ capture/
│  │  ├─ screenshot.ts
│  │  └─ recorder.ts
│  └─ ui/
│     ├─ espera.ts                # pantalla de espera
│     └─ ajustes.ts
└─ src-tauri/
   ├─ Cargo.toml
   ├─ tauri.conf.json
   ├─ capabilities/default.json
   ├─ windows/hooks.nsh
   ├─ binaries/                   # uxplay-x86_64-pc-windows-msvc.exe  (generado, en .gitignore)
   ├─ runtime/                    # DLLs + plugins GStreamer          (generado, en .gitignore)
   └─ src/
      ├─ main.rs
      ├─ lib.rs                   # plugins, bandeja, comandos, estado
      ├─ uxplay.rs                # lanzar/parar el sidecar, argumentos, logs
      ├─ stream.rs                # socket UDP → Channel
      ├─ rtp.rs                   # depacketizador RTP → H.264
      └─ ajustes.rs
```

Crear el proyecto: `npm create tauri-app@latest` (TypeScript + Vanilla + Vite) y después añadir plugins con `npm run tauri add shell`, `store`, etc.

---

## 7. Plan por fases

### Fase 0 — Validar que todo es posible *(antes de escribir la app)*

- [ ] Compilar UxPlay (tag fijo ≥ 1.74) en MSYS2 UCRT64, sin Bonjour.
- [ ] `uxplay -p` → el iPhone ve el PC y duplica la pantalla en la ventana de UxPlay (firewall + perfil Privado).
- [ ] Probar `-vrtp` con el receptor de prueba del README de UxPlay:
  ```bash
  # Terminal 1
  gst-launch-1.0 -v udpsrc port=5600 ! 'application/x-rtp, media=video, clock-rate=90000, encoding-name=H264, payload=96' ! rtph264depay ! h264parse ! decodebin ! videoconvert ! autovideosink sync=false
  # Terminal 2
  uxplay -p -n "Prueba" -nh -fps 60 -vrtp "config-interval=1 ! udpsink host=127.0.0.1 port=5600"
  ```
  Comprobar: **va fluido** (no a 1 fps) y **UxPlay no abre su propia ventana**.
- [ ] Apuntar los **mensajes de log** de UxPlay al conectarse y desconectarse un iPhone (para `TEXTO_DESCONEXION`).
- [ ] `uxplay -p -vdmp 600` → guardar `videodump.1.h264` para probar el decodificador sin iPhone.
- [ ] «Hola mundo» de Tauri y, en las DevTools, `await VideoDecoder.isConfigSupported({ codec: 'avc1.…' })` con el codec del SPS real → `supported: true`.

**Hecho cuando:** el vídeo llega por RTP a buena tasa y WebView2 decodifica ese H.264.

### Fase 1 — Vídeo dentro de la app (aún sin marco)

- [ ] Rust: sidecar + socket UDP + `rtp.rs` + `Channel`.
- [ ] Web: `h264.ts` + `decoder.ts` + canvas.
- [ ] Probar primero con el `videodump` (troceando por NAL: cada slice tipo 1/5 es un fotograma; SPS/PPS se pegan al IDR siguiente).
- [ ] Rotación: SPS nuevo → reconfigurar; ver que vertical ↔ horizontal funciona.
- [ ] Estados: esperando / conectado / error + reintento si UxPlay muere.
- [ ] Medir **latencia** (cronómetro en el iPhone frente a la ventana) y **desfase con el audio**. Decidir `sync=true` / `sync=false`.

**Hecho cuando:** se ve el iPhone en una ventana normal de Tauri, fluido, en las dos orientaciones.

### Fase 2 — El marco de iPhone 13

- [ ] `iphone13.ts` + `frame.ts` + `frame.css`.
- [ ] Ventana transparente sin bordes, arrastrable, tamaños S/M/L.
- [ ] Rotación del marco y cambio del lado de la muesca.
- [ ] Pantalla de espera dentro del marco.
- [ ] Ajustar las medidas *aprox.* con una foto frontal real hasta que «engañe».
- [ ] Los 6 colores.

**Hecho cuando:** parece un iPhone 13 encima del escritorio.

### Fase 3 — Funciones

- [ ] Capturas PNG con marco (archivo + portapapeles).
- [ ] Grabación con marco.
- [ ] Bandeja del sistema, menú contextual y atajos.
- [ ] Ventana de ajustes y persistencia; reiniciar UxPlay al cambiar el nombre o el PIN.
- [ ] Inicio con Windows y una sola instancia.

### Fase 4 — Empaquetado y publicación

- [ ] `build-uxplay.sh` + `collect-runtime.sh` reproducibles.
- [ ] Instalador NSIS con regla de firewall; probarlo en un Windows **limpio** (máquina virtual) sin MSYS2.
- [ ] README con GIF de demo, requisitos, solución de problemas y licencias.
- [ ] Release en GitHub con el instalador.

---

## 8. Riesgos y problemas típicos

### Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Apple deja de soportar el «Legacy Protocol» de AirPlay que usa UxPlay (el propio proyecto avisa de que no hay garantía) | Alto | Depende de UxPlay: fijar versión, seguir el repo, actualizar cuando haga falta |
| `-vrtp` se comporta distinto de lo esperado (ventana propia, fps bajos) | Medio | Se comprueba en la **fase 0**, antes de invertir tiempo |
| Pérdida de paquetes UDP → artefactos hasta el siguiente IDR (iOS no manda IDR a menudo) | Medio | Buffer de socket grande (8 MB); si el decoder falla, recrearlo y esperar al siguiente IDR |
| Desfase audio/vídeo (el audio lo pone UxPlay) | Medio | Medir en la fase 1; v2 con `-artp` (§10) |
| El mDNS interno de UxPlay choca con algo de Windows | Medio | Plan B: build con Bonjour (`-DUSE_DNS_SD=1`) |
| Empaquetar las DLLs de GStreamer es tedioso | Medio | Script + prueba en una VM limpia + mirar uxplay-windows |
| Las esquinas transparentes de la ventana siguen capturando clics | Bajo | Mejora opcional: *hit-test* con la posición del cursor y `set_ignore_cursor_events` |
| SmartScreen avisa al instalar (sin firma) | Bajo | Documentarlo; firmar más adelante |

### Problemas típicos (para el README)

| Síntoma | Causa probable | Solución |
|---|---|---|
| El PC no sale en «Duplicar pantalla» | Firewall, red en perfil Público, aislamiento de clientes (redes de invitados o del instituto) o mDNS | Regla del firewall, perfil Privado, otra red; probar la build con Bonjour |
| Sale, pero no conecta | Puertos bloqueados | Usar `-p` y regla para TCP 7000/7001/7100 y UDP 6000/6001/7011 |
| Va a tirones | Wi-Fi saturada o en 2,4 GHz | Red de 5 GHz, PC por cable |
| La imagen se queda quieta sin desconectarse | La pantalla del iPhone no cambia (es normal) | Nada |
| Manchas verdes o grises | Pérdida de paquetes | Se arregla solo en el siguiente IDR |

---

## 9. Licencias y marca

*(No soy abogado: esto es orientativo. Si algún día hay uso comercial, conviene consultarlo.)*

- **UxPlay es GPL-3.** Lo usamos **sin modificar**, como **programa aparte** que se comunica por la red local (UDP). Así tu código puede llevar su propia licencia (MIT, GPL…).
- Al **distribuir** el instalador con `uxplay.exe` dentro hay que incluir la **licencia GPL-3 de UxPlay** y un **enlace al código fuente exacto** de la versión empaquetada (el tag). Lo mismo con las DLLs: GStreamer (LGPL) y FFmpeg/libav (LGPL o GPL, según cómo esté compilado).
- **Lo más sencillo:** publicar todo el proyecto como **GPL-3** y olvidarse.
- **Marca Apple:** nada de logo de Apple ni «iPhone» en el nombre o el icono de la app. Una frase descriptiva tipo «para duplicar la pantalla de un iPhone» en el README es otra cosa.
- **El marco lo dibujamos nosotros** (SVG propio a partir de medidas públicas). No usar las plantillas oficiales de dispositivos de Apple, que tienen sus propias condiciones de uso. Tampoco empaquetar SF Pro.

---

## 10. Ideas para después

- **Audio por la app** con `-artp` (UxPlay manda PCM L16 por RTP): reproducirlo con Web Audio → **grabación con audio** y sincronía controlada por nosotros.
- **Más marcos**: 13 mini, 15, 16… El diseño ya está parametrizado: solo es otro `iphoneXX.ts`.
- **Modo presentación**: pantalla completa con fondo de color o degradado y el iPhone centrado.
- **Click-through** en las esquinas transparentes.
- **Instalador sin admin** (`currentUser`) pidiendo la regla del firewall solo la primera vez.
- **Grabación nativa** con `-mp4` (sin marco, con audio) como alternativa rápida.

---

## 11. Referencias

- UxPlay (código, opciones, compilación en Windows): <https://github.com/FDH2/UxPlay>
- uxplay-windows (empaquetado de referencia): <https://github.com/leapbtw/uxplay-windows>
- Tauri 2 — Sidecar (binarios externos): <https://tauri.app/develop/sidecar/>
- Tauri 2 — Llamar al frontend desde Rust (Channels): <https://tauri.app/develop/calling-frontend/>
- Tauri 2 — API JS `core` (`Channel<ArrayBuffer>` con `InvokeResponseBody::Raw`): <https://tauri.app/reference/javascript/api/namespacecore/>
- WebCodecs (MDN): <https://developer.mozilla.org/docs/Web/API/WebCodecs_API>
- RFC 6184 — RTP Payload Format for H.264: <https://www.rfc-editor.org/rfc/rfc6184>
- iPhone 13 — Especificaciones técnicas (Apple): <https://support.apple.com/es-lamr/111872>
- ScreenCorners (radios de esquina de la pantalla por modelo): <https://github.com/kylebshr/ScreenCorners>
- Apple — *Accessory Design Guidelines* (planos acotados para afinar botones y muesca): en developer.apple.com/accessories
