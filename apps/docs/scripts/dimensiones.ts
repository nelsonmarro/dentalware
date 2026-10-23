import { DIMENSIONES_JSON, regenerarDimensiones } from '../capturas/dimensiones'

// Rehace `static/img/capturas/dimensiones.json` desde los PNG que hay (la tubería ya lo mantiene al
// capturar; esto sirve tras borrar o renombrar capturas a mano).
regenerarDimensiones()
console.log(`Escrito ${DIMENSIONES_JSON}`)
