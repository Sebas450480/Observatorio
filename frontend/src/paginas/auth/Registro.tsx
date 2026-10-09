import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { ErrorApi, api, mensajeDeError } from '../../api/cliente';
import { useCategorias } from '../../api/consultas';
import type { Perfil } from '../../api/tipos';
import { SelectorIntereses } from '../../componentes/SelectorIntereses';
import { Casilla, Entrada } from '../../componentes/ui/Campos';
import { useSesion } from '../../sesion/sesion';
import { BOTON_AUTH, EncabezadoAuth, ErrorAuth, PantallaAuth } from './PantallaAuth';

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
    <div className="flex flex-col gap-2">
      <p className="text-small font-semibold text-rojo-vivo">{paso === 1 ? 'Paso 1 de 2 · Tus datos' : 'Paso 2 de 2 · Tus intereses'}</p>
      <div className="grid grid-cols-2 gap-2" aria-hidden>
        <span className="h-1.5 rounded-[3px] bg-rojo-vivo" />
        <span className={`h-1.5 rounded-[3px] ${paso === 2 ? 'bg-rojo-vivo' : 'bg-[#e3e8f0]'}`} />
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
    <PantallaAuth tituloBeneficios="Al registrarte podrás:" ancha>
      <Progreso paso={paso} />
      {paso === 1 ? (
        <form onSubmit={handleSubmit(() => setPaso(2))} noValidate className="flex flex-col gap-[22px]">
          <EncabezadoAuth titulo="Crear cuenta">Completa tus datos para registrarte</EncabezadoAuth>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada variante="perfil" etiqueta="Nombre" placeholder="Nombre" autoComplete="given-name" error={e.nombre_usuario?.message} {...register('nombre_usuario')} />
            <Entrada variante="perfil" etiqueta="Apellido" placeholder="Apellido" autoComplete="family-name" error={e.apellido_usuario?.message} {...register('apellido_usuario')} />
            <Entrada
              variante="perfil"
              className="sm:col-span-2"
              etiqueta="Correo electrónico"
              type="email"
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              error={e.correo?.message}
              {...register('correo')}
            />
            <Entrada variante="perfil" className="sm:col-span-2" etiqueta="Apodo" placeholder="Ej. laurag" error={e.apodo_usuario?.message} {...register('apodo_usuario')} />
            <Entrada variante="perfil" className="sm:col-span-2" etiqueta="Ciudad" placeholder="Ej. Bogotá" autoComplete="address-level2" {...register('ciudad')} />
            <Entrada variante="perfil" etiqueta="Contraseña" type="password" placeholder="••••••••" autoComplete="new-password" error={e.contrasena?.message} {...register('contrasena')} />
            <Entrada variante="perfil" etiqueta="Confirmar contraseña" type="password" placeholder="••••••••" autoComplete="new-password" error={e.confirmar?.message} {...register('confirmar')} />
          </div>
          {error && <ErrorAuth>{error}</ErrorAuth>}
          <div className="flex justify-between gap-3">
            <button type="button" className={`${BOTON_AUTH.secundario} h-[52px]`} onClick={() => navegar('/iniciar-sesion')}>
              Cancelar
            </button>
            <button type="submit" className={`${BOTON_AUTH.principal} h-[50px]`}>
              Siguiente <span aria-hidden>→</span>
            </button>
          </div>
          <p className="text-center text-small text-gris-azulado">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/iniciar-sesion" className="font-bold text-azul-marino hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      ) : (
        <>
          <EncabezadoAuth titulo="¿Qué te interesa?">
            Elige los temas sobre los que quieres recibir alertas. Puedes cambiarlos cuando quieras en tu perfil.
          </EncabezadoAuth>
          <div className="flex flex-col gap-5">
            <SelectorIntereses
              categorias={categorias}
              seleccion={intereses}
              onCambiar={setIntereses}
              titulos={['Contenido que quiero recibir', 'Sectores de interés']}
            />
            <div className="flex flex-col gap-3">
              <Casilla etiqueta="Quiero recibir alertas y novedades por correo electrónico" checked={alertas} onChange={(ev) => setAlertas(ev.target.checked)} />
              <Casilla
                etiqueta={
                  <>
                    Autorizo el tratamiento de mis datos personales según la{' '}
                    <strong className="font-semibold text-azul-marino underline">Política de tratamiento de datos</strong> (Ley 1581 de 2012)
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
          </div>
          {error && <ErrorAuth>{error}</ErrorAuth>}
          <div className="flex justify-between gap-3">
            <button type="button" className={`${BOTON_AUTH.secundario} h-[52px]`} onClick={() => setPaso(1)}>
              <span aria-hidden>←</span> Atrás
            </button>
            <button type="button" className={`${BOTON_AUTH.principal} h-[50px]`} onClick={crearCuenta} disabled={enviando}>
              {enviando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              Crear mi cuenta
            </button>
          </div>
        </>
      )}
    </PantallaAuth>
  );
}
