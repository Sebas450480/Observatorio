import { describe, expect, it } from 'vitest';
import { invitado, sesion } from './ayudas.js';

const unico = () => Math.random().toString(36).slice(2, 8);

describe('Glosario', () => {
  it('el Gestor Glosario crea, edita y oculta términos; el público solo ve los activos', async () => {
    const { agente } = await sesion('Gestor Glosario');
    const termino = `Coformación ${unico()}`;
    const creado = await agente.post('/api/glosario').send({ termino, definicion: 'Formación compartida entre la universidad y la empresa.' });
    expect(creado.status).toBe(201);
    expect(creado.body).toMatchObject({ termino, estado_gt: 'Activo' });
    const id = creado.body.id_termino as number;

    const publico = await invitado().get(`/api/glosario?q=${encodeURIComponent(termino)}`);
    expect(publico.body.datos).toEqual([expect.objectContaining({ id_termino: id, termino })]);
    expect(publico.body.datos[0]).not.toHaveProperty('estado_gt');

    expect((await agente.patch(`/api/glosario/${id}`).send({ estado_gt: 'Inactivo' })).status).toBe(200);
    expect((await invitado().get(`/api/glosario/${id}`)).status).toBe(404);
    expect((await agente.get(`/api/glosario/${id}`)).status).toBe(200);

    // Repetido (sin importar mayúsculas ni espacios).
    expect((await agente.post('/api/glosario').send({ termino: `  ${termino.toUpperCase()} `, definicion: 'x' })).status).toBe(409);
    expect((await agente.delete(`/api/glosario/${id}`)).status).toBe(204);
  });

  it('solo administran el glosario su gestor y la administración', async () => {
    for (const rol of ['Usuario', 'Gestor Flash', 'Empresa Coformadora'] as const) {
      const { agente } = await sesion(rol);
      expect((await agente.post('/api/glosario').send({ termino: `x ${unico()}`, definicion: 'y' })).status).toBe(403);
    }
    expect((await invitado().post('/api/glosario').send({ termino: 'x', definicion: 'y' })).status).toBe(401);
    const { agente } = await sesion('Gestor Observatorio');
    expect((await agente.post('/api/glosario').send({ termino: `Admin ${unico()}`, definicion: 'y' })).status).toBe(201);
  });

  it('filtra por letra inicial (sin tildes) y lista las letras con términos', async () => {
    const { agente } = await sesion('Super Admin');
    const sufijo = unico();
    await agente.post('/api/glosario').send({ termino: `Ética empresarial ${sufijo}`, definicion: 'Principios.' });
    await agente.post('/api/glosario').send({ termino: `4.0 industria ${sufijo}`, definicion: 'Cuarta revolución.' });
    const e = (await invitado().get('/api/glosario?letra=E&limite=100')).body.datos as { termino: string }[];
    expect(e.some((t) => t.termino.startsWith('Ética empresarial'))).toBe(true);
    const numeros = (await invitado().get('/api/glosario?letra=%23&limite=100')).body.datos as { termino: string }[];
    expect(numeros.some((t) => t.termino.startsWith('4.0'))).toBe(true);
    const letras = (await invitado().get('/api/glosario/letras')).body as string[];
    expect(letras).toEqual(expect.arrayContaining(['E', '#']));
  });
});
