//! Lanza UxPlay (sidecar sin modificar) con sus DLLs y vigila sus logs.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

use crate::ajustes::Ajustes;

// UxPlay solo avisa del fin de la duplicación en sus logs de depuración (`-d 1`, sin volcar
// paquetes). Textos sacados de uxplay.cpp (commit fijado en scripts/build-uxplay.sh):
// conn_destroy() → "Open connections: 0" y video_reset() → "video_reset: type = RTP_Shutdown".
const TEXTOS_DESCONEXION: &[&str] = &["Open connections: 0", "video_reset: type = RTP_Shutdown"];

pub fn lanzar(app: &AppHandle, puerto: u16, a: &Ajustes, activo: Arc<AtomicBool>) -> Result<CommandChild, String> {
    let sync = if a.baja_latencia { " sync=false" } else { "" };
    let mut args = vec![
        "-n".to_string(),
        a.nombre.clone(),
        "-nh".into(),
        "-p".into(),
        "-d".into(),
        "1".into(),
        "-fps".into(),
        a.fps.to_string(),
        "-vrtp".into(),
        format!("config-interval=1 ! udpsink host=127.0.0.1 port={puerto}{sync}"),
    ];
    if a.pin {
        args.push("-pin".into());
        if let Ok(dir) = app.path().app_data_dir() {
            let _ = std::fs::create_dir_all(&dir);
            args.push("-reg".into());
            args.push(dir.join("uxplay.register").display().to_string());
        }
    }
    if a.ceder {
        args.push("-nohold".into());
    }

    let mut cmd = app.shell().sidecar("uxplay").map_err(|e| e.to_string())?.args(args);

    // En la app instalada, las DLLs y plugins de GStreamer van en resources/runtime.
    // En desarrollo, si no existe esa carpeta, se usa el PATH del sistema (p. ej. C:\msys64\ucrt64\bin).
    if let Ok(rt) = app.path().resource_dir().map(|d| d.join("runtime")) {
        if rt.join("bin").is_dir() {
            let path = format!("{};{}", rt.join("bin").display(), std::env::var("PATH").unwrap_or_default());
            cmd = cmd
                .env("PATH", path)
                .env("GST_PLUGIN_SYSTEM_PATH_1_0", rt.join("lib").join("gstreamer-1.0")) // solo NUESTROS plugins
                .env("GST_PLUGIN_PATH_1_0", "");
            if let Ok(cache) = app.path().app_cache_dir() {
                let _ = std::fs::create_dir_all(&cache);
                cmd = cmd.env("GST_REGISTRY_1_0", cache.join("gst-registry.bin"));
            }
        }
    }

    let (mut rx, hijo) = cmd.spawn().map_err(|e| format!("no se pudo lanzar UxPlay: {e}"))?;

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(ev) = rx.recv().await {
            match ev {
                CommandEvent::Stdout(l) | CommandEvent::Stderr(l) => {
                    let linea = String::from_utf8_lossy(&l);
                    #[cfg(debug_assertions)]
                    eprintln!("[uxplay] {}", linea.trim_end());
                    if TEXTOS_DESCONEXION.iter().any(|t| linea.contains(t)) {
                        activo.store(false, Ordering::SeqCst);
                        let _ = app.emit("estado", "esperando");
                    }
                }
                CommandEvent::Terminated(t) => {
                    activo.store(false, Ordering::SeqCst);
                    let _ = app.emit("estado", format!("error:{:?}", t.code)); // la UI ofrece «Reintentar»
                }
                _ => {}
            }
        }
    });
    Ok(hijo)
}
