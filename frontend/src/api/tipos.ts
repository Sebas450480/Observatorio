/** Tipos de los datos que entrega el backend (ver backend/docs/openapi.yaml). */

export type Estado = 'Activo' | 'Inactivo';
export type Modalidad = 'Virtual' | 'Presencial' | 'Hibrido';
export type TipoEvento = 'Congreso' | 'Hackathon' | 'Foro' | 'Cumbre' | 'Seminario' | 'Taller' | 'Otro';
export type TipoFaro = 'Becas' | 'Convocatorias' | 'Cursos' | 'Talleres';
export type TamanoEmpresa = 'Micro' | 'Pequeña' | 'Mediana' | 'Grande';
export type FrecuenciaAlertas = 'Inmediata' | 'Semanal' | 'Ninguna';
export type TipoContenido = 'Flash' | 'Faro' | 'Empresa' | 'Tendencia' | 'Evento';

export const MODALIDADES: Modalidad[] = ['Virtual', 'Presencial', 'Hibrido'];
export const TIPOS_EVENTO: TipoEvento[] = ['Congreso', 'Hackathon', 'Foro', 'Cumbre', 'Seminario', 'Taller', 'Otro'];
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
  fecha_registro: string;
  estado_usuario: Estado;
  id_rol: number;
  nombre_rol: string;
  intereses: CategoriaRef[];
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
