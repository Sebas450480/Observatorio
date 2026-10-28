/** Tipos de los datos que entrega el backend (ver backend/docs/openapi.yaml). */

export type Estado = 'Activo' | 'Inactivo';
export type Modalidad = 'Virtual' | 'Presencial' | 'Hibrido';
export type TipoEvento = 'Congreso' | 'Hackathon' | 'Foro' | 'Cumbre' | 'Seminario' | 'Taller' | 'Feria' | 'Otro';
export type TipoFaro = 'Becas' | 'Convocatorias' | 'Cursos' | 'Talleres';
export type TamanoEmpresa = 'Micro' | 'Pequeña' | 'Mediana' | 'Grande';
export type FrecuenciaAlertas = 'Diaria' | 'Cada2Dias' | 'Semanal' | 'Ninguna';
export type TipoContenido = 'Flash' | 'Faro' | 'Empresa' | 'Tendencia' | 'Evento';

export const MODALIDADES: Modalidad[] = ['Virtual', 'Presencial', 'Hibrido'];
export const TIPOS_EVENTO: TipoEvento[] = ['Congreso', 'Hackathon', 'Foro', 'Cumbre', 'Seminario', 'Taller', 'Feria', 'Otro'];
export const TIPOS_FARO: TipoFaro[] = ['Becas', 'Convocatorias', 'Cursos', 'Talleres'];
export const TAMANOS: TamanoEmpresa[] = ['Micro', 'Pequeña', 'Mediana', 'Grande'];
export const ESTADOS: Estado[] = ['Activo', 'Inactivo'];

export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
}

export interface CategoriaRef {
  id_categoria: number;
  nombre: string;
}

export interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
}

export interface Rol {
  id_rol: number;
  nombre_rol: string;
  descripcion_rol: string | null;
  permisos: string | null;
}

export interface Perfil {
  id_usuario: number;
  apodo_usuario: string | null;
  nombre_usuario: string;
  apellido_usuario: string;
  correo: string;
  ciudad: string | null;
  frecuencia_alertas: FrecuenciaAlertas;
  /** Recordatorios de los eventos favoritos (una semana antes y el mismo día). */
  recordatorios_eventos: boolean;
  fecha_registro: string;
  estado_usuario: Estado;
  /** Rol principal (el de más alcance). */
  id_rol: number;
  nombre_rol: string;
  /** Todos los roles de la cuenta (una cuenta puede tener varios). */
  roles: RolRef[];
  /** Cuentas con varios roles: rol con el que entró y actúa (null si tiene un solo rol). */
  rol_activo?: string | null;
  /** Intereses de Faro (categorías). */
  intereses: CategoriaRef[];
  /** Intereses de los demás módulos: tipos de evento, sectores y megatendencias (máx. 5 cada uno). */
  preferencias?: Partial<Preferencias>;
}

/** Módulos con intereses guardados por valor (Faro usa categorías). */
export type ModuloPreferencia = 'Flash' | 'Empresa' | 'Tendencia';
export type Preferencias = Record<ModuloPreferencia, string[]>;

export interface RolRef {
  id_rol: number;
  nombre_rol: string;
}

interface Auditoria {
  creado_por?: number | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface Flash extends Auditoria {
  id_fi: number;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  modalidad: Modalidad;
  costo: number | null;
  es_gratuito: boolean;
  lugar: string | null;
  link: string | null;
  imagen: string | null;
  info_adicional: string | null;
  tipo_evento: TipoEvento;
  /** Nombre del tipo cuando tipo_evento es "Otro". */
  tipo_otro?: string | null;
  departamento: string | null;
  estado_fi?: Estado;
  categorias: CategoriaRef[];
}

export interface Faro extends Auditoria {
  id_fe: number;
  titulo: string;
  descripcion: string | null;
  tipo: TipoFaro;
  fecha_publicacion: string;
  fecha_inicio: string | null;
  fecha_cierre: string | null;
  entidad: string | null;
  dirigida_a: string | null;
  imagen: string | null;
  link: string | null;
  modalidad: Modalidad | null;
  lugar: string | null;
  costo: number | null;
  es_gratuito: boolean;
  duracion: string | null;
  estado_fe?: Estado;
  categorias: CategoriaRef[];
}

export interface Contacto {
  id_contacto: number;
  id_ec: number;
  nombre: string;
  cargo: string | null;
  correo: string | null;
  telefono: string | null;
  es_principal: boolean;
}

export interface Empresa extends Auditoria {
  id_ec: number;
  nit: string;
  razon_social: string;
  nombre_comercial: string | null;
  descripcion: string | null;
  sector_economico: string;
  tamano_empresa: TamanoEmpresa | null;
  tiempo_coformadora: string | null;
  link: string | null;
  estudiantes_recibidos: number;
  premios_recibidos: number;
  codigo_ciiu: string | null;
  naturaleza_juridica: string | null;
  departamento: string;
  municipio: string;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  anio_constitucion: number | null;
  logo_ec: string | null;
  imagen_portada: string | null;
  estado_ec?: Estado;
  /** La empresa aún no acepta la invitación ni completa su ficha: no se publica. */
  ficha_pendiente?: boolean;
  id_usuario?: number | null;
  contactos: Contacto[];
}

export interface Fuente {
  id_fuente?: number;
  nombre: string;
  link: string | null;
}

export interface Tendencia extends Auditoria {
  id_te: number;
  megatendencia: string;
  tendencia: string;
  descripcion: string | null;
  comportamiento_mundo: string | null;
  comportamiento_colombia: string | null;
  fecha_publicacion: string;
  estado_te?: Estado;
  categorias: CategoriaRef[];
  fuentes: Fuente[];
  menciones: number;
}

export interface Evento extends Auditoria {
  id_evento: number;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  modalidad: Modalidad;
  lugar: string | null;
  link_externo: string | null;
  tipo_evento: TipoEvento;
  /** Nombre del tipo cuando tipo_evento es "Otro". */
  tipo_otro?: string | null;
  costo: number | null;
  es_gratuito: boolean;
}

export interface MapaTendencias {
  periodo: 'semana' | 'mes' | 'anio' | 'total';
  megatendencias: { megatendencia: string; tendencias: number; menciones: number }[];
  tendencias: { id_te: number; megatendencia: string; tendencia: string; menciones: number }[];
}

export interface TendenciaCrecimiento {
  id_te: number;
  megatendencia: string;
  tendencia: string;
  menciones_actual: number;
  menciones_anterior: number;
  crecimiento: number;
  crecimiento_pct: number | null;
}

export interface Favorito {
  tipo_contenido: TipoContenido;
  id_contenido: number;
  fecha_guardado: string;
  titulo: string;
  detalle: string | null;
  fecha: string | null;
  imagen: string | null;
  categorias: CategoriaRef[];
  /** Alguna de sus categorías está entre los intereses del perfil. */
  en_intereses: boolean;
}

export interface ResultadoBusqueda {
  tipo: TipoContenido;
  id: number;
  titulo: string;
  detalle: string | null;
  fecha: string | null;
}

export interface Panel {
  usuarios: { total: number; nuevos_mes: number; variacion_pct: number | null };
  contenidos: { total: number; flash: number; faro: number; eventos: number; tendencias: number; variacion_pct: number | null };
  visitas: { mes: number; clics_acceder_mes: number; variacion_pct: number | null };
  suscriptores: { total: number; tasa_apertura_pct: number | null; variacion_pct: number | null };
}
