// ============================================================
//  VerNota.js  —  Pantalla para ver la nota recibida
//  Correcciones:
//  1. Carga dinámica desde el servidor (antes era hardcoded)
//  2. Estado de loading y error handling
//  3. Formateo de fecha legible
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, Image,
  TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://192.168.1.7:3000'; // Cambia por tu URL real

function formatearFecha(isoString) {
  if (!isoString) return '';
  const fecha = new Date(isoString);
  const ahora  = new Date();
  const diffMs = ahora - fecha;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)   return 'Hace un momento';
  if (diffMin < 60)  return `Hace ${diffMin} minuto${diffMin > 1 ? 's' : ''}`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24)  return `Hace ${diffHrs} hora${diffHrs > 1 ? 's' : ''}`;
  return fecha.toLocaleDateString('es-CO', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
}

export default function VerNota({ navigation }) {
  const [nota, setNota]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');

  const cargarNota = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const uid = await AsyncStorage.getItem('uid');
      if (!uid) throw new Error('No se encontró tu sesión.');

      const res  = await fetch(`${API_URL}/nota-recibida/${uid}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.mensaje || data.error || 'No hay notas aún.');
      setNota(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarNota(); }, [cargarNota]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={styles.textoCargando}>Buscando tu nota...</Text>
      </View>
    );
  }

  if (error || !nota) {
    return (
      <View style={styles.centrado}>
        <Text style={{ fontSize: 48 }}>💌</Text>
        <Text style={styles.textoVacio}>
          {error || 'Aún no tienes notas.\n¡Pídele a tu pareja que te envíe una!'}
        </Text>
        <TouchableOpacity style={styles.botonRecargar} onPress={cargarNota}>
          <Text style={styles.textoBotonRecargar}>Recargar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.contenedor}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargarNota} tintColor="#FF6B9D" />}
    >
      {/* ── Encabezado ───────────────────────────────────── */}
      <View style={styles.encabezado}>
        <Text style={styles.textoPareja}>{nota.remitente} está...</Text>
        <View style={styles.etiquetaAnimo}>
          <Text style={styles.textoAnimo}>{nota.estado_animo}</Text>
        </View>
      </View>

      {/* ── Tarjeta de nota ──────────────────────────────── */}
      <View style={styles.tarjetaNota}>
        {/* Dibujo */}
        <View style={styles.contenedorDibujo}>
          <Image
            source={{ uri: nota.url_dibujo }}
            style={styles.dibujo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.divisor} />

        {/* Mensaje de texto */}
        <View style={styles.contenedorTexto}>
          <Text style={styles.textoMensaje}>{nota.texto_nota}</Text>
          <Text style={styles.textoFecha}>{formatearFecha(nota.fecha)}</Text>
        </View>
      </View>

      {/* ── Botón responder ──────────────────────────────── */}
      <TouchableOpacity
        style={styles.botonResponder}
        onPress={() => navigation.navigate('CrearNota')}
      >
        <Text style={styles.textoBotonResponder}>Responder con una nota ✨</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:             { flex: 1, backgroundColor: '#FFF8FB' },
  contenedor:         { padding: 20, paddingBottom: 40 },
  centrado:           { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#FFF8FB', gap: 12 },
  textoCargando:      { marginTop: 12, color: '#AAA', fontSize: 15 },
  textoVacio:         { textAlign: 'center', color: '#999', fontSize: 15, lineHeight: 22 },
  botonRecargar:      { marginTop: 8, backgroundColor: '#FF6B9D', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20 },
  textoBotonRecargar: { color: '#FFF', fontWeight: 'bold' },
  encabezado:         { alignItems: 'center', marginBottom: 20 },
  textoPareja:        { fontSize: 18, color: '#666', marginBottom: 8 },
  etiquetaAnimo:      { backgroundColor: '#FFF', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 24, shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  textoAnimo:         { fontSize: 16, fontWeight: 'bold', color: '#333' },
  tarjetaNota:        { backgroundColor: '#FFF', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4, marginBottom: 24 },
  contenedorDibujo:   { width: '100%', height: 280, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center' },
  dibujo:             { width: '90%', height: '90%' },
  divisor:            { height: 1, backgroundColor: '#F0E0E8', marginHorizontal: 20 },
  contenedorTexto:    { padding: 20 },
  textoMensaje:       { fontSize: 16, color: '#444', lineHeight: 24, marginBottom: 10 },
  textoFecha:         { fontSize: 12, color: '#BBB', textAlign: 'right' },
  botonResponder:     { backgroundColor: '#FF6B9D', paddingVertical: 16, paddingHorizontal: 30, borderRadius: 30, alignItems: 'center', shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  textoBotonResponder: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
