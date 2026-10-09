/**
 * "Fondo animado / Autenticación" del Figma (variantes Paso 1 → 2 → 3, Smart Animate de 4 s):
 * las ondas rojas se desplazan, los hexágonos giran 30° por paso y los puntos alternan su opacidad.
 */
const PUNTOS = [896.266, 926.266, 956.266].flatMap((y) => [118.667, 148.667, 178.667, 208.667].map((x, i) => ({ x, y, par: i % 2 === 0 })));

export function FondoAuth() {
  return (
    <svg
      aria-hidden
      className="fondo-auth pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMinYMid slice"
      fill="none"
    >
      <defs>
        <filter id="fondo-auth-desenfoque" x="-200" y="-300" width="2400" height="1600" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="45" />
        </filter>
        <linearGradient id="fondo-auth-degradado" x1="0" y1="0" x2="922.967" y2="1640.83" gradientUnits="userSpaceOnUse">
          <stop stopColor="#061B49" />
          <stop offset="0.259615" stopColor="#0B3A78" />
          <stop offset="1" stopColor="#02112F" />
        </linearGradient>
      </defs>
      <path d="M1920 0H0V1080H1920V0Z" fill="url(#fondo-auth-degradado)" />
      <ellipse opacity="0.08" filter="url(#fondo-auth-desenfoque)" cx="1573.33" cy="137.11" rx="333.33" ry="263.67" fill="white" />
      <ellipse opacity="0.16" filter="url(#fondo-auth-desenfoque)" cx="293.33" cy="896.48" rx="346.67" ry="274.22" fill="#1C79C9" />
      <g className="fondo-auth-hexagonos">
        <path d="M926.225 860.577V1029.42L780 1113.84L633.775 1029.42V860.577L780 776.154L926.225 860.577Z" stroke="white" strokeOpacity="0.16" strokeWidth="2" />
        <path d="M869.933 893.077V996.922L780 1048.84L690.067 996.922V893.077L780 841.154L869.933 893.077Z" stroke="white" strokeOpacity="0.1" strokeWidth="2" />
      </g>
      <path opacity="0.96" d="M1042.89 -31.6406H1921.33V828.984L1340.67 1080L849.333 637.734L1042.89 -31.6406Z" fill="#F4F7FB" />
      <path
        className="fondo-auth-onda-superior"
        d="M0 200.391C346.667 73.8281 573.333 179.297 866.667 84.375C1160 -10.5469 1346.67 31.6406 1493.33 -21.0938"
        stroke="#ED0038"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        className="fondo-auth-onda-inferior"
        d="M0 938.672C280 801.563 440 833.203 666.667 980.859C893.333 1128.52 1038.67 1141.17 1265.33 1014.61"
        stroke="#ED0038"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <g opacity="0.55">
        {PUNTOS.map((p) => (
          <circle key={`${p.x}-${p.y}`} className={p.par ? 'fondo-auth-punto' : 'fondo-auth-punto-tenue'} cx={p.x} cy={p.y} r="4" fill="white" />
        ))}
      </g>
      <rect className="fondo-auth-linea" x="1564" y="981.914" width="356" height="6.328" rx="3.164" fill="#ED0038" />
    </svg>
  );
}
