//! Ajustes del receptor (argumentos de arranque de UxPlay), guardados en `ajustes.json`
//! con tauri-plugin-store. Las preferencias visuales (color, tamaño…) las guarda la web.

use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub struct Ajustes {
    /// Nombre que aparece en «Duplicar pantalla».
    pub nombre: String,
    /// Pedir PIN al conectar un iPhone nuevo.
    pub pin: bool,
    /// Un iPhone nuevo puede quitarle la conexión al actual (`-nohold`).
    pub ceder: bool,
    /// 30 o 60.
    pub fps: u32,
    /// Vídeo sin sincronizar con el audio (menos latencia).
    pub baja_latencia: bool,
}

impl Default for Ajustes {
    fn default() -> Self {
        Self { nombre: "Opsis".into(), pin: false, ceder: false, fps: 60, baja_latencia: false }
    }
}

pub fn cargar(app: &AppHandle) -> Ajustes {
    let mut a = Ajustes::default();
    let Ok(store) = app.store("ajustes.json") else { return a };

    if let Some(Value::String(s)) = store.get("nombre") {
        let s = s.trim();
        if !s.is_empty() {
            a.nombre = s.to_string();
        }
    }
    if let Some(Value::Bool(b)) = store.get("pin") {
        a.pin = b;
    }
    if let Some(Value::Bool(b)) = store.get("ceder") {
        a.ceder = b;
    }
    if let Some(n) = store.get("fps").and_then(|v| v.as_u64()) {
        a.fps = if n <= 30 { 30 } else { 60 };
    }
    if let Some(Value::Bool(b)) = store.get("baja_latencia") {
        a.baja_latencia = b;
    }
    a
}
