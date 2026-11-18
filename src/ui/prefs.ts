import { COLORES, TAMANOS, type Color, type Tamano } from '../frame/iphone13';

/** Preferencias visuales de la ventana (las del receptor van en ajustes.json, en Rust). */
export interface Prefs {
  color: Color;
  tamano: Tamano;
  muescaDerecha: boolean;
  siempreEncima: boolean;
}

const CLAVE = 'opsis.prefs';
const PREDETERMINADAS: Prefs = { color: 'medianoche', tamano: 'M', muescaDerecha: false, siempreEncima: true };

export function cargarPrefs(): Prefs {
  try {
    const p = { ...PREDETERMINADAS, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') };
    if (!(p.color in COLORES)) p.color = PREDETERMINADAS.color;
    if (!(p.tamano in TAMANOS)) p.tamano = PREDETERMINADAS.tamano;
    return p;
  } catch {
    return { ...PREDETERMINADAS };
  }
}

export function guardarPrefs(p: Prefs): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: se usan las predeterminadas la próxima vez */
  }
}
