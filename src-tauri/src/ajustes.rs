//! Ajustes del receptor (argumentos de arranque de UxPlay), guardados en `ajustes.json`
//! con tauri-plugin-store. Las preferencias visuales (color, tamaño…) las guarda la web.

use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub struct Ajustes {
    /// Nombre que aparece en «Duplicar pantalla».
    pub nombre: String,
    /// Pedir PIN la primera vez que se conecta cada iPhone (activado por defecto: sin PIN,
    /// cualquiera en la misma Wi-Fi podría duplicar su pantalla en el PC).
    pub pin: bool,
    /// PIN fijo de 4 cifras (1000–9999). Se genera al azar la primera vez y se guarda.
    pub codigo_pin: u16,
    /// Un iPhone nuevo puede quitarle la conexión al actual (`-nohold`).
    pub ceder: bool,
    /// 30 o 60.
    pub fps: u32,
    /// Vídeo sin sincronizar con el audio (menos latencia).
    pub baja_latencia: bool,
}

impl Default for Ajustes {
    fn default() -> Self {
        Self { nombre: "Opsis".into(), pin: true, codigo_pin: 0, ceder: false, fps: 60, baja_latencia: false }
    }
}

/// PIN aleatorio 1000–9999. `RandomState` se siembra con el generador aleatorio del sistema
/// operativo (no hace falta añadir el crate `rand` para 4 cifras).
fn pin_aleatorio() -> u16 {
    use std::hash::{BuildHasher, Hasher};
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    1000 + (h.finish() % 9000) as u16
}

fn valido(n: u64) -> bool {
    (1000..=9999).contains(&n)
}

pub fn cargar(app: &AppHandle) -> Ajustes {
    let mut a = Ajustes::default();
    let Ok(store) = app.store("ajustes.json") else {
        a.codigo_pin = pin_aleatorio(); // sin almacén: PIN nuevo en cada arranque, mejor que ninguno
        return a;
    };

    if let Some(Value::String(s)) = store.get("nombre") {
        let s = s.trim();
        if !s.is_empty() {
            a.nombre = s.chars().take(64).collect();
        }
    }
    if let Some(Value::Bool(b)) = store.get("pin") {
        a.pin = b;
    }
    match store.get("codigo_pin").and_then(|v| v.as_u64()) {
        Some(n) if valido(n) => a.codigo_pin = n as u16,
        _ => {
            a.codigo_pin = pin_aleatorio();
            store.set("codigo_pin", a.codigo_pin);
            let _ = store.save();
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pin_de_cuatro_cifras_y_variado() {
        let pins: std::collections::HashSet<u16> = (0..200).map(|_| pin_aleatorio()).collect();
        assert!(pins.iter().all(|p| (1000..=9999).contains(p)));
        assert!(pins.len() > 150, "los PIN deben variar ({} distintos de 200)", pins.len());
    }
}
