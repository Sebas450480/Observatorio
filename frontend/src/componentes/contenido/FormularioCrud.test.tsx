import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '../../api/cliente';
import { FormularioCrud } from './FormularioCrud';

function montar(props: Partial<Parameters<typeof FormularioCrud>[0]> = {}) {
  const guardar = vi.fn().mockResolvedValue(undefined);
  const onCerrar = vi.fn();
  render(
    <FormularioCrud
      abierto
      modo="crear"
      titulo="Nuevo evento"
      sustantivo={{ palabra: 'evento', demostrativo: 'este' }}
      validar={() => Promise.resolve(true)}
      guardar={guardar}
      onCerrar={onCerrar}
      {...props}
    >
      <input aria-label="Título" />
    </FormularioCrud>,
  );
  return { guardar, onCerrar };
}

describe('FormularioCrud', () => {
  it('al crear guarda y muestra el aviso de éxito', async () => {
    const { guardar, onCerrar } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nuevo registro' }));
    expect(guardar).toHaveBeenCalledOnce();
    expect(await screen.findByText('El evento se creó correctamente.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(onCerrar).toHaveBeenCalled();
  });

  it('no guarda si la validación falla', async () => {
    const { guardar } = montar({ validar: () => Promise.resolve(false) });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nuevo registro' }));
    expect(guardar).not.toHaveBeenCalled();
  });

  it('al editar pide confirmación antes de guardar', async () => {
    const { guardar } = montar({ modo: 'editar', titulo: 'Editar evento' });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByText('¿Está seguro de que desea editar este evento?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar evento' }));
    expect(guardar).toHaveBeenCalledOnce();
    expect(await screen.findByText('El evento se editó correctamente.')).toBeInTheDocument();
  });

  it('elimina con confirmación', async () => {
    const eliminar = vi.fn().mockResolvedValue(undefined);
    montar({ modo: 'editar', eliminar, sustantivo: { palabra: 'tendencia', demostrativo: 'esta' } });
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar tendencia' }));
    expect(screen.getByText('¿Está seguro de que desea eliminar esta tendencia?')).toBeInTheDocument();
    const confirmar = screen.getAllByRole('button', { name: 'Eliminar tendencia' }).at(-1)!;
    await userEvent.click(confirmar);
    expect(eliminar).toHaveBeenCalledOnce();
    expect(await screen.findByText('La tendencia se eliminó correctamente.')).toBeInTheDocument();
  });

  it('muestra el error del backend sin cerrar el formulario', async () => {
    montar({ guardar: vi.fn().mockRejectedValue(new ErrorApi(409, 'Ya existe un registro con esos datos')) });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nuevo registro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un registro con esos datos');
    expect(screen.getByLabelText('Título')).toBeInTheDocument();
  });
});
