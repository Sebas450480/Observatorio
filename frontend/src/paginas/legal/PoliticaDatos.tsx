import { ExternalLink, FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { EncabezadoPagina } from '../../componentes/ui/Elementos';

const DOCUMENTOS_BASE = 'https://uniempresarial.edu.co/wp-content/uploads';

/** Documentos oficiales de Uniempresarial en los que se basa esta página. */
const DOCUMENTOS = [
  {
    titulo: 'Política de Protección de Datos Personales (versión 3.0) y certificado de aprobación',
    detalle: 'Aprobada por el Consejo Superior Universitario, Acta 191 del 31 de enero de 2025. Certificada el 25 de febrero de 2025.',
    url: `${DOCUMENTOS_BASE}/2025/02/Certificado-Politica-de-Proteccion-de-Datos-1.pdf`,
  },
  {
    titulo: 'Decisión Rectoral 12 de 2021',
    detalle: 'Lineamientos generales de manejo de bases de datos de Uniempresarial (30 de julio de 2021).',
    url: `${DOCUMENTOS_BASE}/2024/05/Decision-Rectoral-12-de-2021.pdf`,
  },
  {
    titulo: 'Autorización para el tratamiento de datos personales',
    detalle: 'Texto de la autorización que otorga el titular (Ley 1581 de 2012 y Ley 2300 de 2023).',
    url: `${DOCUMENTOS_BASE}/2024/07/Autorizacion-para-el-Tratamiento-de-Datos-Personales.pdf`,
  },
];

/** Políticas institucionales de Uniempresarial (enlace citado en la autorización oficial). */
const POLITICAS_INSTITUCIONALES = `${DOCUMENTOS_BASE}/2024/05/politicas-institucionales.pdf`;

const SECCIONES = [
  'Responsable del tratamiento',
  'Alcance y marco normativo',
  'Datos que recoge el Observatorio',
  'Finalidades',
  'Principios',
  'Derechos de los titulares',
  'Autorización',
  'Cómo ejercer tus derechos',
  'Seguridad y conservación',
  'Oficial de protección de datos',
  'Vigencia',
  'Documentos oficiales',
];
const ancla = (titulo: string) => `seccion-${SECCIONES.findIndex((s) => titulo.endsWith(s)) + 1}`;

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section id={ancla(titulo)} className="flex scroll-mt-6 flex-col gap-2.5 border-t border-[#eef2f6] pt-7 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="text-subtitle font-extrabold text-[#0a1c40]">{titulo}</h2>
      <div className="flex max-w-[80ch] flex-col gap-2.5 text-body leading-relaxed text-[#334155] [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}

const Enlace = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-azul-marino underline underline-offset-2">
    {children}
  </a>
);

/**
 * Política de tratamiento de datos personales (Habeas Data). Resume, para el Observatorio, la
 * Política de Protección de Datos Personales v3.0 de Uniempresarial (Acta 191 de 2025), la
 * Decisión Rectoral 12 de 2021 y la autorización oficial; enlaza los documentos completos.
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
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        {/* En pantallas grandes, índice fijo a la izquierda para saltar entre secciones. */}
        <nav aria-label="Contenido de la política" className="hidden rounded-2xl border border-[#e2e8f0] bg-white p-5 lg:sticky lg:top-6 lg:block">
          <p className="mb-3 text-caption font-bold uppercase tracking-[0.5px] text-[#64748b]">Contenido</p>
          <ol className="flex flex-col gap-1">
            {SECCIONES.map((s, i) => (
              <li key={s}>
                <a href={`#seccion-${i + 1}`} className="block rounded-lg px-3 py-2 text-small font-semibold text-[#0a1c40] hover:bg-fondo">
                  {i + 1}. {s}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="flex min-w-0 flex-col gap-7 rounded-2xl border border-[#e2e8f0] bg-white p-6 sm:p-10 xl:px-14">
          <p role="note" className="rounded-xl bg-[#eef3fb] px-4 py-3 text-small text-[#1e3a6e]">
            Esta página resume, para el Observatorio Empresarial, la Política de Protección de Datos Personales de Uniempresarial
            (versión 3.0, aprobada el 31 de enero de 2025). Los documentos completos están al final, en{' '}
            <a href="#seccion-12" className="font-semibold underline underline-offset-2">Documentos oficiales</a>.
          </p>

          <Seccion titulo="1. Responsable del tratamiento">
            <p>
              La <strong>Fundación Universitaria Empresarial de la Cámara de Comercio de Bogotá – Uniempresarial</strong>, reconocida
              mediante la Resolución 021950 del 24 de noviembre de 2020 del Ministerio de Educación Nacional, es la responsable del
              tratamiento de los datos personales que se recogen en el Observatorio Empresarial. Como filial de la Cámara de Comercio
              de Bogotá, alinea su política de protección de datos con la de la CCB.
            </p>
            <ul>
              <li>Sede principal: Carrera 33A n.º 30-20, Bogotá D.C.</li>
              <li>Sede administrativa: Transversal 34 Bis n.º 29A-44, Bogotá D.C.</li>
              <li>Teléfono: (601) 380 80 00</li>
              <li>
                Portal web: <Enlace href="https://uniempresarial.edu.co/">uniempresarial.edu.co</Enlace>
              </li>
            </ul>
          </Seccion>

          <Seccion titulo="2. Alcance y marco normativo">
            <p>
              La política se aplica a todos los datos personales registrados en cualquier base de datos que gestione Uniempresarial,
              incluida esta plataforma, y es de obligatorio cumplimiento para directivos, funcionarios, estudiantes, egresados,
              contratistas y terceros que traten datos en su nombre.
            </p>
            <p>Se fundamenta, entre otras, en estas normas:</p>
            <ul>
              <li>Constitución Política de Colombia, artículo 15 (derecho a la intimidad y al habeas data).</li>
              <li>Ley 1581 de 2012, de protección de datos personales, y Decreto 1377 de 2013.</li>
              <li>Decreto 1074 de 2015 (Decreto Único Reglamentario del Sector Comercio, Industria y Turismo).</li>
              <li>Ley 1266 de 2008 (habeas data financiero) y Ley 1712 de 2014 (transparencia y acceso a la información pública).</li>
              <li>Ley 2300 de 2023, sobre los horarios y canales de contacto con los titulares.</li>
              <li>Guía para la protección de datos personales de la Superintendencia de Industria y Comercio y norma NTC-ISO-IEC 27001.</li>
            </ul>
          </Seccion>

          <Seccion titulo="3. Datos que recoge el Observatorio">
            <ul>
              <li>Datos de identificación y contacto: nombre, apellido, apodo, correo electrónico y ciudad.</li>
              <li>Preferencias: temas de interés, frecuencia de las alertas por correo y contenidos guardados como favoritos.</li>
              <li>Datos de las empresas coformadoras y de su contacto principal, cuando se registran por invitación.</li>
              <li>Datos de uso: visitas, clics en «Acceder», contenidos compartidos y apertura de los correos, con fines estadísticos.</li>
            </ul>
            <p>
              El Observatorio no solicita datos sensibles (por ejemplo, de salud, origen étnico o datos biométricos). Suministrar este
              tipo de datos, o datos de menores de edad, es siempre facultativo.
            </p>
          </Seccion>

          <Seccion titulo="4. Finalidades">
            <p>Los datos se tratan para:</p>
            <ul>
              <li>Crear y administrar la cuenta y permitir el acceso a la plataforma según el rol de cada persona.</li>
              <li>
                Enviar boletines, alertas y recordatorios por correo electrónico según las preferencias que cada persona elige y
                puede cambiar o silenciar en «Mi perfil».
              </li>
              <li>Publicar el directorio de empresas coformadoras con la información que cada empresa autoriza.</li>
              <li>Elaborar estadísticas de uso para mejorar los servicios del Observatorio y de la institución.</li>
              <li>Atender peticiones, consultas, quejas, reclamos y sugerencias de los titulares.</li>
              <li>
                Las finalidades institucionales que recoge la autorización oficial: gestión administrativa, envío de comunicaciones
                por los medios registrados, y mercadeo, prospección comercial y publicidad propia de Uniempresarial.
              </li>
            </ul>
            <p>
              Para cumplir estas finalidades, los datos pueden transmitirse a proveedores de servicios de almacenamiento de
              información y de envío de mensajería, que los tratan por cuenta de Uniempresarial.
            </p>
          </Seccion>

          <Seccion titulo="5. Principios">
            <p>Uniempresarial trata los datos personales con base en los principios de:</p>
            <ul>
              <li>Acceso y circulación restringida: solo acceden las personas autorizadas por el titular o por la ley.</li>
              <li>Confidencialidad: quien trata los datos guarda reserva, incluso después de terminar su vínculo.</li>
              <li>Finalidad, legalidad y libertad: propósito legítimo e informado, y consentimiento previo, expreso e informado.</li>
              <li>Seguridad: medidas técnicas, humanas y administrativas contra la adulteración, pérdida o acceso no autorizado.</li>
              <li>Transparencia y veracidad: el titular puede saber qué datos suyos existen, y estos deben ser exactos y completos.</li>
              <li>Responsabilidad demostrada y autonomía del titular.</li>
            </ul>
          </Seccion>

          <Seccion titulo="6. Derechos de los titulares">
            <p>Como titular de los datos tienes derecho a:</p>
            <ul>
              <li>Acceder, conocer, actualizar y rectificar tus datos personales.</li>
              <li>Solicitar prueba de la autorización otorgada, salvo cuando la ley no la exija.</li>
              <li>Ser informado, previa solicitud, sobre el uso que se ha dado a tus datos.</li>
              <li>Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la Ley 1581 de 2012.</li>
              <li>Revocar la autorización o solicitar la supresión de tus datos cuando no se respeten los principios, derechos y garantías legales.</li>
              <li>
                Acceder gratuitamente a tus datos, al menos una vez cada mes calendario y cada vez que cambie de forma sustancial la
                política.
              </li>
              <li>Solicitar la limitación del tratamiento y recibir tus datos en un formato estructurado (portabilidad).</li>
              <li>Oponerte al uso de tus datos en herramientas analíticas o de monitoreo.</li>
            </ul>
            <p>Puedes actualizar tus datos y tus preferencias de correo en cualquier momento desde «Mi perfil».</p>
          </Seccion>

          <Seccion titulo="7. Autorización">
            <p>
              Al crear la cuenta o completar el registro por invitación, el titular autoriza de manera previa, expresa e informada el
              tratamiento de sus datos para las finalidades descritas. La plataforma guarda la fecha de esa autorización como
              constancia, conforme a la Decisión Rectoral 12 de 2021.
            </p>
            <p>
              Según el artículo 10 de la Ley 1581 de 2012, la autorización no es necesaria cuando se trata de información requerida por
              una entidad pública en ejercicio de sus funciones o por orden judicial, de datos de naturaleza pública, de casos de
              urgencia médica o sanitaria, de tratamiento autorizado por la ley con fines históricos, estadísticos o científicos, o de
              datos del Registro Civil de las Personas.
            </p>
          </Seccion>

          <Seccion titulo="8. Cómo ejercer tus derechos">
            <p>Para conocer, actualizar, rectificar o suprimir tus datos, o revocar la autorización, puedes escribir a:</p>
            <ul>
              <li>
                Correo de habeas data: <Enlace href="mailto:habeasdata@uniempresarial.edu.co">habeasdata@uniempresarial.edu.co</Enlace>,
                indicando en el asunto el derecho que deseas ejercer.
              </li>
              <li>
                Atención al usuario: <Enlace href="mailto:atencionalusuario@uniempresarial.edu.co">atencionalusuario@uniempresarial.edu.co</Enlace>
              </li>
              <li>
                Formulario en línea del{' '}
                <Enlace href="https://centrodeatencionalusuario.uniempresarial.edu.co/glpi/index.php?noAUTO=1">centro de atención al usuario</Enlace>.
              </li>
              <li>Comunicación escrita a Uniempresarial, Jefatura de Tecnología, Carrera 33A n.º 30-20, Bogotá D.C.</li>
            </ul>
            <p>
              La solicitud debe incluir tus nombres y apellidos completos, el detalle de lo que pides, tu dirección física o
              electrónica y un teléfono de contacto, y tu firma o número de identificación. Si actúas por medio de un apoderado, se
              debe adjuntar el poder con reconocimiento de firma y contenido ante notario. La respuesta se envía solo al titular o a su
              apoderado, a la dirección indicada en la solicitud.
            </p>
            <p>
              La Jefatura de Tecnología atiende las peticiones dentro de los plazos de la Ley 1581 de 2012: hasta diez (10) días
              hábiles para las consultas y hasta quince (15) días hábiles para los reclamos.
            </p>
            <p>
              La supresión no procede cuando el titular tiene un deber legal o contractual de permanecer en la base de datos, cuando
              afectaría procesos judiciales o administrativos, o cuando los datos son necesarios para proteger intereses del titular
              o cumplir una obligación legal.
            </p>
          </Seccion>

          <Seccion titulo="9. Seguridad y conservación">
            <p>
              Uniempresarial aplica medidas de seguridad físicas, lógicas y administrativas, clasificadas según el riesgo de los datos,
              entre ellas cifrado, controles de acceso, auditorías y gestión de incidentes. En el Observatorio, las contraseñas se
              guardan cifradas, el acceso a los datos se limita según el rol de cada cuenta y la información viaja por conexiones
              seguras.
            </p>
            <p>
              Los datos se conservan mientras la cuenta esté activa y durante el tiempo necesario para cumplir las finalidades y las
              obligaciones legales. Cumplido ese objetivo, se eliminan de forma segura.
            </p>
          </Seccion>

          <Seccion titulo="10. Oficial de protección de datos">
            <p>
              Uniempresarial cuenta con un Oficial de Protección de Datos Personales, designado por el equipo directivo, y con un
              Comité de Habeas Data que lo asesora. El Comité lo integran la Secretaría General, que lo preside, la Jefatura de
              Tecnología y la Dirección de Planeación y Aseguramiento de la Calidad. Entre sus funciones están atender a los titulares,
              reportar las bases de datos ante la Superintendencia de Industria y Comercio y actualizar los procedimientos de
              tratamiento.
            </p>
          </Seccion>

          <Seccion titulo="11. Vigencia">
            <p>
              Esta página se basa en la Política de Protección de Datos Personales de Uniempresarial, versión 3.0, aprobada por el
              Consejo Superior Universitario mediante el Acta 191 del 31 de enero de 2025, y en la Decisión Rectoral 12 de 2021. Rige
              desde su publicación por los medios autorizados por la institución.
            </p>
          </Seccion>

          <Seccion titulo="12. Documentos oficiales">
            <p>Consulta los documentos completos de Uniempresarial:</p>
            <ul className="flex flex-col gap-3">
              {DOCUMENTOS.map((d) => (
                <li key={d.url} className="ml-0! list-none!">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 rounded-xl border border-[#e2e8f0] p-4 transition-colors hover:border-azul-marino hover:bg-fondo"
                  >
                    <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-rojo" />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold text-[#0a1c40]">{d.titulo}</span>
                      <span className="text-small text-[#64748b]">{d.detalle}</span>
                    </span>
                    <ExternalLink aria-hidden className="ml-auto mt-0.5 size-4 shrink-0 text-[#94a3b8]" />
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={POLITICAS_INSTITUCIONALES}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-azul-marino px-5 py-2.5 text-small font-semibold text-white hover:opacity-90"
            >
              Ver todas las políticas institucionales de Uniempresarial
              <ExternalLink aria-hidden className="size-4" />
            </a>
          </Seccion>
        </article>
      </div>
    </>
  );
}
