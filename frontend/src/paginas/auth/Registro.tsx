import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { ErrorApi, api, mensajeDeError } from '../../api/cliente';
import { useCategorias } from '../../api/consultas';
import type { Perfil } from '../../api/tipos';
import { SelectorIntereses } from '../../componentes/SelectorIntereses';
import { Boton } from '../../componentes/ui/Boton';
import { Casilla, Entrada } from '../../componentes/ui/Campos';
import { useSesion } from '../../sesion/sesion';
import { PantallaAuth } from './PantallaAuth';

const esquemaDatos = z
  .object({
    nombre_usuario: z.string().trim().min(1, 'Escribe tu nombre').max(50),
    apellido_usuario: z.string().trim().min(1, 'Escribe tu apellido').max(50),
    correo: z.email('Escribe un correo válido'),
    apodo_usuario: z.string().trim().max(20, 'Máximo 20 caracteres'),
    ciudad: z.string().trim().max(60),
    contrasena: z.string().min(8, 'Mínimo 8 caracteres').max(72),
    confirmar: z.string(),
  })
  .refine((d) => d.contrasena === d.confirmar, { message: 'Las contraseñas no coinciden', path: ['confirmar'] });
type Datos = z.infer<typeof esquemaDatos>;

function Progreso({ paso }: { paso: 1 | 2 }) {
  return (
    <div className="mb-5">
      <p className="text-caption font-bold text-rojo">{paso === 1 ? 'Paso 1 de 2 · Tus datos' : 'Paso 2 de 2 · Tus intereses'}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5" aria-hidden>
        <span className="h-1 rounded-full bg-rojo" />
        <span className={`h-1 rounded-full ${paso === 2 ? 'bg-rojo' : 'bg-[#e3e7ee]'}`} />
      </div>
    </div>
  );
}

export function Registro() {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [intereses, setIntereses] = useState<number[]>([]);
  const [alertas, setAlertas] = useState(true);
  const [autoriza, setAutoriza] = useState(false);
  const [errorAutoriza, setErrorAutoriza] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { data: categorias = [] } = useCategorias();
  const { establecerUsuario } = useSesion();
  const navegar = useNavigate();
  const formulario = useForm<Datos>({
    resolver: zodResolver(esquemaDatos),
    defaultValues: { nombre_usuario: '', apellido_usuario: '', correo: '', apodo_usuario: '', ciudad: '', contrasena: '', confirmar: '' },
  });
  const { register, formState, handleSubmit, setError: marcarError } = formulario;
  const e = formState.errors;

  const crearCuenta = async () => {
    if (!autoriza) {
      setErrorAutoriza('Debes autorizar el tratamiento de tus datos personales para crear la cuenta');
      return;
    }
    setError(null);
    setEnviando(true);
    const d = formulario.getValues();
    try {
      const perfil = await api<Perfil>('/auth/registro', {
        metodo: 'POST',
        cuerpo: {
          nombre_usuario: d.nombre_usuario,
          apellido_usuario: d.apellido_usuario,
          apodo_usuario: d.apodo_usuario,
          correo: d.correo,
          contrasena: d.contrasena,
          ciudad: d.ciudad,
          intereses,
          frecuencia_alertas: alertas ? 'Semanal' : 'Ninguna',
          acepta_tratamiento_datos: true,
        },
      });
      establecerUsuario(perfil);
      navegar('/inicio', { replace: true });
    } catch (err) {
      // Un correo repetido o un dato inválido se corrige en el paso 1.
      if (err instanceof ErrorApi && (err.estado === 409 || err.estado === 400)) {
        setPaso(1);
        if (err.estado === 409) marcarError('correo', { message: err.message });
        Object.entries(err.erroresPorCampo).forEach(([campo, mensaje]) => marcarError(campo as keyof Datos, { message: mensaje }));
      }
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PantallaAuth tituloBeneficios="Al registrarte podrás:">
      <Progreso paso={paso} />
      {paso === 1 ? (
        <form onSubmit={handleSubmit(() => setPaso(2))} noValidate>
          <h1 className="text-[26px] font-bold text-azul-titulo">Crear cuenta</h1>
          <p className="mt-1 text-small text-texto-suave">Completa tus datos para registrarte</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Entrada etiqueta="Nombre" placeholder="Nombre" autoComplete="given-name" error={e.nombre_usuario?.message} {...register('nombre_usuario')} />
            <Entrada etiqueta="Apellido" placeholder="Apellido" autoComplete="family-name" error={e.apellido_usuario?.message} {...register('apellido_usuario')} />
            <Entrada
              className="sm:col-span-2"
              etiqueta="Correo electrónico"
              type="email"
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              error={e.correo?.message}
              {...register('correo')}
            />
            <Entrada className="sm:col-span-2" etiqueta="Apodo" placeholder="Ej. laurag" error={e.apodo_usuario?.message} {...register('apodo_usuario')} />
            <Entrada className="sm:col-span-2" etiqueta="Ciudad" placeholder="Ej. Bogotá" autoComplete="address-level2" {...register('ciudad')} />
            <Entrada etiqueta="Contraseña" type="password" placeholder="••••••••" autoComplete="new-password" error={e.contrasena?.message} {...register('contrasena')} />
            <Entrada etiqueta="Confirmar contraseña" type="password" placeholder="••••••••" autoComplete="new-password" error={e.confirmar?.message} {...register('confirmar')} />
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-between gap-3">
            <Boton variante="secundario" onClick={() => navegar('/iniciar-sesion')}>
              Cancelar
            </Boton>
            <Boton type="submit" icono={<ArrowRight className="size-4" />} className="flex-row-reverse">
              Siguiente
            </Boton>
          </div>
          <p className="mt-5 text-center text-caption text-texto-suave">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/iniciar-sesion" className="font-bold text-azul-titulo hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      ) : (
        <div>
          <h1 className="text-[26px] font-bold text-azul-titulo">¿Qué te interesa?</h1>
          <p className="mt-1 text-small text-texto-suave">
            Elige los temas sobre los que quieres recibir alertas. Puedes cambiarlos cuando quieras en tu perfil.
          </p>
          <div className="mt-5">
            <SelectorIntereses categorias={categorias} seleccion={intereses} onCambiar={setIntereses} />
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <Casilla etiqueta="Quiero recibir alertas y novedades por correo electrónico" checked={alertas} onChange={(ev) => setAlertas(ev.target.checked)} />
            <Casilla
              etiqueta={
                <>
                  Autorizo el tratamiento de mis datos personales según la{' '}
                  <strong className="text-azul-titulo underline">Política de tratamiento de datos</strong> (Ley 1581 de 2012)
                </>
              }
              checked={autoriza}
              error={errorAutoriza}
              onChange={(ev) => {
                setAutoriza(ev.target.checked);
                setErrorAutoriza(undefined);
              }}
            />
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-between gap-3">
            <Boton variante="secundario" icono={<ArrowLeft className="size-4" />} onClick={() => setPaso(1)}>
              Atrás
            </Boton>
            <Boton onClick={crearCuenta} cargando={enviando}>
              Crear mi cuenta
            </Boton>
          </div>
        </div>
      )}
    </PantallaAuth>
  );
}
