import { describe, expect, it } from 'vitest';
import { db, invitado, sesion } from './ayudas.js';

async function crearFlash(titulo: string, estado: 'Activo' | 'Inactivo' = 'Activo') {
  const { rows } = await db().query<{ id_fi: number }>(
    `insert into flash_informativo (titulo, fecha_inicio, modalidad, tipo_evento, estado_fi)
     values ($1, '2026-11-20T08:00:00-05:00', 'Virtual', 'Foro', $2) returning id_fi`,
    [titulo, estado],
  );
  return rows[0]!.id_fi;
}

async function idCategoria(nombre: string) {
  const { rows } = await db().query<{ id_categoria: number }>('select id_categoria from categoria where nombre_categoria = $1', [nombre]);
  return rows[0]!.id_categoria;
}

describe('Favoritos', () => {
  it('el usuario guarda, lista y quita favoritos; las claves marcan las banderitas', async () => {
    const { agente } = await sesion('Usuario');
    const id = await crearFlash('Flash para favoritos');

    expect((await agente.put(`/api/favoritos/Flash/${id}`)).status).toBe(200);
    // Guardar dos veces no duplica.
    expect((await agente.put(`/api/favoritos/Flash/${id}`)).status).toBe(200);

    expect((await agente.get('/api/favoritos/claves')).body).toEqual([`Flash:${id}`]);
    const lista = await agente.get('/api/favoritos');
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0]).toMatchObject({ tipo_contenido: 'Flash', id_contenido: id, titulo: 'Flash para favoritos', categorias: [] });
    expect(lista.body[0].fecha).toMatch(/^2026-11-20T/);

    expect((await agente.delete(`/api/favoritos/Flash/${id}`)).status).toBe(200);
    expect((await agente.get('/api/favoritos/claves')).body).toEqual([]);
  });

  it('marca los favoritos que coinciden con los intereses (categorías y sector de la empresa)', async () => {
    const { agente, usuario } = await sesion('Usuario');
    const tecnologia = await idCategoria('Tecnología');
    const comercio = await idCategoria('Comercio');
    await db().query('insert into usuario_interes (id_usuario, id_categoria) values ($1, $2), ($1, $3)', [usuario.id, tecnologia, comercio]);

    const conInteres = await crearFlash('Flash de tecnología');
    await db().query('insert into flash_informativo_categoria (id_fi, id_categoria) values ($1, $2)', [conInteres, tecnologia]);
    const sinInteres = await crearFlash('Flash sin categorías');
    const { rows } = await db().query<{ id_ec: number }>(
      `insert into empresa_coformadora (nit, razon_social, sector_economico, departamento, municipio)
       values ('FAV-' || floor(random() * 1e9)::text, 'Empresa de comercio', 'Comercio', 'Bogotá D.C.', 'Bogotá') returning id_ec`,
    );

    await agente.put(`/api/favoritos/Flash/${conInteres}`);
    await agente.put(`/api/favoritos/Flash/${sinInteres}`);
    await agente.put(`/api/favoritos/Empresa/${rows[0]!.id_ec}`);

    const lista = (await agente.get('/api/favoritos')).body as { titulo: string; en_intereses: boolean; categorias: { nombre: string }[] }[];
    const porTitulo = Object.fromEntries(lista.map((f) => [f.titulo, f]));
    expect(porTitulo['Flash de tecnología']).toMatchObject({ en_intereses: true, categorias: [{ nombre: 'Tecnología' }] });
    expect(porTitulo['Flash sin categorías']!.en_intereses).toBe(false);
    expect(porTitulo['Empresa de comercio']).toMatchObject({ en_intereses: true, categorias: [{ nombre: 'Comercio' }] });
  });

  it('no deja guardar lo que no existe o no se puede ver, y cada uno ve solo los suyos', async () => {
    const { agente: uno } = await sesion('Usuario');
    const { agente: otro } = await sesion('Gestor Tendencias');
    const inactivo = await crearFlash('Flash inactivo', 'Inactivo');
    const activo = await crearFlash('Flash compartido');

    expect((await uno.put(`/api/favoritos/Flash/${inactivo}`)).status).toBe(404);
    expect((await uno.put('/api/favoritos/Flash/999999')).status).toBe(404);
    expect((await uno.put(`/api/favoritos/Otro/${activo}`)).status).toBe(400);

    await uno.put(`/api/favoritos/Flash/${activo}`);
    expect((await otro.get('/api/favoritos/claves')).body).toEqual([]);
    expect((await otro.put(`/api/favoritos/Flash/${activo}`)).status).toBe(200);
    expect((await otro.get('/api/favoritos/claves')).body).toEqual([`Flash:${activo}`]);
  });

  it('el invitado no tiene favoritos', async () => {
    expect((await invitado().get('/api/favoritos')).status).toBe(401);
    expect((await invitado().put('/api/favoritos/Flash/1')).status).toBe(401);
  });
});
