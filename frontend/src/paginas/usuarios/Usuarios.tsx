import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { mensajeDeError } from '../../api/cliente';
import iconoBuscar from '../../assets/figma/usuarios/buscar-tabla.svg';
import iconoLapiz from '../../assets/figma/usuarios/lapiz.png';
import { useEliminar, useGuardar, useListado, useRoles } from '../../api/consultas';
import type { Perfil } from '../../api/tipos';
import { BarraFiltros, contarActivos } from '../../componentes/contenido/Controles';
import { FormularioCrud } from '../../componentes/contenido/FormularioCrud';
import { Boton } from '../../componentes/ui/Boton';
import { Casilla, Entrada, Filtro, Selector } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, MensajeError, Paginacion } from '../../componentes/ui/Elementos';
import { BotonOrden, ariaOrden, consultaOrden, type Orden } from '../../componentes/ui/Orden';
import { SUPER_ADMIN, descripcionRol, descripcionRoles, mismoRol, rolesDe, useSesion } from '../../sesion/sesion';

const esSuperAdminDe = (perfil?: Pick<Perfil, 'nombre_rol' | 'roles'> | null) => rolesDe(perfil).some((r) => mismoRol(r, SUPER_ADMIN));

const base = {
  nombre_usuario: z.string().trim().min(1, 'Escribe el nombre').max(50),
  apellido_usuario: z.string().trim().min(1, 'Escribe el apellido').max(50),
  apodo_usuario: z.string().trim().max(20),
  ciudad: z.string().trim().max(60),
  roles: z.array(z.string()).min(1, 'Elige al menos un rol'),
};
const esquemaCrear = z.object({
  ...base,
  correo: z.email('Escribe un correo válido'),
  contrasena: z.string().min(8, 'Mínimo 8 caracteres').max(72),
  acepta: z.literal(true, { message: 'Confirma la autorización de tratamiento de datos' }),
});
const esquemaEditar = z.object({ ...base, estado_usuario: z.enum(['Activo', 'Inactivo']) });
type DatosCrear = z.infer<typeof esquemaCrear>;
type DatosEditar = z.infer<typeof esquemaEditar>;

function FormularioUsuario({ registro, onCerrar }: { registro?: Perfil; onCerrar: () => void }) {
  const { usuario: yo, roles: misRoles } = useSesion();
  const { data: roles = [] } = useRoles();
  const guardarApi = useGuardar<Perfil>('/usuarios');
  const eliminarApi = useEliminar('/usuarios');
  const editar = !!registro;
  // Solo un Super Admin asigna ese rol o cambia los roles y el estado de quien lo tiene.
  const soySuperior = misRoles.some((r) => mismoRol(r, SUPER_ADMIN));
  const protegido = !soySuperior && esSuperAdminDe(registro);
  const propio = registro?.id_usuario === yo?.id_usuario;
  const bloqueado = propio || protegido;
  const rolesVisibles = roles.filter((r) => soySuperior || !mismoRol(r.nombre_rol, SUPER_ADMIN) || registro?.roles?.some((x) => x.id_rol === r.id_rol));
  const { register, trigger, getValues, formState } = useForm<DatosCrear & DatosEditar>({
    resolver: zodResolver(editar ? esquemaEditar : esquemaCrear) as never,
    defaultValues: {
      nombre_usuario: registro?.nombre_usuario ?? '',
      apellido_usuario: registro?.apellido_usuario ?? '',
      apodo_usuario: registro?.apodo_usuario ?? '',
      ciudad: registro?.ciudad ?? '',
      roles: registro ? (registro.roles?.length ? registro.roles.map((r) => String(r.id_rol)) : [String(registro.id_rol)]) : [],
      estado_usuario: registro?.estado_usuario ?? 'Activo',
      correo: '',
      contrasena: '',
    },
  });
  const e = formState.errors;

  const guardar = async () => {
    const d = getValues();
    const comunes = {
      nombre_usuario: d.nombre_usuario,
      apellido_usuario: d.apellido_usuario,
      apodo_usuario: d.apodo_usuario,
      ciudad: d.ciudad,
    };
    if (editar) {
      await guardarApi.mutateAsync({
        id: registro.id_usuario,
        datos: bloqueado ? comunes : { ...comunes, roles: d.roles.map(Number), estado_usuario: d.estado_usuario },
      });
    } else {
      await guardarApi.mutateAsync({
        datos: { ...comunes, roles: d.roles.map(Number), correo: d.correo, contrasena: d.contrasena, acepta_tratamiento_datos: true },
      });
    }
  };

  return (
    <FormularioCrud
      abierto
      modo={editar ? 'editar' : 'crear'}
      titulo={editar ? 'Editar usuario' : 'Crear usuario'}
      sustantivo={{ palabra: 'usuario', demostrativo: 'este' }}
      validar={() => trigger()}
      guardar={guardar}
      eliminar={editar && !bloqueado ? () => eliminarApi.mutateAsync(registro.id_usuario) : undefined}
      onCerrar={onCerrar}
    >
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <Entrada etiqueta="Nombre" placeholder="Ingresa el nombre" obligatorio error={e.nombre_usuario?.message} {...register('nombre_usuario')} />
        <Entrada etiqueta="Apellido" placeholder="Ingresa el apellido" obligatorio error={e.apellido_usuario?.message} {...register('apellido_usuario')} />
        <Entrada etiqueta="Apodo" placeholder="Ingresa el apodo" {...register('apodo_usuario')} />
        {editar ? (
          <Entrada etiqueta="Correo" value={registro.correo} readOnly disabled />
        ) : (
          <Entrada etiqueta="Correo" type="email" placeholder="correo@ejemplo.com" obligatorio autoComplete="off" error={e.correo?.message} {...register('correo')} />
        )}
        {editar ? (
          <Selector etiqueta="Estado" disabled={bloqueado} opciones={[{ valor: 'Activo', texto: 'Activo' }, { valor: 'Inactivo', texto: 'Inactivo (bloqueado)' }]} {...register('estado_usuario')} />
        ) : (
          <Selector etiqueta="Estado" disabled opciones={[{ valor: 'Activo', texto: 'Activo' }]} value="Activo" onChange={() => {}} />
        )}
        <Entrada etiqueta="Ciudad" placeholder="Ej. Bogotá" {...register('ciudad')} />
        {!editar && (
          <Entrada etiqueta="Contraseña inicial" type="password" placeholder="Mínimo 8 caracteres" obligatorio autoComplete="new-password" error={e.contrasena?.message} {...register('contrasena')} />
        )}
      </div>
      <fieldset className="flex flex-col gap-3" disabled={bloqueado}>
        <legend className="mb-2 text-small font-semibold text-[#0a1c40]">
          Roles <span aria-hidden>*</span>
          <span className="block text-[13px] font-normal text-texto-suave">Una misma cuenta puede tener varios roles; cada uno suma sus permisos.</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {rolesVisibles.map((r) => (
            <Casilla key={r.id_rol} etiqueta={descripcionRol(r.nombre_rol)} value={String(r.id_rol)} {...register('roles')} />
          ))}
        </div>
        {e.roles?.message && (
          <p role="alert" className="text-[13px] text-rojo">
            {e.roles.message}
          </p>
        )}
      </fieldset>
      {propio && <p className="text-[13px] text-texto-suave">No puedes cambiar tus propios roles ni tu estado.</p>}
      {protegido && <p className="text-[13px] text-texto-suave">Es un Super Admin: solo otro Super Admin puede cambiarle los roles o el estado.</p>}
      {!editar && (
        <Casilla
          etiqueta="La persona autorizó el tratamiento de sus datos personales (Ley 1581 de 2012)."
          error={e.acepta?.message}
          {...register('acepta')}
        />
      )}
    </FormularioCrud>
  );
}

/** Columnas de la tabla; `orden` es el nombre del orden en la API. */
const COLUMNAS: { titulo: string; orden?: string }[] = [
  { titulo: 'ID', orden: 'id' },
  { titulo: 'Apodo', orden: 'apodo' },
  { titulo: 'Nombre', orden: 'nombre' },
  { titulo: 'Apellido', orden: 'apellido' },
  { titulo: 'Correo', orden: 'correo' },
  { titulo: 'Estado', orden: 'estado' },
  { titulo: 'Rol', orden: 'rol' },
  { titulo: 'Acciones' },
];

/** Gestión de usuarios (Super Admin y Gestor Observatorio). */
const FILTROS_INICIALES = { q: '', id_rol: '', estado: '' };

export function Usuarios() {
  const { data: roles = [] } = useRoles();
  const [borrador, setBorrador] = useState(FILTROS_INICIALES);
  const [filtros, setFiltros] = useState(borrador);
  const [pagina, setPagina] = useState(1);
  const [formulario, setFormulario] = useState<{ registro?: Perfil } | null>(null);
  const [orden, setOrden] = useState<Orden>(null);
  const { data, isLoading, error, refetch } = useListado<Perfil>('/usuarios', {
    ...consultaOrden(orden),
    q: filtros.q || undefined,
    id_rol: filtros.id_rol || undefined,
    estado: filtros.estado || undefined,
    pagina,
    limite: 15,
  });

  const buscar = () => {
    setFiltros(borrador);
    setPagina(1);
  };

  return (
    <>
      <EncabezadoPagina
        modulo="usuarios"
        titulo="Usuarios"
        subtitulo="Usuarios registrados en la plataforma"
        claseSubtitulo="text-body font-bold tracking-[-0.5px] text-[#0d2375] sm:text-subtitle"
        className="mb-6 xl:mb-[25px]"
      />
      <BarraFiltros
        activos={contarActivos(filtros, FILTROS_INICIALES, ['q'])}
        onBuscar={buscar}
        onLimpiar={() => {
          setBorrador(FILTROS_INICIALES);
          setFiltros(FILTROS_INICIALES);
          setPagina(1);
        }}
        busqueda={
          <form
            className="contents"
            onSubmit={(ev) => {
              ev.preventDefault();
              buscar();
            }}
          >
            <label className="flex h-[42px] w-full items-center gap-2.5 rounded-control border border-borde bg-white px-4 focus-within:border-azul-oscuro sm:w-[380px]">
              <img src={iconoBuscar} alt="" aria-hidden className="size-[18px]" />
              <input
                type="search"
                aria-label="Buscar usuarios"
                placeholder="Buscar por nombre, apodo o correo"
                className="min-w-0 flex-1 bg-transparent text-small text-texto placeholder:text-[#788fad] focus:outline-none"
                value={borrador.q}
                onChange={(ev) => setBorrador({ ...borrador, q: ev.target.value })}
              />
            </label>
          </form>
        }
        acciones={
          <Boton pildora className="px-5! font-semibold" onClick={() => setFormulario({})}>
            Crear usuario
          </Boton>
        }
      >
        <Filtro
          etiqueta="Rol"
          todos="Todos los roles"
          className="xl:w-[210px]"
          opciones={roles.map((r) => ({ valor: String(r.id_rol), texto: descripcionRol(r.nombre_rol) }))}
          valor={borrador.id_rol}
          onChange={(v) => setBorrador({ ...borrador, id_rol: v })}
        />
        <Filtro
          etiqueta="Estado"
          todos="Todos los estados"
          className="xl:w-[230px]"
          opciones={[{ valor: 'Activo', texto: 'Activos' }, { valor: 'Inactivo', texto: 'Inactivos' }]}
          valor={borrador.estado}
          onChange={(v) => setBorrador({ ...borrador, estado: v })}
        />
      </BarraFiltros>

      {isLoading ? (
        <Cargando />
      ) : error ? (
        <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : !data?.datos.length ? (
        <EstadoVacio titulo="No hay usuarios para estos filtros" />
      ) : (
        <>
          {/* Por debajo de xl la tabla se cambia por tarjetas horizontales. */}
          <ul className="flex flex-col gap-3 xl:hidden">
            {data.datos.map((u) => (
              <li key={u.id_usuario} className="flex items-center gap-3 rounded-2xl border-2 border-black/10 bg-[#fdfdfc] p-3.5 sm:gap-4 sm:px-5">
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-azul-marino text-small font-bold text-white">
                  {(u.nombre_usuario[0] ?? '') + (u.apellido_usuario[0] ?? '')}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 sm:flex-1">
                    <p className="truncate text-body font-bold text-black">
                      {u.nombre_usuario} {u.apellido_usuario}
                      {u.apodo_usuario && <span className="font-semibold text-azul-titulo"> · {u.apodo_usuario}</span>}
                    </p>
                    <p className="truncate text-small font-semibold text-black/40" title={u.correo}>
                      {u.correo}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-caption font-bold sm:shrink-0">
                    <span className={`rounded-full px-2.5 leading-5 ${u.estado_usuario === 'Activo' ? 'bg-[#ddf7ea] text-[#159b65]' : 'bg-[#eef0f3] text-[#8c94a1]'}`}>
                      {u.estado_usuario}
                    </span>
                    <span className="text-[#172033]" title={descripcionRoles(u)}>
                      {descripcionRoles(u)}
                    </span>
                    <span className="font-semibold text-black/40">ID {u.id_usuario}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Editar a ${u.nombre_usuario} ${u.apellido_usuario}`}
                  onClick={() => setFormulario({ registro: u })}
                  className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-black/5"
                >
                  <img src={iconoLapiz} alt="" className="size-[18px]" />
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[1100px] table-fixed border-separate border-spacing-0 text-body">
              <colgroup>
                {[71, 152, 160, 262, 312, 104, 238, 205].map((ancho, i) => (
                  <col key={i} style={{ width: ancho }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {COLUMNAS.map((c, i) => (
                    <th
                      key={c.titulo}
                      scope="col"
                      aria-sort={c.orden ? ariaOrden(orden, c.orden) : undefined}
                      className={`h-10 border-y-2 border-black/10 bg-black/10 text-center font-bold text-azul-titulo ${i === 0 ? 'border-l-2 pr-[23px]' : ''} ${i === 6 ? 'pl-14' : ''} ${i === 7 ? 'border-r-2' : ''}`}
                    >
                      {c.orden ? (
                        <BotonOrden
                          titulo={c.titulo}
                          campo={c.orden}
                          orden={orden}
                          onOrdenar={(o) => {
                            setOrden(o);
                            setPagina(1);
                          }}
                        />
                      ) : (
                        c.titulo
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-[#fdfdfc] [&_td]:h-10 [&_td]:border-b [&_td]:border-black/10 [&_td]:text-center [&_td:first-child]:border-l-2 [&_td:last-child]:border-r-2 [&_tr:last-child_td]:border-b-2">
                {data.datos.map((u) => (
                  <tr key={u.id_usuario} className="hover:bg-fondo">
                    <td className="pr-[23px] font-semibold text-black/40">{u.id_usuario}</td>
                    <td className="truncate px-1 font-bold text-azul-titulo">{u.apodo_usuario ?? '—'}</td>
                    <td className="truncate px-1 font-bold text-black">{u.nombre_usuario}</td>
                    <td className="truncate px-1 font-semibold text-black">{u.apellido_usuario}</td>
                    <td className="truncate px-1 font-semibold text-black/40" title={u.correo}>
                      {u.correo}
                    </td>
                    <td>
                      <span
                        className={`inline-block w-[76px] rounded-full text-caption font-bold leading-5 ${
                          u.estado_usuario === 'Activo' ? 'bg-[#ddf7ea] text-[#159b65]' : 'bg-[#eef0f3] text-[#8c94a1]'
                        }`}
                      >
                        {u.estado_usuario}
                      </span>
                    </td>
                    <td className="truncate pl-14 font-bold text-[#172033]" title={descripcionRoles(u)}>
                      {descripcionRoles(u)}
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Editar a ${u.nombre_usuario} ${u.apellido_usuario}`}
                        onClick={() => setFormulario({ registro: u })}
                        className="inline-grid cursor-pointer place-items-center rounded p-1 hover:bg-black/5"
                      >
                        <img src={iconoLapiz} alt="" className="size-[18px]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={data.pagina} paginas={data.paginas} onCambiar={setPagina} />
        </>
      )}
      {formulario && <FormularioUsuario registro={formulario.registro} onCerrar={() => setFormulario(null)} />}
    </>
  );
}
