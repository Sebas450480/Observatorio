import { z } from 'zod';
import { conRol } from '../db/contexto.js';
import { crearRecurso } from './recurso.js';
import { cargaRecurso } from '../servicios/cargaMasiva.js';
import { ESTADOS, normalizarNombre, textoObligatorio, textoOpcional } from '../utilidades/esquemas.js';

/**
 * Glosario: términos y conceptos clave del Observatorio. Lo administran el Super Admin,
 * el Gestor Observatorio y las cuentas con el rol delegado "Gestor Glosario".
 */
const esquema = z.object({
  termino: textoObligatorio(120),
  definicion: textoObligatorio(5000),
  fuente: textoOpcional(300),
  estado_gt: z.enum(ESTADOS).optional(),
});

const esquemaFiltros = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  /** Inicial del término (A-Z o Ñ); los que empiezan por número o símbolo, con "#". */
  letra: z.string().regex(/^([A-ZÑ]|#)$/i, 'Letra inválida').optional(),
});

/** Clave para no repetir términos: sin tildes, mayúsculas ni puntuación final (igual que el índice único). */
const claveTermino = (termino: string) => normalizarNombre(termino.replace(/[\s:.]+$/, ''));

/** Inicial sin tilde, en mayúscula ("Ética" -> "E"). */
const INICIAL = `upper(left(translate(trim(t.termino), 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'), 1))`;

export const rutasGlosario = crearRecurso({
  nombre: 'glosario',
  titulo: 'Glosario',
  tabla: 'glosario_termino',
  id: 'id_termino',
  rolGestor: 'obs_gestor_glosario',
  columnaEstado: 'estado_gt',
  esquema,
  esquemaFiltros,
  aplicarFiltros: (f, v) => {
    if (v.q) f.texto(['t.termino', 't.definicion'], v.q as string);
    if (v.letra === '#') f.y(`${INICIAL} !~ '^[A-ZÑ]'`);
    else if (v.letra) f.y(`${INICIAL} = ${f.param((v.letra as string).toUpperCase())}`);
  },
  ordenes: { termino: 'lower(t.termino)', creacion: 't.fecha_creacion', id: 't.id_termino' },
  ordenDefecto: 'termino',
  cargaMasiva: cargaRecurso({
    archivo: 'plantilla-glosario',
    hoja: 'Glosario',
    columnas: [
      { clave: 'termino', titulo: 'Término', obligatoria: true, ayuda: 'Palabra o concepto (máx. 120 caracteres), sin dos puntos al final.', ejemplo: 'Empresa coformadora', ancho: 30 },
      { clave: 'definicion', titulo: 'Definición', obligatoria: true, ayuda: 'Qué significa.', ejemplo: 'Empresa que recibe estudiantes en el modelo de formación dual.', ancho: 70 },
      { clave: 'fuente', titulo: 'Fuente', ayuda: 'Referencia o autor de la definición (máx. 300 caracteres).', ejemplo: 'Política de investigación Uniempresarial', ancho: 30 },
      { clave: 'estado_gt', titulo: 'Estado', tipo: 'lista', opciones: ESTADOS, ayuda: 'Activo se publica de inmediato; Inactivo queda oculto. Por defecto, Activo.', ejemplo: 'Activo' },
    ],
    // "Autor:" -> "Autor" (los términos del Excel de la carpeta traen dos puntos al final).
    armar: (f) => ({ ...f, termino: typeof f.termino === 'string' ? f.termino.replace(/\s*:\s*$/, '') : f.termino }),
    esquema,
    resumen: (d) => d.termino,
    clave: (d) => claveTermino(d.termino),
    mensajeRepetido: 'Término repetido en el archivo',
    revisar: async (c, filas) => {
      const { rows } = await c.query<{ termino: string }>('select termino from glosario_termino');
      const existentes = new Set(rows.map((r) => claveTermino(r.termino)));
      return filas
        .filter((f) => existentes.has(claveTermino(f.datos.termino)))
        .map((f) => ({ fila: f.fila, columna: 'Término', mensaje: 'El término ya existe en el glosario' }));
    },
  }),
  columnasExportar: [
    { campo: 'id_termino', titulo: 'ID', ancho: 0.4 },
    { campo: 'termino', titulo: 'Término', ancho: 1.2 },
    { campo: 'definicion', titulo: 'Definición', ancho: 3 },
    { campo: 'fuente', titulo: 'Fuente', ancho: 1.2 },
    { campo: 'estado_gt', titulo: 'Estado', ancho: 0.6 },
  ],
  rutasExtra: (router) => {
    // Letras que tienen términos (para el índice A-Z), según lo que cada perfil puede ver.
    router.get('/letras', async (req, res) => {
      const { rows } = await conRol(req.sesion, (c) =>
        c.query<{ letra: string }>(
          `select distinct case when ${INICIAL} ~ '^[A-ZÑ]' then ${INICIAL} else '#' end as letra
             from glosario_termino t order by 1`,
        ));
      res.json(rows.map((r) => r.letra));
    });
  },
});
