import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { mensajeDeError } from '../../api/cliente';
import iconoBuscar from '../../assets/figma/usuarios/buscar-tabla.svg';
import iconoLapiz from '../../assets/figma/usuarios/lapiz.png';
import { useEliminar, useGuardar, useListado, useRoles } from '../../api/consultas';
import type { Perfil } from '../../api/tipos';
import { BarraFiltros } from '../../componentes/contenido/Controles';
import { FormularioCrud } from '../../componentes/contenido/FormularioCrud';
import { Boton } from '../../componentes/ui/Boton';
import { Casilla, Entrada, Filtro, Selector } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, MensajeError, Paginacion } from '../../componentes/ui/Elementos';
import { descripcionRol, etiquetaRol, useSesion } from '../../sesion/sesion';

const SUPERIOR = 'SuperAdmin Superior';

const base = {
  nombre_usuario: z.string().trim().min(1, 'Escribe el nombre').max(50),
  apellido_usuario: z.string().trim().min(1, 'Escribe el apellido').max(50),
  apodo_usuario: z.string().trim().max(20),
  ciudad: z.string().trim().max(60),
  id_rol: z.string().min(1, 'Elige el rol'),
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
  const { usuario: yo } = useSesion();
  const { data: roles = [] } = useRoles();
  const guardarApi = useGuardar<Perfil>('/usuarios');
  const eliminarApi = useEliminar('/usuarios');
  const editar = !!registro;
  // Un SuperAdmin no puede cambiarle el rol ni el estado a un SuperAdmin Superior, ni asignar ese rol.
  const soySuperior = yo?.nombre_rol === SUPERIOR;
  const protegido = !soySuperior && registro?.nombre_rol === SUPERIOR;
  const propio = registro?.id_usuario === yo?.id_usuario;
  const bloqueado = propio || protegido;
  const rolesVisibles = roles.filter((r) => soySuperior || r.nombre_rol !== SUPERIOR || r.id_rol === registro?.id_rol);
  const { register, trigger, getValues, formState } = useForm<DatosCrear & DatosEditar>({
    resolver: zodResolver(editar ? esquemaEditar : esquemaCrear) as never,
    defaultValues: {
      nombre_usuario: registro?.nombre_usuario ?? '',
      apellido_usuario: registro?.apellido_usuario ?? '',
      apodo_usuario: registro?.apodo_usuario ?? '',
      ciudad: registro?.ciudad ?? '',
      id_rol: registro ? String(registro.id_rol) : '',
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
        datos: bloqueado ? comunes : { ...comunes, id_rol: Number(d.id_rol), estado_usuario: d.estado_usuario },
      });
    } else {
      await guardarApi.mutateAsync({
        datos: { ...comunes, id_rol: Number(d.id_rol), correo: d.correo, contrasena: d.contrasena, acepta_tratamiento_datos: true },
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
        <Selector
          etiqueta="Rol"
          obligatorio
          vacio="Selecciona el rol"
          disabled={bloqueado}
          opciones={rolesVisibles.map((r) => ({ valor: String(r.id_rol), texto: descripcionRol(r.nombre_rol) }))}
          error={e.id_rol?.message}
          {...register('id_rol')}
        />
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
      {propio && <p className="text-[13px] text-texto-suave">No puedes cambiar tu propio rol ni tu estado.</p>}
      {protegido && <p className="text-[13px] text-texto-suave">Es un SuperAdmin Superior: solo otro SuperAdmin Superior puede cambiarle el rol o el estado.</p>}
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

/** Gestión de usuarios (solo SuperAdmin). */
export function Usuarios() {
  const { data: roles = [] } = useRoles();
  const [borrador, setBorrador] = useState({ q: '', id_rol: '', estado: '' });
  const [filtros, setFiltros] = useState(borrador);
  const [pagina, setPagina] = useState(1);
  const [formulario, setFormulario] = useState<{ registro?: Perfil } | null>(null);
  const { data, isLoading, error, refetch } = useListado<Perfil>('/usuarios', {
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
        acciones={
          <Boton pildora className="px-5! font-semibold" onClick={() => setFormulario({})}>
            Crear usuario
          </Boton>
        }
      >
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
        <Boton pildora className="font-bold! shadow-none!" onClick={buscar}>
          Buscar
        </Boton>
      </BarraFiltros>

      {isLoading ? (
        <Cargando />
      ) : error ? (
        <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : !data?.datos.length ? (
        <EstadoVacio titulo="No hay usuarios para estos filtros" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed border-separate border-spacing-0 text-body">
              <colgroup>
                {[71, 152, 160, 262, 312, 104, 238, 205].map((ancho, i) => (
                  <col key={i} style={{ width: ancho }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {['ID', 'Apodo', 'Nombre', 'Apellido', 'Correo', 'Estado', 'Rol', 'Acciones'].map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={`h-10 border-y-2 border-black/10 bg-black/10 text-center font-bold text-azul-titulo ${i === 0 ? 'border-l-2 pr-[23px]' : ''} ${i === 6 ? 'pl-14' : ''} ${i === 7 ? 'border-r-2' : ''}`}
                    >
                      {c}
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
                    <td className="truncate pl-14 font-bold text-[#172033]" title={descripcionRol(u.nombre_rol)}>
                      {u.nombre_rol === SUPERIOR ? 'Superadmin superior' : etiquetaRol(u.nombre_rol) === 'SuperAdmin' ? 'Superadmin' : etiquetaRol(u.nombre_rol)}
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
