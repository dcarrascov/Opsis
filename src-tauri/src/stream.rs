//! Socket UDP local que recibe el RTP de UxPlay y manda cada fotograma a la web.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{
    ipc::{Channel, InvokeResponseBody},
    AppHandle, Emitter,
};
use tokio::net::UdpSocket;

use crate::rtp::H264Depay;

/// Socket en 127.0.0.1 con un puerto libre y buffer grande (que no se pierdan las ráfagas de los IDR).
pub fn socket_local() -> std::io::Result<UdpSocket> {
    use socket2::{Domain, Socket, Type};
    let s = Socket::new(Domain::IPV4, Type::DGRAM, None)?;
    s.set_recv_buffer_size(8 * 1024 * 1024)?;
    s.bind(&std::net::SocketAddr::from(([127, 0, 0, 1], 0)).into())?;
    s.set_nonblocking(true)?;
    UdpSocket::from_std(s.into())
}

/// Mensaje: [tipo=1][flags][0][0][ts u32 LE][fotograma H.264 Annex B]
/// flags: bit 0 = key frame, bit 1 = hubo pérdida de paquetes.
pub async fn bucle(app: AppHandle, sock: UdpSocket, canal: Channel<InvokeResponseBody>, activo: Arc<AtomicBool>) {
    let mut buf = vec![0u8; 65_536];
    let mut depay = H264Depay::default();
    while let Ok(n) = sock.recv(&mut buf).await {
        if !activo.swap(true, Ordering::SeqCst) {
            let _ = app.emit("estado", "conectado");
        }
        if let Some(au) = depay.push(&buf[..n]) {
            let mut msg = Vec::with_capacity(8 + au.datos.len());
            msg.push(1);
            msg.push(au.key as u8 | (au.perdida as u8) << 1);
            msg.extend_from_slice(&[0, 0]);
            msg.extend_from_slice(&au.ts.to_le_bytes());
            msg.extend_from_slice(&au.datos);
            if canal.send(InvokeResponseBody::Raw(msg)).is_err() {
                break; // la web cerró el canal (recarga de la página)
            }
        }
    }
}
