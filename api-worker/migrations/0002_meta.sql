-- Datos de operación del Worker (p. ej. el resultado del último snapshot).
CREATE TABLE IF NOT EXISTS meta (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  actualizado TEXT NOT NULL
);
