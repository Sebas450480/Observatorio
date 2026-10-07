import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MenuExportar, Paginacion } from './Elementos';

describe('Paginacion', () => {
  it('marca la página actual y cambia de página', async () => {
    const onCambiar = vi.fn();
    render(<Paginacion pagina={1} paginas={3} onCambiar={onCambiar} />);
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(onCambiar).toHaveBeenCalledWith(2);
  });

  it('no se muestra con una sola página', () => {
    const { container } = render(<Paginacion pagina={1} paginas={1} onCambiar={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('MenuExportar', () => {
  it('ofrece PDF y Excel con los filtros actuales', async () => {
    render(<MenuExportar ruta="/flash" consulta={{ departamento: 'Antioquia', estado: undefined }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(screen.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute('href', '/api/flash/exportar?departamento=Antioquia&formato=pdf');
    expect(screen.getByRole('link', { name: 'Descargar Excel' })).toHaveAttribute('href', '/api/flash/exportar?departamento=Antioquia&formato=xlsx');
  });
});
