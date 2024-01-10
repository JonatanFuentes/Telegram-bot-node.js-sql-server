const sql = require('mssql'); //Trabajar con SQL Server
const TelegramBot = require('node-telegram-bot-api'); //Api para interactuar con bot de telegram
const moment = require('moment-timezone'); //Workear con fecha y hora


const nombresDeSector = {
  1: 'Copiapó',
  2: 'Chañaral',
  3: 'Vallenar'
};

const nombresDePlanta = {
  10: 'Vicuña',
  11: 'Cancha Rayada',
  12: 'Cartavio',
  13: 'Santa Inés',
  14: 'El Salado'
};

//configuracion para la conexion de la base de datos sql server
const config = {
  user: 'adminsql',
  password: 'Megalodon_2001',
  server: 'servidortestsql.database.windows.net',
  database: 'BDTest',
  options: {
    encrypt: true, 
    enableArithAbort: true,
  },
};
//Objeto del bot
const bot = new TelegramBot('6805680521:AAG6kGO3jjp68O8af1kR5_WTOy9PM4hT71A', { polling: true });

let lastProcessedValorSenal = null;
let chatIds = [];

async function obtenerUltimoEvento() {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT TOP 1 
        ValorSenal, 
        IdSector, 
        IdSensor, 
        DuracionDetencion, 
        Fecha, 
        IdPlanta, 
        CONVERT(VARCHAR, Hora, 108) AS Hora -- Formato 'HH:mm:ss'
      FROM 
        Evento 
      ORDER BY 
        IdEvento DESC;
    `;
    await sql.close();
    return result.recordset[0];
  } catch (err) {
    console.error('Error al conectar a la base de datos:', err.message);
  }
}
//Almacena nuevos identificadores de chat en el arreglo chatIds.
async function registrarNuevoChat(chatId) {
  if (!chatIds.includes(chatId)) {
    chatIds.push(chatId);
    console.log(`Nuevo chatId almacenado: ${chatId}`);
  }
}
// Comprueba si hay un nuevo valor de señal en la Bd desde la ultima consulta. 
//Si hay un nuevo valor, crea un mensaje con detalles del evento y lo envía a todos los chats almacenados en chatIds.
async function verificarNuevoValor() {
  try {
    console.log('Función verificarNuevoValor ejecutada:', new Date().toLocaleString());

    const ultimoEvento = await obtenerUltimoEvento();
    console.log('Comparación:', ultimoEvento.ValorSenal !== lastProcessedValorSenal || ultimoEvento.Fecha > lastProcessedFecha);

    if (ultimoEvento.ValorSenal !== lastProcessedValorSenal || ultimoEvento.Fecha > lastProcessedFecha) {
      lastProcessedValorSenal = ultimoEvento.ValorSenal;
      lastProcessedFecha = ultimoEvento.Fecha;

      const idSectorNombre = nombresDeSector[ultimoEvento.IdSector] || 'Desconocido';
      const idPlantaNombre = nombresDePlanta[ultimoEvento.IdPlanta] || 'Desconocido';
      const duracionDetencionSegundos = ultimoEvento.DuracionDetencion.getTime() / 1000;
      const duracionDetencionTexto = `${Math.floor(duracionDetencionSegundos / 60)} minutos ${Math.floor(duracionDetencionSegundos % 60)} segundos`;

      const fecha = new Date(ultimoEvento.Fecha).toLocaleDateString();
      const hora = moment(ultimoEvento.Hora, 'HH:mm:ss').tz('America/Santiago').format('HH:mm:ss');

      const mensaje = `Ha ocurrido una falla en: \n`
        + `Sector: ${idSectorNombre}\n`
        + `Planta: ${idPlantaNombre}\n` 
        + `IdSensor: ${ultimoEvento.IdSensor}\n`
       // + `Duración de detención: ${duracionDetencionTexto}\n`
        + `Fecha: ${fecha}\n`
        + `Hora: ${hora}`;
      console.log('Detalles del mensaje:', mensaje);

      chatIds.forEach(id => {
        try {
          bot.sendMessage(id, mensaje);
          console.log('Mensaje enviado con éxito a', id);
        } catch (error) {
          console.error('Error al enviar mensaje a', id, ':', error.message);
        }
      });
    }
  } catch (error) {
    console.error('Error en verificarNuevoValor:', error.message);
  }
}
//maneja el evento de recepción de un comando /r desde Telegram, registrando el numero si no está almacenado.
bot.onText(/\/r/, async (msg, match) => {
  const nuevoValor = match[1];
  const chatId = msg.chat.id;
  await registrarNuevoChat(chatId);
});

//Cada 30 segundos, el Bot se actualiza para ver si llego un nuevo dato
setInterval(verificarNuevoValor, 30000);
console.log('Bot de Telegram listo para recibir comandos.');
