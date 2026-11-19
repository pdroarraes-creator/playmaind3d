-- Estado completo de la app: una fila, clave 'estado'. `v` es el número de
-- versión que usa el lock optimista (ver src/estado.js).
CREATE TABLE IF NOT EXISTS estado (
  clave TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  v INTEGER NOT NULL,
  actualizado TEXT NOT NULL
);
