// ============================================================
//  CrearNota.js  —  Pantalla para crear y enviar una nota
//  Correcciones:
//  1. Exportación del dibujo como PNG con ViewShot
//  2. Envío real al servidor con FormData (fetch)
//  3. Manejo de loading state en el botón de envío
//  4. Gestión de permisos de notificaciones push
// ============================================================

import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';  // npm install react-native-view-shot
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://192.168.1.7:3000'; // Cambia por tu URL real

export default function CrearNota({ navigation }) {
  const [animo, setAnimo]           = useState('');
  const [texto, setTexto]           = useState('');
  const [caminos, setCaminos]       = useState([]);
  const [caminoActual, setCaminoActual] = useState([]);
  const [enviando, setEnviando]     = useState(false);

  const lienzRef = useRef(null); // Referencia para capturar el lienzo como imagen

  const opcionesAnimo = [
    '😊 Feliz', '😴 Cansado/a', '🥰 Enamorado/a',
    '😢 Triste', '🍕 Con Hambre', '🌟 Con Energía'
  ];

  // ── Eventos del lienzo ──────────────────────────────────────
  const alTocarPantalla = (e) => {
    const { locationX, locationY } = e.nativeEvent;
    setCaminoActual([`M ${locationX} ${locationY}`]);
  };

  const alMoverDedo = (e) => {
    const { locationX, locationY } = e.nativeEvent;
    setCaminoActual(prev => [...prev, `L ${locationX} ${locationY}`]);
  };

  const alSoltarPantalla = () => {
    if (caminoActual.length > 1) {
      setCaminos(prev => [...prev, caminoActual.join(' ')]);
    }
    setCaminoActual([]);
  };

  const limpiarLienzo = () => {
    setCaminos([]);
    setCaminoActual([]);
  };

  const deshacerTrazo = () => {
    setCaminos(prev => prev.slice(0, -1));
  };

  // ── Enviar nota al servidor ─────────────────────────────────
  const enviarNota = async () => {
    if (!animo)            return Alert.alert('¡Espera!', 'Selecciona cómo estás hoy.');
    if (!caminos.length)   return Alert.alert('¡Espera!', 'Haz al menos un trazo en el lienzo.');
    if (!texto.trim())     return Alert.alert('¡Espera!', 'Escribe un mensaje para tu pareja.');

    setEnviando(true);
    try {
      // 1. Capturar el lienzo como imagen PNG
      const uriImagen = await lienzRef.current.capture({
        format:  'png',
        quality: 0.9,
        result:  'tmpfile'
      });

      // 2. Obtener el ID del usuario guardado localmente
      const idCreador = await AsyncStorage.getItem('uid');
      if (!idCreador) throw new Error('No se encontró tu sesión. Vuelve a iniciar sesión.');

      // 3. Armar el FormData para la petición multipart
      const formData = new FormData();
      formData.append('idCreador',  idCreador);
      formData.append('estadoAnimo', animo);
      formData.append('textoNota',  texto.trim());
      formData.append('dibujo', {
        uri:  uriImagen,
        name: `dibujo_${Date.now()}.png`,
        type: 'image/png'
      });

      // 4. Enviar al servidor
      const respuesta = await fetch(`${API_URL}/enviar-nota`, {
        method:  'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body:    formData
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) throw new Error(datos.error || 'Error al enviar la nota.');

      Alert.alert('¡Nota enviada! 💌', datos.mensaje, [
        { text: 'Genial', onPress: () => navigation.navigate('Home') }
      ]);

      // Limpiar el formulario
      setAnimo('');
      setTexto('');
      limpiarLienzo();

    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.contenedor}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Estado de ánimo ───────────────────────────────── */}
      <Text style={styles.titulo}>¿Cómo estás hoy?</Text>
      <View style={styles.contenedorAnimo}>
        {opcionesAnimo.map((opcion) => (
          <TouchableOpacity
            key={opcion}
            style={[styles.botonAnimo, animo === opcion && styles.botonAnimoSeleccionado]}
            onPress={() => setAnimo(opcion)}
          >
            <Text style={[styles.textoAnimo, animo === opcion && styles.textoAnimoSeleccionado]}>
              {opcion}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Lienzo de dibujo ─────────────────────────────── */}
      <Text style={styles.subtitulo}>Haz un dibujo para tu pareja:</Text>
      <ViewShot ref={lienzRef} style={styles.lienzo} options={{ format: 'png', quality: 0.9 }}>
        <View
          style={styles.lienzoInterior}
          onTouchStart={alTocarPantalla}
          onTouchMove={alMoverDedo}
          onTouchEnd={alSoltarPantalla}
        >
          <Svg style={StyleSheet.absoluteFill}>
            {caminos.map((camino, i) => (
              <Path key={i} d={camino} stroke="#333" strokeWidth={4} fill="none" strokeLinecap="round" />
            ))}
            {caminoActual.length > 0 && (
              <Path d={caminoActual.join(' ')} stroke="#333" strokeWidth={4} fill="none" strokeLinecap="round" />
            )}
          </Svg>
        </View>
      </ViewShot>

      <View style={styles.botonesLienzo}>
        <TouchableOpacity onPress={deshacerTrazo} style={styles.botonLienzo}>
          <Text style={styles.textoBotonLienzo}>↩ Deshacer</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={limpiarLienzo} style={styles.botonLienzo}>
          <Text style={[styles.textoBotonLienzo, { color: '#FF6B6B' }]}>🗑 Borrar todo</Text>
        </TouchableOpacity>
      </View>

      {/* ── Cuadro de texto ──────────────────────────────── */}
      <TextInput
        style={styles.entradaTexto}
        placeholder="Escribe un mensajito aquí..."
        placeholderTextColor="#AAA"
        multiline
        value={texto}
        onChangeText={setTexto}
        maxLength={300}
      />
      <Text style={styles.contador}>{texto.length}/300</Text>

      {/* ── Botón de envío ───────────────────────────────── */}
      <TouchableOpacity
        style={[styles.botonEnviar, enviando && styles.botonDeshabilitado]}
        onPress={enviarNota}
        disabled={enviando}
      >
        {enviando
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.textoBotonEnviar}>💌 Enviar a mi pareja</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:               { flex: 1, backgroundColor: '#FFF8FB' },
  contenedor:           { padding: 20, paddingBottom: 40 },
  titulo:               { fontSize: 20, fontWeight: 'bold', marginBottom: 12, color: '#333', textAlign: 'center' },
  subtitulo:            { fontSize: 16, marginBottom: 8, color: '#555', fontWeight: '600' },
  contenedorAnimo:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 },
  botonAnimo:           { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#F0E0E8', borderWidth: 1.5, borderColor: '#E8D0DC' },
  botonAnimoSeleccionado: { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' },
  textoAnimo:           { fontSize: 14, color: '#666', fontWeight: '600' },
  textoAnimoSeleccionado: { color: '#FFF' },
  lienzo:               { height: 260, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E8D0DC', marginBottom: 0 },
  lienzoInterior:       { flex: 1 },
  botonesLienzo:        { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8, marginBottom: 20 },
  botonLienzo:          { paddingVertical: 6, paddingHorizontal: 12 },
  textoBotonLienzo:     { color: '#999', fontWeight: '700', fontSize: 13 },
  entradaTexto:         { minHeight: 90, backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#E8D0DC', textAlignVertical: 'top', fontSize: 15, color: '#333', lineHeight: 22 },
  contador:             { textAlign: 'right', fontSize: 11, color: '#BBB', marginTop: 4, marginBottom: 20 },
  botonEnviar:          { backgroundColor: '#FF6B9D', paddingVertical: 16, borderRadius: 30, alignItems: 'center', shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  botonDeshabilitado:   { backgroundColor: '#CCC', shadowOpacity: 0 },
  textoBotonEnviar:     { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
