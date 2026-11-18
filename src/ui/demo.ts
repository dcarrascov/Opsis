/**
 * Pantallas de prueba para ver el marco sin iPhone (navegador con `?demo` o `?demo=horizontal`).
 * Vertical: una pantalla de inicio inventada (barra de estado, iconos, dock).
 * Horizontal: un «vídeo» de paisaje a pantalla completa con su barra de reproducción.
 * Todo dibujado aquí: nada de capturas ni iconos reales.
 */
export function pintarDemo(canvas: HTMLCanvasElement, horizontal: boolean): void {
  const [w, h] = horizontal ? [2532, 1170] : [1170, 2532];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (horizontal) paisaje(ctx, w, h);
  else inicio(ctx, w, h);
}

function barraEstado(ctx: CanvasRenderingContext2D, w: number, y: number, xHora: number, xBat: number) {
  ctx.fillStyle = '#fff';
  ctx.font = '600 50px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('9:41', xHora, y);
  // Cobertura, wifi y batería (formas simples)
  const x = w - xBat;
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 230 + i * 20, y + 14 - i * 9, 13, 10 + i * 9);
  ctx.beginPath();
  ctx.arc(x - 115, y + 16, 34, Math.PI * 1.25, Math.PI * 1.75);
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - 115, y + 16, 16, Math.PI * 1.25, Math.PI * 1.75);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x - 60, y - 19, 72, 38, 11);
  ctx.stroke();
  ctx.fillRect(x - 53, y - 12, 50, 24);
  ctx.fillRect(x + 16, y - 7, 5, 14);
}

function inicio(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Fondo de pantalla: degradado con dos manchas de luz
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#1d2b64');
  g.addColorStop(0.55, '#6a3093');
  g.addColorStop(1, '#f8b26a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const [x, y, r, c] of [
    [250, 700, 700, 'rgb(90 200 250 / 0.35)'],
    [950, 1900, 800, 'rgb(255 120 160 / 0.30)'],
  ] as const) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }

  barraEstado(ctx, w, 75, 140, 120);

  // Widget de reloj y tiempo
  ctx.fillStyle = 'rgb(255 255 255 / 0.16)';
  ctx.beginPath();
  ctx.roundRect(90, 230, w - 180, 420, 70);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '300 190px "Segoe UI", sans-serif';
  ctx.fillText('9:41', 160, 420);
  ctx.font = '600 56px "Segoe UI", sans-serif';
  ctx.fillText('Miércoles, 18', 170, 560);
  ctx.font = '600 120px "Segoe UI", sans-serif';
  ctx.fillText('21°', w - 380, 420);
  ctx.beginPath();
  ctx.fillStyle = '#ffd60a';
  ctx.arc(w - 260, 560, 46, 0, Math.PI * 2);
  ctx.fill();

  // Iconos de apps: cuadrados redondeados con un símbolo geométrico
  const colores = ['#34c759', '#0a84ff', '#ff9f0a', '#ff375f', '#5e5ce6', '#64d2ff', '#bf5af2', '#ffd60a',
    '#30d158', '#ff453a', '#0a84ff', '#ac8e68', '#66d4cf', '#ff9f0a', '#5856d6', '#ff2d55'];
  const lado = 190;
  const hueco = (w - 4 * lado) / 5;
  colores.forEach((c, i) => {
    const x = hueco + (i % 4) * (lado + hueco);
    const y = 760 + Math.floor(i / 4) * (lado + 140);
    const ig = ctx.createLinearGradient(x, y, x, y + lado);
    ig.addColorStop(0, c);
    ig.addColorStop(1, c + 'cc');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.roundRect(x, y, lado, lado, 46);
    ctx.fill();
    ctx.fillStyle = 'rgb(255 255 255 / 0.9)';
    ctx.beginPath();
    if (i % 3 === 0) ctx.arc(x + lado / 2, y + lado / 2, 48, 0, Math.PI * 2);
    else if (i % 3 === 1) ctx.roundRect(x + 55, y + 55, 80, 80, 18);
    else {
      ctx.moveTo(x + lado / 2, y + 45);
      ctx.lineTo(x + 145, y + 140);
      ctx.lineTo(x + 45, y + 140);
    }
    ctx.fill();
    ctx.fillStyle = 'rgb(255 255 255 / 0.85)';
    ctx.fillRect(x + 40, y + lado + 30, lado - 80, 16);
  });

  // Puntos de página y dock
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 0 ? '#fff' : 'rgb(255 255 255 / 0.4)';
    ctx.beginPath();
    ctx.arc(w / 2 - 40 + i * 40, h - 420, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgb(255 255 255 / 0.22)';
  ctx.beginPath();
  ctx.roundRect(50, h - 360, w - 100, 270, 90);
  ctx.fill();
  ['#30d158', '#0a84ff', '#ff9f0a', '#ff375f'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(hueco + i * (lado + hueco), h - 320, lado, lado, 46);
    ctx.fill();
  });
  // Indicador de inicio
  ctx.fillStyle = 'rgb(255 255 255 / 0.85)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - 210, h - 45, 420, 16, 8);
  ctx.fill();
}

function paisaje(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Cielo de atardecer
  const cielo = ctx.createLinearGradient(0, 0, 0, h);
  cielo.addColorStop(0, '#2b1055');
  cielo.addColorStop(0.45, '#d4418e');
  cielo.addColorStop(0.75, '#ffb88c');
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, w, h);
  // Sol
  const sol = ctx.createRadialGradient(w * 0.62, h * 0.62, 0, w * 0.62, h * 0.62, 420);
  sol.addColorStop(0, 'rgb(255 240 200 / 1)');
  sol.addColorStop(0.25, 'rgb(255 210 150 / 0.9)');
  sol.addColorStop(1, 'transparent');
  ctx.fillStyle = sol;
  ctx.fillRect(0, 0, w, h);
  // Montañas en capas
  const capas = [
    { y: 0.62, a: 140, c: '#7b2f6b' },
    { y: 0.72, a: 110, c: '#4a1d4f' },
    { y: 0.84, a: 80, c: '#241231' },
  ];
  capas.forEach(({ y, a, c }, n) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) {
      const yy = h * y - Math.sin(x / (260 + n * 90) + n) * a - Math.sin(x / 97 + n * 2) * a * 0.25;
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(w, h);
    ctx.fill();
  });

  // Controles de vídeo: barra de progreso y botones
  const sombra = ctx.createLinearGradient(0, h - 330, 0, h);
  sombra.addColorStop(0, 'transparent');
  sombra.addColorStop(1, 'rgb(0 0 0 / 0.55)');
  ctx.fillStyle = sombra;
  ctx.fillRect(0, h - 330, w, 330);
  const x0 = 200;
  const x1 = w - 200;
  const yb = h - 120;
  ctx.fillStyle = 'rgb(255 255 255 / 0.35)';
  ctx.beginPath();
  ctx.roundRect(x0, yb, x1 - x0, 14, 7);
  ctx.fill();
  const prog = x0 + (x1 - x0) * 0.38;
  ctx.fillStyle = '#ff375f';
  ctx.beginPath();
  ctx.roundRect(x0, yb, prog - x0, 14, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(prog, yb + 7, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '600 44px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('3:42', x0, yb - 60);
  ctx.fillText('9:51', x1 - 95, yb - 60);
  // Pausa en el centro
  ctx.fillStyle = 'rgb(0 0 0 / 0.3)';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2 - 60, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(w / 2 - 45, h / 2 - 125, 32, 130);
  ctx.fillRect(w / 2 + 13, h / 2 - 125, 32, 130);
}
