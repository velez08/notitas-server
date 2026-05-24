// ============================================================
//  NOTITAS — Servidor Express + Firebase
//  Correcciones aplicadas:
//  1. Bug crítico: 'archivoArchivo' → 'archivoDibujo' (línea ~80)
//  2. Falta app.listen al final del archivo de rutas de envío
//  3. Manejo de errores mejorado con mensajes descriptivos
//  4. Validaciones adicionales en todos los endpoints
// ============================================================

const express    = require('express');
const multer     = require('multer');
const { Expo }   = require('expo-server-sdk');
const path       = require('path');
const admin      = require('firebase-admin'); // <--- Solo uno de estos

const app = express();
app.use(express.json());

// ── Firebase init ────────────────────────────────────────────
let serviceAccount;

if (process.env.FIREBASE_PROJECT_ID) {
  serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  };
} else {
  serviceAccount = require('./clave-firebase.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.appspot.com`
});

const db     = admin.firestore();
const bucket = admin.storage().bucket();
const expo   = new Expo();
// ─────────────────────────────────────────────────────────────

// ── Multer: recibe imagen en memoria (max 5 MB) ──────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten archivos de imagen.'));
  }
});

// ── Helper: generar código de 6 chars ───────────────────────
function generarCodigoVinculo() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}


// ════════════════════════════════════════════════════════════
//  1. REGISTRAR USUARIO
//     POST /registrar-usuario
//     Body: { uid, nombre, correo }
// ════════════════════════════════════════════════════════════
app.post('/registrar-usuario', async (req, res) => {
  try {
    const { uid, nombre, correo } = req.body;

    if (!uid || !nombre || !correo) {
      return res.status(400).json({ error: 'uid, nombre y correo son requeridos.' });
    }

    // Verificar si el usuario ya existe
    const docExistente = await db.collection('Usuarios').doc(uid).get();
    if (docExistente.exists) {
      return res.status(200).json({
        mensaje: 'Usuario ya existe.',
        codigo: docExistente.data().codigo_vinculacion
      });
    }

    const codigoUnico = generarCodigoVinculo();

    await db.collection('Usuarios').doc(uid).set({
      uid,
      nombre,
      correo,
      codigo_vinculacion: codigoUnico,
      id_pareja:  null,
      conectado:  false,
      token_push: null,
      fecha_registro: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({ mensaje: 'Usuario registrado con éxito.', codigo: codigoUnico });
  } catch (error) {
    console.error('[registrar-usuario]', error);
    res.status(500).json({ error: error.message });
  }
});


// ════════════════════════════════════════════════════════════
//  2. VINCULAR PAREJA
//     POST /vincular-pareja
//     Body: { uidUsuarioActual, codigoPareja }
// ════════════════════════════════════════════════════════════
app.post('/vincular-pareja', async (req, res) => {
  try {
    const { uidUsuarioActual, codigoPareja } = req.body;

    if (!uidUsuarioActual || !codigoPareja) {
      return res.status(400).json({ error: 'uidUsuarioActual y codigoPareja son requeridos.' });
    }

    const codigoNormalizado = codigoPareja.trim().toUpperCase();

    // Buscar la pareja por código
    const parejaQuery = await db.collection('Usuarios')
      .where('codigo_vinculacion', '==', codigoNormalizado)
      .limit(1)
      .get();

    if (parejaQuery.empty) {
      return res.status(404).json({ error: 'Código no válido. Verifícalo con tu pareja.' });
    }

    const docPareja  = parejaQuery.docs[0];
    const uidPareja  = docPareja.id;
    const datosPareja = docPareja.data();

    // No puede vincularse consigo mismo
    if (uidPareja === uidUsuarioActual) {
      return res.status(400).json({ error: 'No puedes vincularte contigo mismo.' });
    }

    // Verificar si la pareja ya está vinculada con alguien más
    if (datosPareja.id_pareja && datosPareja.id_pareja !== uidUsuarioActual) {
      return res.status(400).json({ error: 'Esa persona ya está vinculada con alguien más.' });
    }

    // Verificar si el usuario actual ya tiene pareja
    const docUsuarioActual = await db.collection('Usuarios').doc(uidUsuarioActual).get();
    if (!docUsuarioActual.exists) {
      return res.status(404).json({ error: 'Tu usuario no existe. Regístrate primero.' });
    }
    const datosActual = docUsuarioActual.data();
    if (datosActual.id_pareja && datosActual.id_pareja !== uidPareja) {
      return res.status(400).json({ error: 'Ya estás vinculado/a con alguien. Desvincula primero.' });
    }

    // Vinculación mutua en una sola transacción
    const batch = db.batch();
    batch.update(db.collection('Usuarios').doc(uidUsuarioActual), {
      id_pareja: uidPareja,
      conectado: true
    });
    batch.update(db.collection('Usuarios').doc(uidPareja), {
      id_pareja: uidUsuarioActual,
      conectado: true
    });
    await batch.commit();

    res.status(200).json({
      mensaje: `¡Vinculación exitosa! Ahora estás conectado/a con ${datosPareja.nombre}.`,
      nombrePareja: datosPareja.nombre
    });
  } catch (error) {
    console.error('[vincular-pareja]', error);
    res.status(500).json({ error: error.message });
  }
});


// ════════════════════════════════════════════════════════════
//  3. ENVIAR NOTA (con dibujo)
//     POST /enviar-nota   (multipart/form-data)
//     Fields: idCreador, estadoAnimo, textoNota
//     File:   dibujo  (PNG/JPG, max 5MB)
// ════════════════════════════════════════════════════════════
app.post('/enviar-nota', upload.single('dibujo'), async (req, res) => {
  try {
    const { idCreador, estadoAnimo, textoNota } = req.body;

    // ── Validaciones básicas ─────────────────────────────────
    if (!idCreador || !estadoAnimo || !textoNota) {
      return res.status(400).json({ error: 'idCreador, estadoAnimo y textoNota son requeridos.' });
    }

    // BUG CORREGIDO: era 'archivoDibujo' en la verificación
    // pero luego se usaba 'archivoArchivo.buffer' → ahora unificado
    const archivoDibujo = req.file;
    if (!archivoDibujo) {
      return res.status(400).json({ error: 'Falta el archivo del dibujo (campo: "dibujo").' });
    }

    // ── Buscar datos del creador ─────────────────────────────
    const docUsuario = await db.collection('Usuarios').doc(idCreador).get();
    if (!docUsuario.exists) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const datosUsuario = docUsuario.data();
    const idReceptor   = datosUsuario.id_pareja;

    if (!idReceptor) {
      return res.status(400).json({ error: 'Aún no estás vinculado/a con ninguna pareja.' });
    }

    // ── Subir dibujo a Firebase Storage ─────────────────────
    const extension    = archivoDibujo.mimetype.split('/')[1] || 'png';
    const nombreArchivo = `dibujos/${idCreador}_${Date.now()}.${extension}`;
    const archivoFirebase = bucket.file(nombreArchivo);

    await archivoFirebase.save(archivoDibujo.buffer, {   // ← BUG CORREGIDO
      metadata: { contentType: archivoDibujo.mimetype },
      public:   true
    });

    const urlDibujoPublica =
      `https://storage.googleapis.com/${bucket.name}/${nombreArchivo}`;

    // ── Guardar nota en Firestore ────────────────────────────
    const nuevaNota = {
      id_creador:     idCreador,
      id_receptor:    idReceptor,
      fecha_creacion: admin.firestore.FieldValue.serverTimestamp(),
      estado_animo:   estadoAnimo,
      url_dibujo:     urlDibujoPublica,
      texto_nota:     textoNota.trim(),
      leida:          false
    };

    const notaRef = await db.collection('Notas').add(nuevaNota);

    // ── Notificación push a la pareja ────────────────────────
    const docPareja   = await db.collection('Usuarios').doc(idReceptor).get();
    const datosPareja = docPareja.data();
    const tokenPush   = datosPareja?.token_push;

    if (tokenPush && Expo.isExpoPushToken(tokenPush)) {
      const mensajes = [{
        to:    tokenPush,
        sound: 'default',
        title: '¡Nueva nota disponible! 💌',
        body:  `${datosUsuario.nombre} te dejó un dibujo y dice que está ${estadoAnimo}`,
        data:  { tipo: 'NUEVA_NOTA', idNota: notaRef.id }
      }];

      const chunks   = expo.chunkPushNotifications(mensajes);
      const tickets  = [];
      for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }
    }

    res.status(201).json({
      mensaje:   '¡Nota enviada con éxito!',
      idNota:    notaRef.id,
      urlDibujo: urlDibujoPublica
    });

  } catch (error) {
    console.error('[enviar-nota]', error);
    res.status(500).json({ error: error.message });
  }
});


// ════════════════════════════════════════════════════════════
//  4. OBTENER ÚLTIMA NOTA RECIBIDA
//     GET /nota-recibida/:uid
// ════════════════════════════════════════════════════════════
app.get('/nota-recibida/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    const notasQuery = await db.collection('Notas')
      .where('id_receptor', '==', uid)
      .orderBy('fecha_creacion', 'desc')
      .limit(1)
      .get();

    if (notasQuery.empty) {
      return res.status(404).json({ mensaje: 'No hay notas recibidas aún.' });
    }

    const doc   = notasQuery.docs[0];
    const datos = doc.data();

    // Marcar como leída
    if (!datos.leida) {
      await doc.ref.update({ leida: true, fecha_lectura: admin.firestore.FieldValue.serverTimestamp() });
    }

    // Obtener nombre del creador
    const docCreador  = await db.collection('Usuarios').doc(datos.id_creador).get();
    const nombreCreador = docCreador.exists ? docCreador.data().nombre : 'Desconocido';

    res.status(200).json({
      id_nota:      doc.id,
      remitente:    nombreCreador,
      estado_animo: datos.estado_animo,
      url_dibujo:   datos.url_dibujo,
      texto_nota:   datos.texto_nota,
      fecha:        datos.fecha_creacion?.toDate?.()?.toISOString() ?? null,
      leida:        datos.leida
    });

  } catch (error) {
    console.error('[nota-recibida]', error);
    res.status(500).json({ error: error.message });
  }
});


// ════════════════════════════════════════════════════════════
//  5. ACTUALIZAR TOKEN PUSH
//     POST /actualizar-token
//     Body: { uid, tokenPush }
// ════════════════════════════════════════════════════════════
app.post('/actualizar-token', async (req, res) => {
  try {
    const { uid, tokenPush } = req.body;
    if (!uid || !tokenPush) {
      return res.status(400).json({ error: 'uid y tokenPush son requeridos.' });
    }

    await db.collection('Usuarios').doc(uid).update({ token_push: tokenPush });
    res.status(200).json({ mensaje: 'Token actualizado correctamente.' });
  } catch (error) {
    console.error('[actualizar-token]', error);
    res.status(500).json({ error: error.message });
  }
});


// ── Inicio del servidor ──────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor Notitas corriendo en el puerto ${PORT}`);
});

module.exports = app;
