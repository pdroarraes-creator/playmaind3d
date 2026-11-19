/* Checagem estática entre módulos (ferramenta do ambiente, NÃO dependência do repo).
 * ESLint viene instalado globalmente en el entorno cloud de Claude (como Playwright);
 * el repo no tiene npm.
 *
 * Correr SIEMPRE desde la raíz del repo (desde otro directorio ESLint ignora los
 * archivos en silencio):
 *     eslint -c scripts/eslint.config.mjs app/js/*.js
 *
 * Salida esperada: exactamente 3 errores `no-undef` por `copy` (bug latente conocido:
 * `copy(...)` se llama 2 veces en radar.js y 1 en ajustes.js pero no está definida en
 * ningún lado; NO se corrige acá). Cualquier otra cosa significa un `import`/`export`
 * faltante o una asignación a un binding importado.
 */
export default [{files:["**/*.js"],languageOptions:{ecmaVersion:2022,sourceType:"module",globals:{window:"readonly",document:"readonly",localStorage:"readonly",navigator:"readonly",fetch:"readonly",FileReader:"readonly",Image:"readonly",confirm:"readonly",alert:"readonly",setTimeout:"readonly",clearTimeout:"readonly",setInterval:"readonly",clearInterval:"readonly",console:"readonly",location:"readonly",indexedDB:"readonly",Blob:"readonly",URL:"readonly",Promise:"readonly",Calculo:"readonly",Presupuesto:"readonly",migrarPresupuestos:"readonly",siguienteNumero:"readonly",reservarNumero:"readonly",confirmarNumero:"readonly",comoEntregar:"readonly",despuesDeCompartir:"readonly",numeroTxt:"readonly",fechaTxt:"readonly",armarPresupuesto:"readonly",nombreArchivo:"readonly",registrar:"readonly",textoCompartir:"readonly",dinero:"readonly",cargarImagen:"readonly",generarPdf:"readonly",history:"readonly",prompt:"readonly",FormData:"readonly",Notification:"readonly",requestAnimationFrame:"readonly",AbortController:"readonly",caches:"readonly",crypto:"readonly",atob:"readonly",btoa:"readonly",screen:"readonly",getComputedStyle:"readonly",matchMedia:"readonly",open:"readonly",print:"readonly",Event:"readonly",CustomEvent:"readonly",MutationObserver:"readonly",IntersectionObserver:"readonly",sessionStorage:"readonly",URLSearchParams:"readonly",TextEncoder:"readonly",Intl:"readonly",jspdf:"readonly",queueMicrotask:"readonly",structuredClone:"readonly",performance:"readonly",HTMLElement:"readonly",File:"readonly",Headers:"readonly",DOMParser:"readonly",XMLHttpRequest:"readonly",Option:"readonly",self:"readonly"}},rules:{"no-undef":"error","no-import-assign":"error","no-const-assign":"error"}}];
