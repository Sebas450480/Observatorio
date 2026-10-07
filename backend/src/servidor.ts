import { config } from './config.js';
import { crearApp } from './app.js';
import { cerrarPool } from './db/pool.js';
import { programarAlertas } from './servicios/alertas.js';

const app = crearApp();

const servidor = app.listen(config.puerto, () => {
  console.info(`API del Observatorio Empresarial en http://localhost:${config.puerto}/api`);
  console.info(`Documentación: http://localhost:${config.puerto}/api/docs`);
});

const tareas = config.alertas.activas ? programarAlertas() : [];

async function apagar(senal: string) {
  console.info(`${senal} recibido, cerrando...`);
  tareas.forEach((t) => t.stop());
  servidor.close(async () => {
    await cerrarPool();
    process.exit(0);
  });
}

process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));
