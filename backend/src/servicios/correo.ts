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

/** Plantilla HTML común de los correos del Observatorio. */
export function plantillaCorreo(titulo: string, cuerpoHtml: string, piePixelUrl?: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#222">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff">
    <tr><td style="background:#1F3A68;color:#fff;padding:18px 24px;font-size:18px;font-weight:bold">OBSERVATORIO EMPRESARIAL</td></tr>
    <tr><td style="padding:24px"><h2 style="margin:0 0 12px;font-size:18px;color:#1F3A68">${escaparHtml(titulo)}</h2>${cuerpoHtml}</td></tr>
    <tr><td style="padding:16px 24px;font-size:11px;color:#777;border-top:1px solid #eee">
      Uniempresarial · Recibes este correo porque tienes una cuenta en el Observatorio Empresarial.
    </td></tr>
  </table>
  ${piePixelUrl ? `<img src="${escaparHtml(piePixelUrl)}" width="1" height="1" alt="" style="display:none">` : ''}
</body></html>`;
}
