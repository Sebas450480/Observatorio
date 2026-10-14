import type { ReactNode } from 'react';
import { EncabezadoPagina } from '../../componentes/ui/Elementos';

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-subtitle font-extrabold text-[#0a1c40]">{titulo}</h2>
      <div className="flex flex-col gap-2.5 text-body leading-relaxed text-[#334155] [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}

/**
 * Política de tratamiento de datos personales (Habeas Data), Ley 1581 de 2012 y
 * Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).
 * Texto base del Observatorio: la versión oficial la entrega la institución.
 */
export function PoliticaDatos() {
  return (
    <>
      <EncabezadoPagina
        modulo="usuarios"
        titulo="Política de tratamiento de datos personales"
        subtitulo="Habeas Data · Ley 1581 de 2012 y Decreto 1377 de 2013"
        className="mb-6"
      />
      <article className="flex max-w-[900px] flex-col gap-7 rounded-2xl border border-[#e2e8f0] bg-white p-6 sm:p-10">
        <p role="note" className="rounded-xl bg-[#fdf5e1] px-4 py-3 text-small text-[#7a5a00]">
          Versión base del Observatorio Empresarial. Se reemplazará por el texto oficial que apruebe Uniempresarial.
        </p>

        <Seccion titulo="1. Responsable del tratamiento">
          <p>
            La Fundación Universitaria Empresarial de la Cámara de Comercio de Bogotá (Uniempresarial), a través del Observatorio
            Empresarial, es responsable del tratamiento de los datos personales que se recogen en esta plataforma.
          </p>
        </Seccion>

        <Seccion titulo="2. Datos que recogemos">
          <ul>
            <li>Datos de identificación y contacto: nombre, apellido, apodo, correo electrónico y ciudad.</li>
            <li>Preferencias: temas de interés, frecuencia de las alertas por correo y contenidos guardados como favoritos.</li>
            <li>Datos de las empresas coformadoras y de su contacto principal, cuando se registran por invitación.</li>
            <li>Datos de uso: visitas y acciones dentro de la plataforma, con fines estadísticos.</li>
          </ul>
        </Seccion>

        <Seccion titulo="3. Finalidades">
          <ul>
            <li>Crear y administrar la cuenta y permitir el acceso a la plataforma.</li>
            <li>Enviar boletines, alertas y recordatorios según las preferencias que cada persona elige y puede cambiar o silenciar.</li>
            <li>Publicar el directorio de empresas coformadoras con la información que cada empresa autoriza.</li>
            <li>Elaborar estadísticas de uso para mejorar los servicios del Observatorio.</li>
            <li>Atender consultas, reclamos y solicitudes de los titulares.</li>
          </ul>
        </Seccion>

        <Seccion titulo="4. Derechos de los titulares">
          <p>Como titular de los datos tienes derecho a:</p>
          <ul>
            <li>Conocer, actualizar y rectificar tus datos personales.</li>
            <li>Solicitar prueba de la autorización otorgada.</li>
            <li>Ser informado sobre el uso que se ha dado a tus datos.</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
            <li>Revocar la autorización y solicitar la supresión de los datos cuando no se respeten los principios, derechos y garantías legales.</li>
            <li>Acceder gratuitamente a tus datos personales.</li>
          </ul>
          <p>Puedes actualizar tus datos y tus preferencias de correo en cualquier momento desde «Mi perfil».</p>
        </Seccion>

        <Seccion titulo="5. Autorización">
          <p>
            Al crear la cuenta o completar el registro por invitación, el titular autoriza de manera previa, expresa e informada el
            tratamiento de sus datos para las finalidades descritas. La plataforma guarda la fecha de esa autorización.
          </p>
        </Seccion>

        <Seccion titulo="6. Consultas y reclamos">
          <ul>
            <li>Las consultas se atienden en un plazo máximo de diez (10) días hábiles desde su recibo.</li>
            <li>Los reclamos se atienden en un plazo máximo de quince (15) días hábiles desde el día siguiente a su recibo.</li>
          </ul>
          <p>Las solicitudes se dirigen a Uniempresarial por los canales de atención que la institución publique para este fin.</p>
        </Seccion>

        <Seccion titulo="7. Seguridad de la información">
          <p>
            Las contraseñas se guardan cifradas, el acceso a los datos se limita según el rol de cada cuenta y la información viaja
            por conexiones seguras.
          </p>
        </Seccion>

        <Seccion titulo="8. Vigencia">
          <p>
            Esta política rige desde su publicación. Los datos se conservan mientras la cuenta esté activa y durante el tiempo
            necesario para cumplir las finalidades y las obligaciones legales.
          </p>
        </Seccion>
      </article>
    </>
  );
}
