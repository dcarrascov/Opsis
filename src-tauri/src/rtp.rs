//! Depacketizador RTP → H.264 (RFC 6184): NAL simple, STAP-A y FU-A.
//! Junta los paquetes de un fotograma (hasta el bit marker) en un access unit Annex B.

pub struct AccessUnit {
    /// NALs con start code 00 00 00 01.
    pub datos: Vec<u8>,
    /// Contiene un IDR (NAL tipo 5).
    pub key: bool,
    /// Timestamp RTP (90 kHz).
    pub ts: u32,
    /// Faltó algún paquete.
    pub perdida: bool,
}

#[derive(Default)]
pub struct H264Depay {
    au: Vec<u8>,
    fu: Vec<u8>,
    key: bool,
    perdida: bool,
    ultimo_seq: Option<u16>,
}

const START: [u8; 4] = [0, 0, 0, 1];

impl H264Depay {
    pub fn push(&mut self, pkt: &[u8]) -> Option<AccessUnit> {
        // Cabecera RTP: 12 bytes + CSRC + extensión opcional
        if pkt.len() < 12 || pkt[0] >> 6 != 2 {
            return None;
        }
        let marker = pkt[1] & 0x80 != 0;
        let seq = u16::from_be_bytes([pkt[2], pkt[3]]);
        let ts = u32::from_be_bytes([pkt[4], pkt[5], pkt[6], pkt[7]]);
        let mut ini = 12 + (pkt[0] & 0x0F) as usize * 4;
        if pkt[0] & 0x10 != 0 {
            if pkt.len() < ini + 4 {
                return None;
            }
            ini += 4 + 4 * u16::from_be_bytes([pkt[ini + 2], pkt[ini + 3]]) as usize;
        }
        let mut fin = pkt.len();
        if pkt[0] & 0x20 != 0 {
            fin = fin.saturating_sub(pkt[fin - 1] as usize); // padding
        }
        if ini >= fin {
            return None;
        }

        if let Some(u) = self.ultimo_seq {
            if seq != u.wrapping_add(1) {
                self.perdida = true;
                self.fu.clear();
            }
        }
        self.ultimo_seq = Some(seq);

        let p = &pkt[ini..fin];
        match p[0] & 0x1F {
            1..=23 => self.nal(p), // NAL simple
            24 => {
                // STAP-A: [tamaño u16][NAL]…
                let mut i = 1;
                while i + 2 <= p.len() {
                    let n = u16::from_be_bytes([p[i], p[i + 1]]) as usize;
                    i += 2;
                    if i + n > p.len() {
                        break;
                    }
                    self.nal(&p[i..i + n]);
                    i += n;
                }
            }
            28 if p.len() > 2 => {
                // FU-A: un NAL troceado en varios paquetes
                let (ind, cab) = (p[0], p[1]);
                if cab & 0x80 != 0 {
                    self.fu.clear();
                    self.fu.push((ind & 0xE0) | (cab & 0x1F));
                }
                if !self.fu.is_empty() {
                    self.fu.extend_from_slice(&p[2..]);
                    if cab & 0x40 != 0 {
                        let nal = std::mem::take(&mut self.fu);
                        self.nal(&nal);
                    }
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
        if nal.is_empty() {
            return;
        }
        if nal[0] & 0x1F == 5 {
            self.key = true;
        }
        self.au.extend_from_slice(&START);
        self.au.extend_from_slice(nal);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rtp(seq: u16, marker: bool, payload: &[u8]) -> Vec<u8> {
        let mut p = vec![0x80, if marker { 0x80 | 96 } else { 96 }];
        p.extend_from_slice(&seq.to_be_bytes());
        p.extend_from_slice(&9000u32.to_be_bytes());
        p.extend_from_slice(&[0, 0, 0, 1]); // SSRC
        p.extend_from_slice(payload);
        p
    }

    #[test]
    fn nal_simple_y_marker() {
        let mut d = H264Depay::default();
        assert!(d.push(&rtp(1, false, &[0x67, 1, 2, 3])).is_none()); // SPS
        let au = d.push(&rtp(2, true, &[0x65, 9, 9])).unwrap(); // IDR
        assert!(au.key && !au.perdida);
        assert_eq!(au.datos, [0, 0, 0, 1, 0x67, 1, 2, 3, 0, 0, 0, 1, 0x65, 9, 9]);
        assert_eq!(au.ts, 9000);
    }

    #[test]
    fn stap_a() {
        let mut d = H264Depay::default();
        let au = d.push(&rtp(1, true, &[24, 0, 2, 0x67, 7, 0, 2, 0x68, 8])).unwrap();
        assert_eq!(au.datos, [0, 0, 0, 1, 0x67, 7, 0, 0, 0, 1, 0x68, 8]);
    }

    #[test]
    fn fu_a_y_perdida() {
        let mut d = H264Depay::default();
        // FU indicator 0x7C (NRI 3, tipo 28), cabeceras: inicio 0x85, medio 0x05, fin 0x45
        assert!(d.push(&rtp(10, false, &[0x7C, 0x85, 1, 2])).is_none());
        assert!(d.push(&rtp(11, false, &[0x7C, 0x05, 3])).is_none());
        let au = d.push(&rtp(12, true, &[0x7C, 0x45, 4])).unwrap();
        assert!(au.key);
        assert_eq!(au.datos, [0, 0, 0, 1, 0x65, 1, 2, 3, 4]);

        // Salto de secuencia → pérdida marcada
        let au = d.push(&rtp(20, true, &[0x41, 5])).unwrap();
        assert!(au.perdida && !au.key);
    }
}
