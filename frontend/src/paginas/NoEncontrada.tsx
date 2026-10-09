import { Link } from 'react-router';

export function NoEncontrada() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-white px-6 py-16 text-center shadow-tarjeta">
      <p className="text-display font-extrabold text-rojo">404</p>
      <h1 className="text-subtitle font-bold text-azul-titulo">No encontramos esta página</h1>
      <Link to="/inicio" className="font-semibold text-rojo underline">
        Ir al inicio
      </Link>
    </div>
  );
}
