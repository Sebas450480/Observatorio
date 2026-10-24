// "Sitio para computadores" en el celular: el navegador deja de indicar que es un celular
// (su identificador ya no dice "Mobile") y dibuja la página a unos 980 px, que en la
// plataforma es el diseño de tablet. En ese caso se fija el ancho del diseño de computador
// (1920 px, el del Figma) para que se vea igual que en un PC.
(function () {
  try {
    var corto = Math.min(screen.width, screen.height);
    var tactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var pideEscritorio = !/Mobi|Android.+Mobile|iPhone|iPod/i.test(navigator.userAgent);
    var ancho = document.documentElement.clientWidth || window.innerWidth;
    if (tactil && corto < 768 && pideEscritorio && ancho >= 900) {
      var meta = document.querySelector('meta[name="viewport"]');
      if (meta) meta.setAttribute('content', 'width=1920');
    }
  } catch {
    /* sin cambios */
  }
})();
