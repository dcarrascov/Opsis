mod ajustes;
mod rtp;
mod stream;
mod uxplay;

use std::sync::{atomic::AtomicBool, Arc, Mutex};
use tauri::{
    async_runtime::JoinHandle,
    ipc::{Channel, InvokeBody, InvokeResponseBody, Request},
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_shell::process::CommandChild;

#[derive(Default)]
struct Estado {
    uxplay: Mutex<Option<CommandChild>>,
    bucle: Mutex<Option<JoinHandle<()>>>,
    /// ¿Está llegando vídeo de un iPhone?
    activo: Arc<AtomicBool>,
}

impl Estado {
    /// Para UxPlay y el bucle de vídeo (al reiniciar o al salir).
    fn parar(&self) {
        if let Some(h) = self.uxplay.lock().unwrap().take() {
            let _ = h.kill();
        }
        if let Some(b) = self.bucle.lock().unwrap().take() {
            b.abort();
        }
    }
}

/// Lo que la pantalla de espera necesita saber del receptor.
#[derive(serde::Serialize)]
struct Receptor {
    nombre: String,
    /// PIN que pedirá el iPhone la primera vez (None si el PIN está desactivado).
    pin: Option<String>,
}

/// Arranca (o reinicia) UxPlay y el bucle que manda el vídeo a la web.
#[tauri::command]
async fn iniciar_opsis(
    app: AppHandle,
    estado: State<'_, Estado>,
    on_video: Channel<InvokeResponseBody>,
) -> Result<Receptor, String> {
    estado.parar();

    let sock = stream::socket_local().map_err(|e| e.to_string())?;
    let puerto = sock.local_addr().map_err(|e| e.to_string())?.port();

    let ajustes = ajustes::cargar(&app);
    let hijo = uxplay::lanzar(&app, puerto, &ajustes, estado.activo.clone())?;
    *estado.uxplay.lock().unwrap() = Some(hijo);

    let b = tauri::async_runtime::spawn(stream::bucle(app.clone(), sock, on_video, estado.activo.clone()));
    *estado.bucle.lock().unwrap() = Some(b);

    let _ = app.emit("estado", "esperando");
    Ok(Receptor {
        pin: ajustes.pin.then(|| format!("{:04}", ajustes.codigo_pin)),
        nombre: ajustes.nombre,
    })
}

/// La web manda bytes crudos (PNG o vídeo) y aquí se guardan en Imágenes\Opsis o Vídeos\Opsis.
#[tauri::command]
fn guardar_archivo(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(datos) = request.body() else {
        return Err("se esperaban bytes".into());
    };
    let ext = request
        .headers()
        .get("x-ext")
        .and_then(|v| v.to_str().ok())
        .filter(|e| matches!(*e, "png" | "mp4" | "webm"))
        .unwrap_or("bin");
    let base = if ext == "png" { app.path().picture_dir() } else { app.path().video_dir() };
    let dir = base.map_err(|e| e.to_string())?.join("Opsis");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let seg = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let ruta = dir.join(format!("opsis-{seg}.{ext}"));
    std::fs::write(&ruta, datos).map_err(|e| e.to_string())?;
    Ok(ruta.display().to_string())
}

#[tauri::command]
fn salir(app: AppHandle) {
    app.exit(0);
}

fn mostrar(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn crear_bandeja(app: &tauri::App) -> tauri::Result<()> {
    let mostrar_i = MenuItem::with_id(app, "mostrar", "Mostrar / ocultar", true, None::<&str>)?;
    let salir_i = MenuItem::with_id(app, "salir", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&mostrar_i, &salir_i])?;

    let mut tray = TrayIconBuilder::with_id("principal")
        .tooltip("Opsis")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, ev| match ev.id.as_ref() {
            "mostrar" => alternar(app),
            "salir" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                alternar(tray.app_handle());
            }
        });
    if let Some(icono) = app.default_window_icon() {
        tray = tray.icon(icono.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn alternar(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            mostrar(app);
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        // Una sola instancia: nunca dos UxPlay a la vez
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| mostrar(app)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(Estado::default())
        .setup(|app| {
            crear_bandeja(app)?;
            Ok(())
        })
        .on_window_event(|w, ev| {
            // Cerrar la ventana principal (Alt+F4, barra de tareas…) cierra la app entera.
            // Para dejarla en segundo plano está «Ocultar» (Esc o menú).
            if let WindowEvent::CloseRequested { .. } = ev {
                if w.label() == "main" {
                    w.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![iniciar_opsis, guardar_archivo, salir])
        .build(tauri::generate_context!())
        .expect("error al construir la app")
        .run(|app, ev| {
            if let tauri::RunEvent::Exit = ev {
                // Que no se quede uxplay.exe huérfano
                app.state::<Estado>().parar();
            }
        });
}
