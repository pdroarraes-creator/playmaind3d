// Prueba fotoBase64_ de server/Codigo.gs con DriveApp y Utilities simulados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");

function cargar(archivos) {
  const ctx = {
    DriveApp: {
      getFileById(id) {
        if (!archivos[id]) throw new Error("No existe");
        const a = archivos[id];
        return { getMimeType: () => a.mime, getBlob: () => ({ getBytes: () => a.bytes }) };
      },
    },
    Utilities: { base64Encode: (b) => Buffer.from(b).toString("base64") },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../server/Codigo.gs", "utf8"), ctx);
  return ctx;
}

test("foto devuelve la imagen en base64", () => {
  const g = cargar({ abc: { mime: "image/png", bytes: [1, 2, 3] } });
  assert.deepEqual(JSON.parse(JSON.stringify(g.fotoBase64_("abc"))), { ok: true, mime: "image/png", b64: "AQID" });
});

test("foto rechaza lo que no es imagen", () => {
  const g = cargar({ hoja: { mime: "application/vnd.google-apps.spreadsheet", bytes: [] } });
  assert.equal(g.fotoBase64_("hoja").error, "no-imagen");
});

test("foto de id inexistente", () => {
  const g = cargar({});
  assert.equal(g.fotoBase64_("nada").error, "no-existe");
});
