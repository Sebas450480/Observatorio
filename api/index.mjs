/**
 * Función de Vercel que atiende toda la API (/api/*) con la aplicación Express del backend.
 * El backend se compila antes (npm run build en backend/, ver vercel.json).
 */
import { crearApp } from '../backend/dist/app.js';

export default crearApp();
