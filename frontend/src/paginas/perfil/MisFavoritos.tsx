import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import { useFavoritos } from '../../api/favoritos';
import type { CategoriaRef, Favorito, TipoContenido } from '../../api/tipos';
import { BotonFavorito, IconoBanderita } from '../../componentes/contenido/BotonFavorito';
import { Cargando, MensajeError } from '../../componentes/ui/Elementos';
import { fechaCorta } from '../../utilidades/formato';
import { EncabezadoTarjeta, TARJETA } from './TarjetaPerfil';

/** Nombre y página de cada módulo. */
const MODULOS: Record<TipoContenido, { nombre: string; ruta: (id: number) => string }> = {
  Flash: { nombre: 'Flash', ruta: (id) => `/flash-informativo/${id}` },
  Faro: { nombre: 'Faro Empresarial', ruta: (id) => `/faro-empresarial/${id}` },
  Empresa: { nombre: 'Empresas', ruta: (id) => `/empresas/${id}` },
  Tendencia: { nombre: 'Tendencias', ruta: (id) => `/tendencias/${id}` },
  Evento: { nombre: 'Eventos', ruta: (id) => `/eventos/${id}` },
};

const TODOS = 'todos';
const INTERESES = 'intereses';

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`h-9 cursor-pointer whitespace-nowrap rounded-full border px-4 text-small font-semibold transition-colors ${
        activo ? 'border-azul-marino bg-azul-marino text-white' : 'border-[#d1d9e3] bg-white text-azul-marino hover:bg-fondo'
      }`}
    >
      {children}
    </button>
  );
}

function FilaFavorito({ favorito, intereses }: { favorito: Favorito; intereses: Set<number> }) {
  const modulo = MODULOS[favorito.tipo_contenido];
  return (
    <li className="flex items-start gap-3 rounded-xl border border-[#e5ebf2] p-4 sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-azul-marino/10 px-2 py-0.5 text-caption font-bold uppercase text-azul-marino">{modulo.nombre}</span>
          {favorito.en_intereses && (
            <span className="rounded bg-[#fdf5e1] px-2 py-0.5 text-caption font-semibold text-[#7a5a00]">En tus intereses</span>
          )}
        </div>
        <Link to={modulo.ruta(favorito.id_contenido)} className="text-body font-bold text-azul-marino hover:underline">
          {favorito.titulo}
        </Link>
        {(favorito.detalle || favorito.fecha) && (
          <p className="text-small text-gris-azulado">{[favorito.detalle, favorito.fecha && fechaCorta(favorito.fecha)].filter(Boolean).join(' · ')}</p>
        )}
        {favorito.categorias.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Categorías">
            {favorito.categorias.map((c) => (
              <li
                key={c.id_categoria}
                className={`rounded px-2 py-[3px] text-caption font-medium ${intereses.has(c.id_categoria) ? 'bg-[#fdf5e1] text-[#7a5a00]' : 'bg-etiqueta text-texto'}`}
              >
                {c.nombre}
              </li>
            ))}
          </ul>
        )}
      </div>
      <BotonFavorito tipo={favorito.tipo_contenido} id={favorito.id_contenido} titulo={favorito.titulo} />
    </li>
  );
}

/**
 * Mis favoritos (Mi perfil): lo que el usuario guardó con la banderita, por módulo
 * y por sus intereses (las categorías que marcó en "Mis intereses").
 */
export function MisFavoritos({ intereses }: { intereses: CategoriaRef[] }) {
  const { data: favoritos, isLoading, error, refetch } = useFavoritos();
  const [modulo, setModulo] = useState<TipoContenido | typeof TODOS>(TODOS);
  const [tema, setTema] = useState<number | typeof TODOS | typeof INTERESES>(TODOS);
  const idsIntereses = new Set(intereses.map((i) => i.id_categoria));

  const lista = favoritos ?? [];
  const delModulo = lista.filter((f) => modulo === TODOS || f.tipo_contenido === modulo);
  const visibles = delModulo.filter((f) =>
    tema === TODOS ? true : tema === INTERESES ? f.en_intereses : f.categorias.some((c) => c.id_categoria === tema));
  const contar = (tipo: TipoContenido) => lista.filter((f) => f.tipo_contenido === tipo).length;
  const contarTema = (id: number) => delModulo.filter((f) => f.categorias.some((c) => c.id_categoria === id)).length;

  return (
    <section className={TARJETA} aria-labelledby="titulo-favoritos">
      <div id="titulo-favoritos">
        <EncabezadoTarjeta titulo="Mis favoritos" detalle="Lo que guardaste con la banderita en Flash, Faro Empresarial, Empresas, Tendencias y Eventos." />
      </div>

      {isLoading ? (
        <Cargando />
      ) : error ? (
        <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : !lista.length ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-fondo px-6 py-10 text-center">
          <span className="text-gris-azulado">
            <IconoBanderita marcado={false} tamano={28} />
          </span>
          <p className="text-body font-semibold text-azul-marino">Aún no tienes favoritos</p>
          <p className="text-small text-gris-azulado">Toca la banderita de cualquier tarjeta para guardarla aquí.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por módulo">
              <Chip activo={modulo === TODOS} onClick={() => setModulo(TODOS)}>
                Todos ({lista.length})
              </Chip>
              {(Object.keys(MODULOS) as TipoContenido[])
                .filter((t) => contar(t) > 0)
                .map((t) => (
                  <Chip key={t} activo={modulo === t} onClick={() => setModulo(t)}>
                    {MODULOS[t].nombre} ({contar(t)})
                  </Chip>
                ))}
            </div>
            {intereses.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por intereses">
                <Chip activo={tema === TODOS} onClick={() => setTema(TODOS)}>
                  Todos los temas
                </Chip>
                <Chip activo={tema === INTERESES} onClick={() => setTema(INTERESES)}>
                  Solo mis intereses ({delModulo.filter((f) => f.en_intereses).length})
                </Chip>
                {intereses
                  .filter((i) => contarTema(i.id_categoria) > 0)
                  .map((i) => (
                    <Chip key={i.id_categoria} activo={tema === i.id_categoria} onClick={() => setTema(i.id_categoria)}>
                      {i.nombre} ({contarTema(i.id_categoria)})
                    </Chip>
                  ))}
              </div>
            )}
          </div>
          {visibles.length ? (
            <ul className="flex flex-col gap-3">
              {visibles.map((f) => (
                <FilaFavorito key={`${f.tipo_contenido}:${f.id_contenido}`} favorito={f} intereses={idsIntereses} />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-fondo px-4 py-6 text-center text-small text-gris-azulado">No hay favoritos con este filtro.</p>
          )}
        </>
      )}
    </section>
  );
}
