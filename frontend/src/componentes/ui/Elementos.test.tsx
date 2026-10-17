import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacion } from './Elementos';

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

