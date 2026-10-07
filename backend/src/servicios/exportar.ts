import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/** Colores institucionales usados en los reportes. */
const COLOR_PRINCIPAL = '#1F3A68';
const COLOR_TEXTO = '#222222';

export interface ColumnaExportar {
  campo: string;
  titulo: string;
  /** Ancho relativo de la columna en el PDF (por defecto 1). */
  ancho?: number;
}

function valorTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    return valor.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
  }
  if (Array.isArray(valor)) {
    return valor
      .map((v) => (typeof v === 'object' && v !== null && 'nombre' in v ? String((v as { nombre: unknown }).nombre) : String(v)))
      .join(', ');
  }
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return String(valor);
}

/** Genera un archivo Excel (.xlsx) con los registros visibles. */
export async function generarExcel(
  titulo: string,
  columnas: ColumnaExportar[],
  filas: Record<string, unknown>[],
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Observatorio Empresarial - Uniempresarial';
  libro.created = new Date();
  const hoja = libro.addWorksheet(titulo.slice(0, 31));

  hoja.columns = columnas.map((c) => ({ header: c.titulo, key: c.campo, width: Math.max(14, c.titulo.length + 4) }));
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A68' } };

  for (const fila of filas) {
    hoja.addRow(Object.fromEntries(columnas.map((c) => [c.campo, valorTexto(fila[c.campo])])));
  }
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** Genera un PDF con formato institucional y una tabla con los registros visibles. */
export function generarPdf(titulo: string, columnas: ColumnaExportar[], filas: Record<string, unknown>[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 40 });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const sumaAnchos = columnas.reduce((s, c) => s + (c.ancho ?? 1), 0);
    const anchos = columnas.map((c) => ((c.ancho ?? 1) / sumaAnchos) * anchoUtil);
    const izquierda = doc.page.margins.left;

    const dibujarEncabezado = () => {
      doc.rect(0, 0, doc.page.width, 60).fill(COLOR_PRINCIPAL);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text('OBSERVATORIO EMPRESARIAL', izquierda, 18);
      doc.font('Helvetica').fontSize(10).text('Uniempresarial', izquierda, 38);
      doc.fillColor(COLOR_TEXTO).font('Helvetica-Bold').fontSize(13).text(titulo, izquierda, 75);
      doc.font('Helvetica').fontSize(8).fillColor('#666666')
        .text(`Generado el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · ${filas.length} registro(s)`, izquierda, 93);
      return 112;
    };

    const dibujarFilaTitulos = (y: number) => {
      doc.rect(izquierda, y, anchoUtil, 18).fill('#E6EAF2');
      let x = izquierda;
      doc.fillColor(COLOR_PRINCIPAL).font('Helvetica-Bold').fontSize(8);
      columnas.forEach((c, i) => {
        doc.text(c.titulo, x + 3, y + 5, { width: (anchos[i] ?? 0) - 6, lineBreak: false, ellipsis: true });
        x += anchos[i] ?? 0;
      });
      return y + 20;
    };

    let y = dibujarFilaTitulos(dibujarEncabezado());
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXTO);

    for (const fila of filas) {
      const textos = columnas.map((c) => valorTexto(fila[c.campo]));
      const alto = Math.min(
        80,
        Math.max(...textos.map((t, i) => doc.heightOfString(t, { width: (anchos[i] ?? 0) - 6 }))) + 6,
      );
      if (y + alto > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = dibujarFilaTitulos(dibujarEncabezado());
        doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXTO);
      }
      let x = izquierda;
      textos.forEach((t, i) => {
        doc.text(t, x + 3, y + 3, { width: (anchos[i] ?? 0) - 6, height: alto - 4, ellipsis: true });
        x += anchos[i] ?? 0;
      });
      doc.moveTo(izquierda, y + alto).lineTo(izquierda + anchoUtil, y + alto).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
      y += alto;
    }

    if (filas.length === 0) {
      doc.text('No hay registros para los filtros seleccionados.', izquierda, y + 6);
    }
    doc.end();
  });
}
