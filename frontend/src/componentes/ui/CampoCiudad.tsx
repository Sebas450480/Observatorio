import { forwardRef, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ComponentProps, type KeyboardEvent } from 'react';
import { Entrada } from './Campos';

/** Ciudades del mundo por país y estado/departamento (datos de country-state-city 3.2.1, basados en GeoNames). */
type Datos = Record<string, Record<string, string[]>>;
interface Ciudad {
  nombre: string;
  region: string;
  pais: string;
  colombia: boolean;
  clave: string;
}

const MAXIMO = 60;
const RESULTADOS = 50;
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let carga: Promise<Ciudad[]> | null = null;
/** Se descarga una sola vez y solo cuando alguien abre el campo. */
function cargarCiudades() {
  carga ??= fetch('/datos/ciudades.json')
    .then((r) => {
      if (!r.ok) throw new Error('No se pudo cargar la lista de ciudades');
      return r.json() as Promise<Datos>;
    })
    .then((datos) => {
      const paises = new Intl.DisplayNames(['es'], { type: 'region' });
      const lista: Ciudad[] = [];
      for (const [codigo, regiones] of Object.entries(datos)) {
        let pais = codigo;
        try {
          pais = paises.of(codigo) ?? codigo;
        } catch {
          /* código sin nombre conocido */
        }
        for (const [region, ciudades] of Object.entries(regiones)) {
          for (const nombre of ciudades) {
            lista.push({ nombre, region, pais, colombia: codigo === 'CO', clave: normalizar(`${nombre} ${region} ${pais}`) });
          }
        }
      }
      return lista;
    })
    .catch((e) => {
      carga = null;
      throw e;
    });
  return carga;
}

/** Lo que se guarda: "Ciudad, País" (o solo la ciudad si no cabe en 60 caracteres). */
const valorDe = (c: Ciudad) => {
  const completo = `${c.nombre}, ${c.pais}`;
  return completo.length <= MAXIMO ? completo : c.nombre.slice(0, MAXIMO);
};

function buscar(ciudades: Ciudad[], texto: string) {
  const consulta = normalizar(texto.replace(/,/g, ' '));
  if (!consulta) return ciudades.filter((c) => c.colombia).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).slice(0, RESULTADOS);
  const palabras = consulta.split(/\s+/);
  const encontradas: { c: Ciudad; puntos: number }[] = [];
  for (const c of ciudades) {
    if (!palabras.every((p) => c.clave.includes(p))) continue;
    const nombre = normalizar(c.nombre);
    const puntos = (nombre === palabras[0] ? 0 : nombre.startsWith(palabras[0]!) ? 1 : 2) * 2 + (c.colombia ? 0 : 1);
    encontradas.push({ c, puntos });
  }
  return encontradas
    .sort((a, b) => a.puntos - b.puntos || a.c.nombre.length - b.c.nombre.length || a.c.nombre.localeCompare(b.c.nombre, 'es'))
    .slice(0, RESULTADOS)
    .map((e) => e.c);
}

type Props = Omit<ComponentProps<typeof Entrada>, 'ref'>;

/** Campo de ciudad con buscador: al escribir sugiere ciudades de todo el mundo (Colombia primero). Admite texto libre. */
export const CampoCiudad = forwardRef<HTMLInputElement, Props>(function CampoCiudad({ onChange, onBlur, onKeyDown, onFocus, ...resto }, ref) {
  const entrada = useRef<HTMLInputElement | null>(null);
  const idLista = useId();
  const [ciudades, setCiudades] = useState<Ciudad[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [activo, setActivo] = useState(0);
  const consulta = useDeferredValue(texto);
  const resultados = useMemo(() => (ciudades && abierto ? buscar(ciudades, consulta) : []), [ciudades, abierto, consulta]);

  useEffect(() => setActivo(0), [consulta]);

  const abrir = () => {
    setTexto(entrada.current?.value ?? '');
    setAbierto(true);
    if (!ciudades) {
      setFallo(false);
      cargarCiudades().then(setCiudades, () => setFallo(true));
    }
  };

  const elegir = (c: Ciudad) => {
    const campo = entrada.current;
    if (!campo) return;
    campo.value = valorDe(c);
    setTexto(campo.value);
    onChange?.({ target: campo, currentTarget: campo, type: 'change' } as ChangeEvent<HTMLInputElement>);
    setAbierto(false);
  };

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) return abrir();
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      setActivo((a) => Math.min(Math.max(a + paso, 0), Math.max(resultados.length - 1, 0)));
    } else if (e.key === 'Enter' && abierto && resultados[activo]) {
      e.preventDefault();
      elegir(resultados[activo]);
    } else if (e.key === 'Escape' && abierto) {
      e.preventDefault();
      setAbierto(false);
    }
  };

  useEffect(() => {
    if (!abierto) return;
    document.getElementById(`${idLista}-${activo}`)?.scrollIntoView({ block: 'nearest' });
  }, [abierto, activo, idLista]);

  return (
    <div className={`relative ${resto.className ?? ''}`}>
      <Entrada
        {...resto}
        className=""
        ref={(nodo) => {
          entrada.current = nodo;
          if (typeof ref === 'function') ref(nodo);
          else if (ref) ref.current = nodo;
        }}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={abierto && resultados[activo] ? `${idLista}-${activo}` : undefined}
        autoComplete="off"
        maxLength={MAXIMO}
        onFocus={(e) => {
          onFocus?.(e);
          abrir();
        }}
        onChange={(e) => {
          onChange?.(e);
          setTexto(e.target.value);
          if (!abierto) abrir();
        }}
        onBlur={(e) => {
          onBlur?.(e);
          setAbierto(false);
        }}
        onKeyDown={teclas}
      />
      {abierto && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-control border border-[#d1d9e3] bg-white py-1 shadow-lg"
        >
          {fallo ? (
            <li className="px-3.5 py-2.5 text-small text-rojo">No se pudo cargar la lista. Puedes escribir tu ciudad.</li>
          ) : !ciudades ? (
            <li className="px-3.5 py-2.5 text-small text-texto-suave">Cargando ciudades…</li>
          ) : resultados.length === 0 ? (
            <li className="px-3.5 py-2.5 text-small text-texto-suave">Sin coincidencias. Puedes dejarla escrita así.</li>
          ) : (
            resultados.map((c, i) => (
              <li
                key={`${c.nombre}|${c.region}|${c.pais}`}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={i === activo}
                // mousedown para elegir antes de que el campo pierda el foco
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(c);
                }}
                onMouseEnter={() => setActivo(i)}
                className={`cursor-pointer px-3.5 py-2 ${i === activo ? 'bg-fondo' : ''}`}
              >
                <span className="block text-small font-semibold text-azul-marino">{c.nombre}</span>
                <span className="block text-caption text-texto-suave">{[c.region, c.pais].filter(Boolean).join(', ')}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
});
