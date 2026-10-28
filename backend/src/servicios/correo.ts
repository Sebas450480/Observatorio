import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';

export interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

/** En las pruebas automáticas los correos se guardan aquí en lugar de enviarse. */
export const correosDePrueba: Correo[] = [];

let transporte: Transporter | null = null;

function obtenerTransporte(): Transporter {
  if (transporte) return transporte;
  if (config.correo.host) {
    // Servidor SMTP real, o Mailpit en desarrollo (localhost:1025, buzón en http://localhost:8025).
    transporte = nodemailer.createTransport({
      host: config.correo.host,
      port: config.correo.puerto,
      secure: config.correo.seguro,
      auth: config.correo.usuario ? { user: config.correo.usuario, pass: config.correo.contrasena } : undefined,
    });
  } else {
    // Sin SMTP configurado: el correo se escribe en la consola.
    transporte = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporte;
}

export async function enviarCorreo(correo: Correo): Promise<void> {
  if (config.esPrueba) {
    correosDePrueba.push(correo);
    return;
  }
  const info = await obtenerTransporte().sendMail({
    from: config.correo.remitente,
    to: correo.para,
    subject: correo.asunto,
    html: correo.html,
    text: correo.texto,
  });
  if (!config.correo.host) {
    if (config.esProduccion) {
      // En producción no se escribe el contenido: los enlaces de recuperación son secretos.
      console.error(`[correo] No se envió «${correo.asunto}»: falta configurar SMTP_HOST en las variables del servidor.`);
    } else {
      console.info(`[correo sin SMTP] Para: ${correo.para} | Asunto: ${correo.asunto}\n${correo.texto}`);
    }
  } else if (!config.esProduccion) {
    console.info(`[correo] Enviado a ${correo.para}: ${info.messageId}`);
  }
}

/** Escapa texto para insertarlo en el HTML de un correo. */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

const AZUL = '#1F3A68';
/** Encabezado: un azul más claro que el de los textos para que el logo resalte. */
const AZUL_ENCABEZADO = '#334394';
const ROJO = '#C8102E';
const GRIS = '#6b7280';

/** Pie de cada correo: por qué lo recibe la persona. */
export const PIE_CUENTA = 'Recibes este correo porque tienes una cuenta en el Observatorio Empresarial.';

interface OpcionesPlantilla {
  /** Por qué recibe el correo (va en el pie). Por defecto, porque tiene una cuenta. */
  motivo?: string;
  /** Imagen invisible que marca cuándo se abrió el correo. */
  pixelUrl?: string;
  /** Texto corto que algunos programas muestran junto al asunto. */
  resumen?: string;
}

/**
 * Botón que se ve igual en Gmail, Outlook y el celular, con el enlace en texto debajo
 * por si el programa de correo no muestra el botón.
 */
export function botonCorreo(texto: string, url: string): string {
  const u = escaparHtml(url);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px"><tr>
      <td align="center" bgcolor="${ROJO}" style="border-radius:8px">
        <a href="${u}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">${escaparHtml(texto)}</a>
      </td></tr></table>
    <p style="margin:0 0 4px;font-size:12px;line-height:18px;color:${GRIS}">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
      <a href="${u}" style="color:${AZUL};word-break:break-all">${u}</a></p>`;
}

/** Recuadro gris para datos clave (fecha, lugar, vigencia...). Recibe HTML ya escapado. */
export function recuadroCorreo(contenidoHtml: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0"><tr>
      <td style="background:#f1f4f9;border-left:4px solid ${AZUL};border-radius:6px;padding:14px 18px;font-size:14px;line-height:22px;color:#1f293d">${contenidoHtml}</td>
    </tr></table>`;
}

/** Plantilla HTML común de los correos del Observatorio: logo, título, contenido y pie. */
export function plantillaCorreo(titulo: string, cuerpoHtml: string, opciones: OpcionesPlantilla = {}): string {
  const sitio = config.frontendUrl;
  const logo = `${sitio}/correo/logo-observatorio.png`;
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escaparHtml(titulo)}</title>
<style>
  @media (max-width:740px){ .contenedor{width:100%!important} .relleno{padding-left:20px!important;padding-right:20px!important} h1{font-size:20px!important} }
</style>
</head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;color:#1f293d;-webkit-text-size-adjust:100%">
  ${opciones.resumen ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escaparHtml(opciones.resumen)}</div>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef1f6"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" class="contenedor" width="720" cellspacing="0" cellpadding="0" border="0" style="width:720px;max-width:720px;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td bgcolor="${AZUL_ENCABEZADO}" align="center" style="background:${AZUL_ENCABEZADO};padding:28px 24px">
        <a href="${escaparHtml(sitio)}" target="_blank"><img src="${escaparHtml(logo)}" width="260" alt="Uniempresarial · Observatorio Empresarial" style="display:block;width:260px;max-width:80%;height:auto;border:0;color:#ffffff;font-size:18px;font-weight:bold"></a>
      </td></tr>
      <tr><td bgcolor="${ROJO}" style="height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
      <tr><td class="relleno" style="padding:36px 48px 32px;font-size:15px;line-height:24px">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${AZUL}">${escaparHtml(titulo)}</h1>
        ${cuerpoHtml}
      </td></tr>
      <tr><td class="relleno" style="padding:20px 48px 26px;background:#f7f8fb;border-top:1px solid #e5e8ef;font-size:12px;line-height:18px;color:${GRIS}">
        <p style="margin:0 0 8px">${escaparHtml(opciones.motivo ?? PIE_CUENTA)}</p>
        <p style="margin:0"><strong style="color:${AZUL}">Observatorio Empresarial · Uniempresarial</strong><br>
          <a href="${escaparHtml(sitio)}" style="color:${AZUL}">Ir al Observatorio</a> &nbsp;·&nbsp;
          <a href="${escaparHtml(`${sitio}/politica-de-datos`)}" style="color:${AZUL}">Política de tratamiento de datos</a></p>
      </td></tr>
    </table>
  </td></tr></table>
  ${opciones.pixelUrl ? `<img src="${escaparHtml(opciones.pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">` : ''}
</body></html>`;
}
