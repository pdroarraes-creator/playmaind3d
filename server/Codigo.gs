/**
 * PlayMind 3d — servidor único
 * =====================================================================
 * Un solo archivo: datos de la app, catálogo público y radar de tendencias.
 *
 * INSTALACIÓN (una vez)
 * 1. Abrir la planilla "PlayMind3D - Base de datos".
 * 2. Extensiones > Apps Script. Borrar TODO (los dos archivos viejos) y
 *    pegar este. Dejar un solo archivo.
 * 3. Guardar. Ejecutar "instalar" una vez y autorizar los permisos.
 * 4. Recargar la planilla: aparece el menú "PlayMind 3d" arriba.
 *    Desde ahí se cargan las personas que pueden entrar y sus claves.
 *    Las claves NO se escriben en este archivo nunca más.
 * 5. Implementar > Nueva implementación > Aplicación web
 *      Ejecutar como: yo
 *      Quién tiene acceso: cualquier usuario
 * 6. Copiar la URL /exec y pegarla en el sitio (index.html del sistema).
 *
 * CADA VEZ QUE CAMBIES ESTE CÓDIGO:
 *    Implementar > Administrar implementaciones > lápiz > Versión: NUEVA.
 *    Guardar no alcanza.
 * =====================================================================
 */

/* ============ QUIÉN PUEDE ENTRAR AL SISTEMA ============
   Las claves ya NO están en este archivo. Se guardan hasheadas en las
   Propiedades del Script, que no viajan a GitHub ni se ven en el código.

   Todo se maneja desde la planilla, con el menú "PlayMind 3d":
     · Dar acceso o cambiar clave   — carga una persona nueva o le cambia la clave
     · Ver quién tiene acceso       — lista los mails habilitados
     · Sacar el acceso a alguien    — lo elimina
     · Cerrar todas las sesiones    — obliga a todos a entrar de nuevo

   Cambiar personas o claves NO necesita volver a implementar el servidor.  */

var PROP_USUARIOS = 'usuarios';   // clave donde viven los usuarios
var PROP_SESION   = 'ses:';       // prefijo de cada sesión abierta
var SESION_DIAS   = 90;           // cuánto dura una sesión antes de pedir la clave

/* ============ RADAR DE TENDENCIAS (opcional) ============ */
var ML_CLIENT_ID = '';
var ML_CLIENT_SECRET = '';
var THINGIVERSE_TOKEN = '';

var RUBROS = [
  { sitio: 'MLA', pais: 'Argentina', categoria: 'MLA1132', rubro: 'Juguetes' },
  { sitio: 'MLA', pais: 'Argentina', categoria: 'MLA1574', rubro: 'Hogar y deco' },
  { sitio: 'MLB', pais: 'Brasil',    categoria: 'MLB1132', rubro: 'Juguetes' },
  { sitio: 'MLB', pais: 'Brasil',    categoria: 'MLB1574', rubro: 'Hogar y deco' }
];
var VIGILAR = ['fidget', 'juguete antiestres', 'impresion 3d', 'llavero personalizado'];

/* ============ hojas ============ */
var HOJA_DATOS  = 'datos';
var HOJA_VENTAS = 'ventas';
var HOJA_PIEZAS = 'piezas';
var HOJA_STOCK  = 'stock';
var H_TEND  = 'tendencias';
var H_HIST  = 'tendencias_historico';
var H_MUNDO = 'tendencias_mundo';
var CLAVE = 'estado';

function instalar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  hoja_(ss, HOJA_DATOS,  ['clave', 'json', 'actualizado']);
  hoja_(ss, HOJA_VENTAS, ['fecha', 'cliente', 'canal', 'pieza', 'cantidad',
    'precio unitario', 'costo unitario', 'total linea', 'cobrada', 'entregada']);
  hoja_(ss, HOJA_PIEZAS, ['pieza', 'categoria', 'descripcion', 'modelo / ID', 'filamento',
    'peso g', 'tiempo h', 'costo', 'precio', 'margen', 'precio mercado']);
  hoja_(ss, HOJA_STOCK,  ['tipo', 'nombre', 'queda', 'unidad', 'paquete entero', 'costo unitario']);
  hoja_(ss, H_TEND,  ['semana', 'pais', 'rubro', 'puesto', 'termino', 'movimiento',
    'puesto anterior', 'precio mediano', 'anuncios', 'que significa']);
  hoja_(ss, H_HIST,  ['semana', 'pais', 'rubro', 'puesto', 'termino']);
  hoja_(ss, H_MUNDO, ['semana', 'fuente', 'puesto', 'modelo', 'creador', 'me gusta', 'link']);
  return 'Listo. Ahora publicá la app web.';
}

function hoja_(ss, nombre, cols) {
  var h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  h.setFrozenRows(1);
  return h;
}

/* =====================================================================
   ENTRADA
   ===================================================================== */

function doGet(e) {
  var p = (e && e.parameter) || {};

  // El catálogo es público a propósito: lo lee la página de ventas.
  // Sale sólo nombre, foto, descripción y precio. Nunca costos ni ventas.
  if (p.action === 'catalogo') return json_({ ok: true, catalogo: catalogoPublico_() });

  // Todo lo demás es privado y viaja por POST, para que ni la clave ni el
  // token queden escritos en la URL (las URLs se guardan en los registros).
  return json_({ ok: false, error: 'usar POST' });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // Entrar: única vez que viaja la clave. Devuelve un token de sesión.
    if (body.action === 'login') {
      var quien = verificarClave_(body.email, body.clave || body.key || body.token);
      if (!quien) return json_({ ok: false, error: 'clave' });
      return json_({
        ok: true,
        usuario: quien.nombre || quien.email || '',
        token: crearSesion_(quien.email)
      });
    }

    // Salir: cierra sólo esta sesión.
    if (body.action === 'logout') {
      cerrarSesion_(body.token);
      return json_({ ok: true });
    }

    // De acá para abajo hace falta un token de sesión válido.
    var u = porSesion_(body.token);
    if (!u) return json_({ ok: false, error: 'clave' });

    if (body.action === 'load')  return json_({ ok: true, data: leerEstado_() });
    if (body.action === 'mundo') return json_({ ok: true, mundo: leerMundo_() });
    if (body.action === 'editarPieza') {
      return json_(editarPieza_(body.pieza, body.campos));
    }
    // Sólo confirma que el token todavía sirve — la usa el Worker del chat de
    // cadastro para no tener que reimplementar la verificación de sesión.
    if (body.action === 'validarSesion') return json_({ ok: true });
    if (body.action === 'agregarPieza') {
      return json_(agregarPieza_(body.pieza));
    }
    if (body.action === 'agregarFilamento') {
      return json_(agregarFilamento_(body.filamento));
    }
    if (body.action === 'resumenNegocio') {
      return json_(resumenNegocio_());
    }
    if (body.action === 'save') {
      var limpio = guardarEstado_(body.data);
      return json_({ ok: true, actualizado: new Date().toISOString(), data: limpio });
    }
    return json_({ ok: false, error: 'accion desconocida' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* =====================================================================
   ACCESOS: claves hasheadas y sesiones
   Nada de esto se escribe en el código ni en la planilla.
   ===================================================================== */

function props_() { return PropertiesService.getScriptProperties(); }

function normMail_(x) { return String(x || '').trim().toLowerCase(); }

/** Hash de la clave. La sal es distinta por persona: dos claves iguales
    no producen el mismo hash, y el hash no se puede volver para atrás. */
function hash_(clave, sal) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(sal) + '|' + String(clave), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join('');
}

function leerUsuarios_() {
  try { return JSON.parse(props_().getProperty(PROP_USUARIOS) || '[]'); }
  catch (err) { return []; }
}

function escribirUsuarios_(lista) {
  props_().setProperty(PROP_USUARIOS, JSON.stringify(lista));
}

/** Devuelve el usuario si el mail y la clave coinciden. Sólo se usa al entrar. */
function verificarClave_(email, clave) {
  email = normMail_(email);
  clave = String(clave || '');
  if (!email || !clave) return null;
  var out = null;
  leerUsuarios_().forEach(function (u) {
    if (normMail_(u.email) === email && u.hash === hash_(clave, u.sal)) out = u;
  });
  return out;
}

/** Abre una sesión y devuelve su token. Aprovecha para limpiar las vencidas. */
function crearSesion_(email) {
  limpiarSesiones_();
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var vence = Date.now() + SESION_DIAS * 24 * 60 * 60 * 1000;
  props_().setProperty(PROP_SESION + token, JSON.stringify({ email: normMail_(email), vence: vence }));
  return token;
}

/** Devuelve el usuario dueño del token, o null si no vale o ya venció. */
function porSesion_(token) {
  token = String(token || '');
  if (!token) return null;
  var crudo = props_().getProperty(PROP_SESION + token);
  if (!crudo) return null;
  var ses;
  try { ses = JSON.parse(crudo); } catch (err) { return null; }
  if (!ses || !ses.vence || Date.now() > ses.vence) {
    props_().deleteProperty(PROP_SESION + token);
    return null;
  }
  var out = null;
  leerUsuarios_().forEach(function (u) { if (normMail_(u.email) === ses.email) out = u; });
  return out;   // si al usuario le sacaron el acceso, la sesión deja de servir
}

function cerrarSesion_(token) {
  if (token) props_().deleteProperty(PROP_SESION + String(token));
}

function limpiarSesiones_() {
  var todas = props_().getProperties();
  var ahora = Date.now();
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf(PROP_SESION) !== 0) return;
    try {
      var ses = JSON.parse(todas[k]);
      if (!ses || !ses.vence || ahora > ses.vence) props_().deleteProperty(k);
    } catch (err) { props_().deleteProperty(k); }
  });
}

/* ============ MENÚ EN LA PLANILLA ============ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PlayMind 3d')
    .addItem('Dar acceso o cambiar clave', 'menuAlta')
    .addItem('Ver quién tiene acceso', 'menuLista')
    .addItem('Sacar el acceso a alguien', 'menuBaja')
    .addSeparator()
    .addItem('Cerrar todas las sesiones', 'menuCerrarSesiones')
    .addToUi();
}

function menuAlta() {
  var ui = SpreadsheetApp.getUi();
  var r1 = ui.prompt('Mail de la persona', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var email = normMail_(r1.getResponseText());
  if (!email) { ui.alert('Falta el mail.'); return; }

  var r2 = ui.prompt('Nombre (como la saluda el sistema)', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;

  var r3 = ui.prompt('Clave nueva (mínimo 4 caracteres, distinta para cada persona)',
                     ui.ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== ui.Button.OK) return;
  var clave = String(r3.getResponseText() || '');
  if (clave.length < 4) { ui.alert('Esa clave es muy corta. Mínimo 4 caracteres.'); return; }

  var sal = Utilities.getUuid();
  var lista = leerUsuarios_().filter(function (u) { return normMail_(u.email) !== email; });
  lista.push({ email: email, nombre: r2.getResponseText().trim(), sal: sal, hash: hash_(clave, sal) });
  escribirUsuarios_(lista);
  ui.alert('Listo. ' + email + ' ya puede entrar.\n\nLa clave no queda escrita en ningún lado: ' +
           'si se pierde, se carga una nueva desde este mismo menú.');
}

function menuLista() {
  var lista = leerUsuarios_();
  if (!lista.length) { SpreadsheetApp.getUi().alert('Todavía no hay nadie cargado.'); return; }
  SpreadsheetApp.getUi().alert('Tienen acceso:\n\n' + lista.map(function (u) {
    return '· ' + u.email + (u.nombre ? '  (' + u.nombre + ')' : '');
  }).join('\n'));
}

function menuBaja() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Mail de quien pierde el acceso', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var email = normMail_(r.getResponseText());
  var antes = leerUsuarios_();
  var despues = antes.filter(function (u) { return normMail_(u.email) !== email; });
  if (antes.length === despues.length) { ui.alert('No encontré ese mail.'); return; }
  escribirUsuarios_(despues);
  ui.alert(email + ' ya no puede entrar. Sus sesiones abiertas dejan de servir enseguida.');
}

function menuCerrarSesiones() {
  var todas = props_().getProperties();
  var n = 0;
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf(PROP_SESION) === 0) { props_().deleteProperty(k); n++; }
  });
  SpreadsheetApp.getUi().alert('Cerré ' + n + ' sesión(es). Todos tienen que entrar de nuevo.');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =====================================================================
   DATOS DE LA APP
   ===================================================================== */

function leerEstado_() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_DATOS);
  if (!h) return null;
  var filas = Math.max(h.getLastRow() - 1, 1);
  var v = h.getRange(2, 1, filas, 2).getValues();
  var out = null;
  v.forEach(function (row) {
    if (row[0] === CLAVE && row[1] && !out) {
      try { out = JSON.parse(row[1]); } catch (err) { out = null; }
    }
  });
  return out;
}

function guardarEstado_(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var h = ss.getSheetByName(HOJA_DATOS) || hoja_(ss, HOJA_DATOS, ['clave', 'json', 'actualizado']);

    data = moverFotosADrive_(data);
    // el token de sesión es del navegador, no del negocio: no se archiva
    if (data && data.cfg) { data.cfg.token = ''; data.cfg.key = ''; }
    var txt = JSON.stringify(data);

    var filas = Math.max(h.getLastRow() - 1, 1);
    var v = h.getRange(2, 1, filas, 1).getValues();
    var fila = 0;
    v.forEach(function (row, i) { if (row[0] === CLAVE && !fila) fila = i + 2; });
    if (!fila) fila = h.getLastRow() + 1;
    h.getRange(fila, 1, 1, 3).setValues([[CLAVE, txt, new Date()]]);

    volcarVentas_(ss, data);
    volcarPiezas_(ss, data);
    volcarStock_(ss, data);
    return data;   // con las fotos ya convertidas en links
  } finally {
    lock.releaseLock();
  }
}

/** Cambia sólo los textos de vitrina de una pieza. No toca costos ni precios. */
function editarPieza_(nombre, campos) {
  var permitidos = ['desc', 'detalle', 'medida', 'tags', 'cat'];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var data = leerEstado_();
    if (!data || !data.produtos) return { ok: false, error: 'sin datos' };
    var norm = function (x) {
      return String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    };
    var p = null;
    data.produtos.forEach(function (x) { if (norm(x.nome) === norm(nombre)) p = x; });
    if (!p) return { ok: false, error: 'pieza no encontrada' };

    permitidos.forEach(function (k) {
      if (campos && campos[k] !== undefined) p[k] = String(campos[k]);
    });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var h = ss.getSheetByName(HOJA_DATOS);
    var filas = Math.max(h.getLastRow() - 1, 1);
    var v = h.getRange(2, 1, filas, 1).getValues();
    var fila = 0;
    v.forEach(function (row, i) { if (row[0] === CLAVE && !fila) fila = i + 2; });
    if (!fila) fila = h.getLastRow() + 1;
    h.getRange(fila, 1, 1, 3).setValues([[CLAVE, JSON.stringify(data), new Date()]]);
    volcarPiezas_(ss, data);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Agrega una pieza nueva (usada por el cadastro por chat, Worker externo).
    No toma lock propio: guardarEstado_ ya toma el suyo — tomar dos locks acá
    (uno propio y el de adentro) se pisaría con el que ya tiene editarPieza_. */
function agregarPieza_(pieza) {
  if (!pieza || !String(pieza.nome || '').trim()) {
    return { ok: false, error: 'falta el nombre' };
  }
  var data = leerEstado_();
  if (!data) return { ok: false, error: 'sin datos' };
  data.produtos = data.produtos || [];
  var fil = (data.filamentos || [])[0];
  var imp = (data.impressoras || [])[0];
  var fotos = pieza.fotos || (pieza.foto ? [pieza.foto] : []);
  var p = {
    id: Utilities.getUuid(),
    nome: String(pieza.nome).trim(),
    ref: '',
    foto: fotos[0] || null,
    fotos: fotos,
    fil: pieza.fil || (fil && fil.id) || null,
    imp: pieza.imp || (imp && imp.id) || null,
    peso: Number(pieza.peso) || 0,
    h: Number(pieza.h) || 0,
    m: Number(pieza.m) || 0,
    mo: Number(pieza.mo) || 0,
    insumos: pieza.insumos || {},
    risco: null,
    mult: null,
    cplx: Number(pieza.cplx) || 1,
    manual: pieza.manual != null && pieza.manual !== '' ? Number(pieza.manual) : null,
    mercado: null,
    cat: String(pieza.cat || '').trim(),
    desc: String(pieza.desc || '').trim(),
    libre: !!pieza.libre,
    medida: String(pieza.medida || '').trim(),
    video: '',
    detalle: String(pieza.detalle || '').trim(),
    tags: String(pieza.tags || '').trim()
  };
  data.produtos.push(p);
  guardarEstado_(data); // sube la foto a Drive, guarda y regenera las hojas
  return { ok: true, id: p.id };
}

/** Agrega un filamento nuevo (usado por el Agente, a partir de una foto de
    la caja). OJO: la foto de la caja NUNCA se guarda acá — sólo sirve para
    que el modelo lea marca/tipo/color una vez; guardarla rompería el límite
    de 50.000 caracteres de la celda de Sheets (moverFotosADrive_ tampoco
    sabe procesar fotos de filamento, sólo de piezas/logo/leti). */
function agregarFilamento_(fil) {
  if (!fil || !String(fil.nome || '').trim()) {
    return { ok: false, error: 'falta el nombre/tipo' };
  }
  var data = leerEstado_();
  if (!data) return { ok: false, error: 'sin datos' };
  data.filamentos = data.filamentos || [];
  var rollo = Number(fil.rollo) || 1000;
  var f = {
    id: Utilities.getUuid(),
    marca: String(fil.marca || '').trim(),
    nome: String(fil.nome || '').trim(),
    cor: String(fil.cor || '').trim(),
    hex: String(fil.hex || '#CFC3AE'),
    precoKg: Number(fil.precoKg) || 0,
    rollo: rollo,
    stock: rollo,
  };
  data.filamentos.push(f);
  guardarEstado_(data);
  return { ok: true, id: f.id };
}

/** Resumen liviano del negocio (piezas, filamentos, insumos, ventas) para
    que el Agente pueda responder preguntas sin mandar el estado completo
    (que trae cosas irrelevantes para eso, como tokens de sesión y textos de
    catálogo). */
function resumenNegocio_() {
  var data = leerEstado_();
  if (!data) return { ok: false, error: 'sin datos' };
  var n = function (x) { x = parseFloat(x); return isFinite(x) ? x : 0; };

  var piezas = (data.produtos || []).map(function (p) {
    var r = calcular_(p, data);
    return {
      nome: p.nome || '',
      cat: p.cat || '',
      stock: n(p.stock),
      custo: Math.round(r.custo),
      preco: Math.round(r.preco),
      margen_pct: r.preco ? Math.round((r.preco - r.custo) / r.preco * 100) : 0
    };
  });

  // rollo_g y paquete van al lado del stock para que la Mind pueda sacar el
  // porcentaje que queda. La regla de cuándo eso es poco vive en el prompt,
  // no duplicada acá: alertasStock() del cliente ya es la fuente de verdad.
  var filamentos = (data.filamentos || []).map(function (f) {
    return {
      nome: ((f.marca || '') + ' ' + (f.nome || '') + (f.cor ? ' - ' + f.cor : '')).trim(),
      stock_g: n(f.stock),
      rollo_g: n(f.rollo) || 1000,
      precoKg: n(f.precoKg)
    };
  });

  var insumos = (data.insumos || []).map(function (i) {
    return { nome: i.nome || '', stock: n(i.stock), paquete: n(i.unid) || 1 };
  });

  var canales = {};
  (data.canais || []).forEach(function (c) { canales[c.id] = c.nome; });

  var ahora = new Date();
  var tz = Session.getScriptTimeZone();
  var mesActual = Utilities.formatDate(ahora, tz, 'yyyy-MM');
  var mesPasado = Utilities.formatDate(
    new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1), tz, 'yyyy-MM');

  var totalesDe = function (mes) {
    var t = { mes: mes, facturado: 0, ganancia: 0, ventas: 0 };
    (data.vendas || []).forEach(function (v) {
      if (String(v.data || '').slice(0, 7) !== mes) return;
      t.facturado += n(v.total);
      t.ganancia += n(v.lucro);
      t.ventas++;
    });
    t.facturado = Math.round(t.facturado);
    t.ganancia = Math.round(t.ganancia);
    return t;
  };

  var pendiente = 0, sinEntregar = 0;
  (data.vendas || []).forEach(function (v) {
    if (!v.pago) pendiente += n(v.total);
    if (!v.entregue) sinEntregar++;
  });

  var recientes = (data.vendas || []).slice(0, 20).map(function (v) {
    return {
      data: v.data || '',
      cliente: v.cliente || '',
      canal: canales[v.canal] || '',
      forma: v.forma || '',
      total: Math.round(n(v.total)),
      lucro: Math.round(n(v.lucro)),
      pago: !!v.pago,
      entregue: !!v.entregue,
      itens: (v.itens || []).map(function (i) { return n(i.qtd) + 'x ' + (i.nome || ''); }).join(', ')
    };
  });

  // Lo anotado para imprimir que todavía no se imprimió.
  var porId = {};
  (data.produtos || []).forEach(function (p) { porId[p.id] = p; });
  var pedido = [];
  for (var id in (data.pedido || {})) {
    var q = n(data.pedido[id]);
    if (q > 0 && porId[id]) pedido.push({ nome: porId[id].nome || '', qtd: q });
  }

  return {
    ok: true,
    resumen: {
      piezas: piezas,
      filamentos: filamentos,
      insumos: insumos,
      pedido_a_imprimir: pedido,
      este_mes: totalesDe(mesActual),
      mes_pasado: totalesDe(mesPasado),
      por_cobrar: Math.round(pendiente),
      ventas_sin_entregar: sinEntregar,
      ventas_recientes: recientes
    }
  };
}

/** Las fotos pesadas van a Drive; en la planilla queda sólo el link. */
function moverFotosADrive_(data) {
  if (!data || !data.produtos) return data;
  var carpeta = null;

  function subir(dataUrl, nombreBase) {
    if (!dataUrl || String(dataUrl).indexOf('data:image') !== 0) return dataUrl;
    if (!carpeta) carpeta = carpetaFotos_();
    var partes = String(dataUrl).split(',');
    var tipo = partes[0].indexOf('png') === -1 ? 'image/jpeg' : 'image/png';
    var nombre = String(nombreBase || 'pieza').replace(/[^\w\-]+/g, '_') + '_' +
                 new Date().getTime() + '.jpg';
    var blob = Utilities.newBlob(Utilities.base64Decode(partes[1]), tipo, nombre);
    var f = carpeta.createFile(blob);
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://lh3.googleusercontent.com/d/' + f.getId();
  }

  data.produtos.forEach(function (p) {
    if (p.fotos && p.fotos.length) {
      p.fotos = p.fotos.map(function (f) { return subir(f, p.nome); });
      p.foto = p.fotos[0];
    } else if (p.foto) {
      p.foto = subir(p.foto, p.nome);
    }
  });
  if (data.cfg && data.cfg.logo && String(data.cfg.logo).indexOf('data:image') === 0) {
    data.cfg.logo = subir(data.cfg.logo, 'logo');
  }
  if (data.cfg && data.cfg.leti && data.cfg.leti.foto &&
      String(data.cfg.leti.foto).indexOf('data:image') === 0) {
    data.cfg.leti.foto = subir(data.cfg.leti.foto, 'leti');
  }
  return data;
}

function carpetaFotos_() {
  var nombre = 'PlayMind3D - Fotos';
  var it = DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nombre);
}

/* =====================================================================
   CATÁLOGO PÚBLICO
   ===================================================================== */

function catalogoPublico_() {
  var data = leerEstado_();
  if (!data || !data.produtos) return { marca: '', wa: '', piezas: [] };
  var n = function (x) { x = parseFloat(x); return isFinite(x) ? x : 0; };

  var piezas = [];
  (data.produtos || []).forEach(function (p) {
    if (p.oculta) return;
    var r = calcular_(p, data);
    var fotos = [];
    if (p.fotos && p.fotos.length) fotos = p.fotos;
    else if (p.foto) fotos = [p.foto];
    piezas.push({
      nome: p.nome || '',
      cat: p.cat || '',
      desc: p.desc || '',
      libre: !!p.libre,
      precio: Math.round(r.preco),
      medida: p.medida || '',
      horas: Math.round((n(p.h) + n(p.m) / 60) * 10) / 10,
      video: p.video || '',
      detalle: p.detalle || '',
      tags: p.tags || '',
      stock: n(p.stock),
      vendidas: 0,
      fotos: fotos
    });
  });

  // cuántas se vendieron de cada una, para marcar la más pedida
  var cuenta = {};
  (data.vendas || []).forEach(function (v) {
    (v.itens || []).forEach(function (i) {
      var k = String(i.nome || '');
      cuenta[k] = (cuenta[k] || 0) + n(i.qtd);
    });
  });
  piezas.forEach(function (p) { p.vendidas = cuenta[p.nome] || 0; });

  var colores = [];
  (data.filamentos || []).forEach(function (f) {
    if (!f.cor) return;
    colores.push({ nome: f.cor, hex: f.hex || '' });
  });

  var packs = [];
  (data.packs || []).forEach(function (k) {
    if (!k.nome) return;
    var off = n(k.off);
    if (off > 0) {
      // regla de descuento: se aplica solo en el carrito
      packs.push({
        tipo: 'descuento', nome: k.nome, off: off,
        desde: Math.max(n(k.desde), 2),
        piezas: String(k.piezas || ''),
        desc: k.desc || '', incluye: k.incluye || ''
      });
    } else if (n(k.preco) > 0) {
      packs.push({
        tipo: 'fijo', nome: k.nome, qtd: n(k.qtd), precio: Math.round(n(k.preco)),
        sueltas: Math.round(n(k.sueltas)), incluye: k.incluye || '', desc: k.desc || ''
      });
    }
  });

  var opiniones = [];
  (data.opiniones || []).forEach(function (o) {
    if (o.visible === false || !o.texto) return;
    opiniones.push({ quien: o.quien || '', pieza: o.pieza || '', texto: o.texto });
  });

  return {
    opiniones: opiniones,
    marca: (data.cfg && data.cfg.marca) || 'Play Mind 3d',
    wa: (data.cfg && data.cfg.wa) || '',
    colores: colores,
    packs: packs,
    piezas: piezas,
    leti: {
      cita: (data.cfg && data.cfg.leti && data.cfg.leti.cita) || '',
      historia: (data.cfg && data.cfg.leti && data.cfg.leti.historia) || '',
      foto: (data.cfg && data.cfg.leti && data.cfg.leti.foto) || ''
    }
  };
}

/* =====================================================================
   LA MISMA CUENTA QUE HACE LA APP
   ===================================================================== */

function unitario_(it, n) {
  if (!it) return 0;
  if (it.pack !== undefined && it.pack !== null) return n(it.pack) / Math.max(n(it.unid), 1);
  return n(it.preco);
}

function calcular_(p, data) {
  var c = data.cfg || {};
  var n = function (x) {
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    var v = parseFloat(String(x == null ? '' : x).replace(',', '.'));
    return isFinite(v) ? v : 0;
  };
  var buscar = function (lista, id) {
    var out = null;
    (lista || []).forEach(function (x) { if (x.id === id) out = x; });
    return out;
  };
  var fil = buscar(data.filamentos, p.fil) || { precoKg: 0 };
  var imp = buscar(data.impressoras, p.imp) ||
    { preco: 0, vida: 1, watts: 0, bico: 0, bicoVida: 1, mesa: 0, mesaVida: 1 };

  var hs = n(p.h) + n(p.m) / 60;

  // El desperdicio (soportes y purga) es un porcentaje global, no un campo por pieza.
  var merma = (c.merma === undefined || c.merma === null) ? 12 : n(c.merma);
  var gramos = n(p.peso) * (1 + merma / 100);

  var material = n(fil.precoKg) / 1000 * gramos;
  var luz = n(imp.watts) / 1000 * hs * n(c.kwh);
  var desgaste = (n(imp.preco) / Math.max(n(imp.vida), 1)
    + n(imp.bico) / Math.max(n(imp.bicoVida), 1)
    + n(imp.mesa) / Math.max(n(imp.mesaVida), 1)) * hs;
  var trabajo = n(c.maoObra) * n(p.mo) / 60;

  var insumos = 0;
  for (var k in (p.insumos || {})) {
    var it = buscar(data.insumos, k);
    if (it) insumos += unitario_(it, n) * n(p.insumos[k]);
  }

  var impresion = material + luz + desgaste;
  var riesgo = (p.risco === null || p.risco === undefined ? n(c.risco) : n(p.risco)) / 100;
  var costo = impresion * (1 + riesgo) + trabajo + insumos;

  var mult = (p.mult === null || p.mult === undefined ? n(c.mult) : n(p.mult)) || 1;
  var paso = n(c.round) || 1;
  var precio = p.manual ? n(p.manual) : Math.ceil(costo * mult * (n(p.cplx) || 1) / paso) * paso;
  return { custo: costo, preco: precio, gramos: gramos, horas: hs };
}

/* =====================================================================
   COPIAS LEGIBLES EN LA PLANILLA
   ===================================================================== */

function volcarVentas_(ss, data) {
  var h = ss.getSheetByName(HOJA_VENTAS);
  if (!h) return;
  var canales = {};
  (data.canais || []).forEach(function (c) { canales[c.id] = c.nome; });
  var filas = [];
  (data.vendas || []).forEach(function (v) {
    (v.itens || []).forEach(function (i) {
      filas.push([v.data, v.cliente, canales[v.canal] || '', i.nome, i.qtd,
        i.preco, i.custo, i.preco * i.qtd, v.pago ? 'si' : 'no', v.entregue ? 'si' : 'no']);
    });
  });
  limpiar_(h, 10);
  if (filas.length) h.getRange(2, 1, filas.length, 10).setValues(filas);
}

function volcarPiezas_(ss, data) {
  var h = ss.getSheetByName(HOJA_PIEZAS);
  if (!h) return;
  var fil = {};
  (data.filamentos || []).forEach(function (f) {
    fil[f.id] = ((f.marca || '') + ' ' + (f.nome || '') + (f.cor ? ' - ' + f.cor : '')).trim();
  });
  var filas = (data.produtos || []).map(function (p) {
    var r = calcular_(p, data);
    var margen = r.preco ? (r.preco - r.custo) / r.preco : 0;
    return [p.nome, p.cat || '', p.desc || '', p.ref || '', fil[p.fil] || '',
      Math.round(r.gramos * 10) / 10, Math.round(r.horas * 100) / 100,
      Math.round(r.custo), Math.round(r.preco), margen, p.mercado || ''];
  });
  limpiar_(h, 11);
  if (filas.length) {
    h.getRange(2, 1, filas.length, 11).setValues(filas);
    h.getRange(2, 10, filas.length, 1).setNumberFormat('0%');
  }
}

function volcarStock_(ss, data) {
  var h = ss.getSheetByName(HOJA_STOCK);
  if (!h) return;
  var n = function (x) { x = parseFloat(x); return isFinite(x) ? x : 0; };
  var filas = [];
  (data.filamentos || []).forEach(function (f) {
    var nombre = ((f.marca || '') + ' ' + (f.nome || '') + (f.cor ? ' - ' + f.cor : '')).trim();
    filas.push(['filamento', nombre, n(f.stock), 'g', n(f.rollo) || 1000, n(f.precoKg) / 1000]);
  });
  (data.insumos || []).forEach(function (i) {
    filas.push(['insumo', i.nome, n(i.stock), 'un', n(i.unid) || 1, unitario_(i, n)]);
  });
  limpiar_(h, 6);
  if (filas.length) h.getRange(2, 1, filas.length, 6).setValues(filas);
}

function limpiar_(h, cols) {
  var ultima = h.getLastRow();
  if (ultima >= 2) h.getRange(2, 1, ultima - 1, cols).clearContent();
}

/* =====================================================================
   RADAR DE TENDENCIAS
   ===================================================================== */

function instalarRadar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'correrRadar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('correrRadar').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  return 'Radar instalado. Corre todos los lunes a las 7.';
}

function correrRadar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var semana = semanaDeHoy_();
  var filas = [];

  var token = tokenML_();
  if (token) {
    RUBROS.forEach(function (r) {
      var lista = tendenciasML_(token, r.sitio, r.categoria);
      var previo = puestosAnteriores_(ss, r.pais, r.rubro);
      lista.slice(0, 20).forEach(function (t, i) {
        var puesto = i + 1;
        var antes = previo[t.keyword.toLowerCase()];
        var mov = movimiento_(puesto, antes);
        var mercado = precioYOferta_(r.sitio, t.keyword);
        filas.push([semana, r.pais, r.rubro, puesto, t.keyword, mov.texto,
          antes || '', mercado.mediano || '', mercado.anuncios || '', mov.lectura]);
      });
      guardarHistorico_(ss, semana, r.pais, r.rubro, lista.slice(0, 20));
      Utilities.sleep(400);
    });

    VIGILAR.forEach(function (termino) {
      ['MLA', 'MLB'].forEach(function (sitio) {
        var m = precioYOferta_(sitio, termino);
        filas.push([semana, sitio === 'MLA' ? 'Argentina' : 'Brasil', 'Vigilados', '', termino,
          '', '', m.mediano || '', m.anuncios || '',
          m.anuncios > 500 ? 'Mucha competencia' : 'Poca competencia, hay lugar']);
        Utilities.sleep(300);
      });
    });
  }

  var h = ss.getSheetByName(H_TEND) || hoja_(ss, H_TEND, []);
  limpiar_(h, 10);
  if (filas.length) h.getRange(2, 1, filas.length, 10).setValues(filas);

  radarMundo_(ss, semana);
  return 'Radar actualizado: ' + filas.length + ' filas.';
}

function tokenML_() {
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) return null;
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('ml_token');
  if (guardado) return guardado;
  try {
    var r = UrlFetchApp.fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: { grant_type: 'client_credentials', client_id: ML_CLIENT_ID, client_secret: ML_CLIENT_SECRET },
      muteHttpExceptions: true
    });
    var j = JSON.parse(r.getContentText());
    if (!j.access_token) { Logger.log('ML sin token: ' + r.getContentText()); return null; }
    cache.put('ml_token', j.access_token, 5 * 60 * 60);
    return j.access_token;
  } catch (e) { Logger.log('ML error de token: ' + e); return null; }
}

function tendenciasML_(token, sitio, categoria) {
  var url = 'https://api.mercadolibre.com/trends/' + sitio + (categoria ? '/' + categoria : '');
  try {
    var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) { Logger.log('trends ' + sitio + ': ' + r.getContentText()); return []; }
    var j = JSON.parse(r.getContentText());
    return Array.isArray(j) ? j : [];
  } catch (e) { Logger.log('trends error: ' + e); return []; }
}

function precioYOferta_(sitio, termino) {
  try {
    var url = 'https://api.mercadolibre.com/sites/' + sitio + '/search?q=' +
      encodeURIComponent(termino) + '&limit=50';
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return {};
    var j = JSON.parse(r.getContentText());
    var precios = (j.results || []).map(function (x) { return Number(x.price); })
      .filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    if (!precios.length) return { anuncios: (j.paging || {}).total || 0 };
    var medio = precios.length % 2
      ? precios[(precios.length - 1) / 2]
      : (precios[precios.length / 2 - 1] + precios[precios.length / 2]) / 2;
    return { mediano: Math.round(medio), anuncios: (j.paging || {}).total || 0 };
  } catch (e) { return {}; }
}

function radarMundo_(ss, semana) {
  if (!THINGIVERSE_TOKEN) return;
  try {
    var r = UrlFetchApp.fetch('https://api.thingiverse.com/popular?access_token=' +
      encodeURIComponent(THINGIVERSE_TOKEN), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) { Logger.log('thingiverse: ' + r.getContentText()); return; }
    var j = JSON.parse(r.getContentText());
    var lista = Array.isArray(j) ? j : (j.hits || []);
    var filas = lista.slice(0, 30).map(function (t, i) {
      return [semana, 'Thingiverse', i + 1, t.name || '',
        (t.creator || {}).name || '', t.like_count || '', t.public_url || ''];
    });
    var h = ss.getSheetByName(H_MUNDO);
    if (!h) return;
    limpiar_(h, 7);
    if (filas.length) h.getRange(2, 1, filas.length, 7).setValues(filas);
  } catch (e) { Logger.log('thingiverse error: ' + e); }
}

function leerMundo_() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_MUNDO);
  if (!h || h.getLastRow() < 2) return [];
  var v = h.getRange(2, 1, h.getLastRow() - 1, 7).getValues();
  var out = [];
  v.forEach(function (f) {
    if (!f[3]) return;
    out.push({ semana: String(f[0]), fuente: f[1], puesto: f[2],
               nome: f[3], creador: f[4], likes: f[5], link: f[6] });
  });
  return out.slice(0, 40);
}

function puestosAnteriores_(ss, pais, rubro) {
  var h = ss.getSheetByName(H_HIST);
  var mapa = {};
  if (!h || h.getLastRow() < 2) return mapa;
  var v = h.getRange(2, 1, h.getLastRow() - 1, 5).getValues();
  var semanas = {};
  v.forEach(function (f) { if (f[1] === pais && f[2] === rubro) semanas[f[0]] = true; });
  var ultima = Object.keys(semanas).sort().pop();
  if (!ultima) return mapa;
  v.forEach(function (f) {
    if (f[0] === ultima && f[1] === pais && f[2] === rubro) mapa[String(f[4]).toLowerCase()] = f[3];
  });
  return mapa;
}

function guardarHistorico_(ss, semana, pais, rubro, lista) {
  var h = ss.getSheetByName(H_HIST);
  if (!h) return;
  var filas = lista.map(function (t, i) { return [semana, pais, rubro, i + 1, t.keyword]; });
  if (filas.length) h.getRange(h.getLastRow() + 1, 1, filas.length, 5).setValues(filas);
  var limite = 12 * 20 * RUBROS.length;
  if (h.getLastRow() - 1 > limite) h.deleteRows(2, h.getLastRow() - 1 - limite);
}

function movimiento_(ahora, antes) {
  if (!antes) return { texto: 'NUEVO', lectura: 'Apareció esta semana. Es lo más interesante de mirar.' };
  var d = antes - ahora;
  if (d >= 5) return { texto: 'SUBE ' + d, lectura: 'Viene subiendo fuerte.' };
  if (d > 0)  return { texto: 'sube ' + d, lectura: 'Sube despacio.' };
  if (d === 0) return { texto: 'igual', lectura: 'Se mantiene.' };
  return { texto: 'baja ' + (-d), lectura: 'Está perdiendo interés.' };
}

function semanaDeHoy_() {
  var d = new Date();
  var jueves = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + 3);
  var primero = new Date(jueves.getFullYear(), 0, 4);
  var n = 1 + Math.round(((jueves - primero) / 86400000 - 3 + ((primero.getDay() + 6) % 7)) / 7);
  return jueves.getFullYear() + '-S' + (n < 10 ? '0' + n : n);
}
