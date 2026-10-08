import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { mensajeDeError } from '../../api/cliente';
import { useEliminar, useGuardar, useListado, useRoles } from '../../api/consultas';
import type { Perfil } from '../../api/tipos';
import { BarraFiltros } from '../../componentes/contenido/Controles';
import { FormularioCrud } from '../../componentes/contenido/FormularioCrud';
import { Boton } from '../../componentes/ui/Boton';
import { Casilla, Entrada, Filtro, Selector } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, InsigniaEstado, MensajeError, Paginacion } from '../../componentes/ui/Elementos';
import { descripcionRol, etiquetaRol, useSesion } from '../../sesion/sesion';

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
  const propio = registro?.id_usuario === yo?.id_usuario;
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
        datos: propio ? comunes : { ...comunes, id_rol: Number(d.id_rol), estado_usuario: d.estado_usuario },
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
      eliminar={editar && !propio ? () => eliminarApi.mutateAsync(registro.id_usuario) : undefined}
      onCerrar={onCerrar}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Entrada etiqueta="Nombre" obligatorio error={e.nombre_usuario?.message} {...register('nombre_usuario')} />
        <Entrada etiqueta="Apellido" obligatorio error={e.apellido_usuario?.message} {...register('apellido_usuario')} />
        <Entrada etiqueta="Apodo" placeholder="Ej. amartinez" {...register('apodo_usuario')} />
        <Entrada etiqueta="Ciudad" placeholder="Ej. Bogotá" {...register('ciudad')} />
        {editar ? (
          <Entrada etiqueta="Correo" value={registro.correo} readOnly disabled />
        ) : (
          <>
            <Entrada etiqueta="Correo" type="email" obligatorio autoComplete="off" error={e.correo?.message} {...register('correo')} />
            <Entrada etiqueta="Contraseña inicial" type="password" obligatorio autoComplete="new-password" error={e.contrasena?.message} {...register('contrasena')} />
          </>
        )}
        <Selector
          etiqueta="Rol"
          obligatorio
          vacio="Selecciona el rol"
          disabled={propio}
          opciones={roles.map((r) => ({ valor: String(r.id_rol), texto: descripcionRol(r.nombre_rol) }))}
          error={e.id_rol?.message}
          {...register('id_rol')}
        />
        {editar && (
          <Selector etiqueta="Estado" disabled={propio} opciones={[{ valor: 'Activo', texto: 'Activo' }, { valor: 'Inactivo', texto: 'Inactivo (bloqueado)' }]} {...register('estado_usuario')} />
        )}
      </div>
      {propio && <p className="text-[13px] text-texto-suave">No puedes cambiar tu propio rol ni tu estado.</p>}
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
      <EncabezadoPagina icono={<UserRound />} titulo="Usuarios" subtitulo="Usuarios registrados en la plataforma" />
      <BarraFiltros
        acciones={
          <Boton pildora onClick={() => setFormulario({})}>
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
          <Entrada
            aria-label="Buscar usuarios"
            placeholder="Buscar por nombre, apodo o correo"
            icono={<Search className="size-4" />}
            className="w-full sm:w-72"
            value={borrador.q}
            onChange={(ev) => setBorrador({ ...borrador, q: ev.target.value })}
          />
        </form>
        <Filtro
          etiqueta="Rol"
          todos="Todos los roles"
          opciones={roles.map((r) => ({ valor: String(r.id_rol), texto: descripcionRol(r.nombre_rol) }))}
          valor={borrador.id_rol}
          onChange={(v) => setBorrador({ ...borrador, id_rol: v })}
        />
        <Filtro
          etiqueta="Estado"
          todos="Todos los estados"
          opciones={[{ valor: 'Activo', texto: 'Activos' }, { valor: 'Inactivo', texto: 'Inactivos' }]}
          valor={borrador.estado}
          onChange={(v) => setBorrador({ ...borrador, estado: v })}
        />
        <Boton pildora onClick={buscar}>
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
          <div className="overflow-x-auto rounded-tarjeta border border-borde bg-white shadow-tarjeta">
            <table className="w-full min-w-[860px] text-caption">
              <thead className="bg-[#eceef1] text-azul-titulo">
                <tr>
                  {['ID', 'Apodo', 'Nombre', 'Apellido', 'Correo', 'Estado', 'Rol', 'Acciones'].map((c) => (
                    <th key={c} scope="col" className="px-3 py-2.5 text-center font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.datos.map((u) => (
                  <tr key={u.id_usuario} className="border-t border-borde text-center hover:bg-fondo">
                    <td className="px-3 py-2.5 text-texto-suave">{u.id_usuario}</td>
                    <td className="px-3 py-2.5 font-semibold text-azul-titulo">{u.apodo_usuario ?? '—'}</td>
                    <td className="px-3 py-2.5 font-semibold text-texto">{u.nombre_usuario}</td>
                    <td className="px-3 py-2.5 font-semibold text-texto">{u.apellido_usuario}</td>
                    <td className="px-3 py-2.5 text-texto-suave">{u.correo}</td>
                    <td className="px-3 py-2.5">
                      <InsigniaEstado estado={u.estado_usuario} />
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-texto" title={descripcionRol(u.nombre_rol)}>
                      {etiquetaRol(u.nombre_rol) === 'SuperAdmin' ? 'Superadmin' : etiquetaRol(u.nombre_rol)}
                      {u.nombre_rol.startsWith('Gestor') && (
                        <span className="block text-[11px] font-normal text-texto-suave">{u.nombre_rol.replace('Gestor ', '')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        aria-label={`Editar a ${u.nombre_usuario} ${u.apellido_usuario}`}
                        onClick={() => setFormulario({ registro: u })}
                        className="cursor-pointer rounded p-1 text-azul-titulo hover:bg-white"
                      >
                        <Pencil className="size-4" />
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
