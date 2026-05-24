// ============================================================
//  Login.js  —  Registro, inicio de sesión y vinculación
// ============================================================

import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://192.168.1.7:3000';

export default function Login({ navigation }) {
  const [tab, setTab]           = useState('registro'); // 'registro' | 'vincular'
  const [nombre, setNombre]     = useState('');
  const [correo, setCorreo]     = useState('');
  const [codigo, setCodigo]     = useState('');
  const [cargando, setCargando] = useState(false);

  const registrar = async () => {
    if (!nombre.trim() || !correo.trim()) {
      return Alert.alert('¡Faltan datos!', 'Por favor completa nombre y correo.');
    }
    setCargando(true);
    try {
      // Generamos un UID temporal basado en correo (en producción usa Firebase Auth)
      const uid = correo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 12) + Date.now();

      const res  = await fetch(`${API_URL}/registrar-usuario`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid, nombre: nombre.trim(), correo: correo.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await AsyncStorage.setItem('uid', uid);
      await AsyncStorage.setItem('nombre', nombre.trim());

      Alert.alert(
        '¡Registro exitoso! 🎉',
        `Tu código de vinculación es:\n\n${data.codigo}\n\nCompartelo con tu pareja para conectarse.`,
        [{ text: 'Entendido', onPress: () => setTab('vincular') }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setCargando(false);
    }
  };

  const vincular = async () => {
    if (codigo.trim().length < 6) {
      return Alert.alert('¡Código inválido!', 'El código debe tener 6 caracteres.');
    }
    setCargando(true);
    try {
      const uid = await AsyncStorage.getItem('uid');
      if (!uid) return Alert.alert('Primero regístrate.');

      const res  = await fetch(`${API_URL}/vincular-pareja`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uidUsuarioActual: uid, codigoPareja: codigo.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      Alert.alert('¡Conectados! 💑', data.mensaje, [
        { text: '¡Vamos! 💌', onPress: () => navigation.replace('Main') }
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.contenedor} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>💌</Text>
        <Text style={styles.titulo}>Notitas</Text>
        <Text style={styles.subtitulo}>Conecta con quien más quieres</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'registro' && styles.tabActivo]}
            onPress={() => setTab('registro')}
          >
            <Text style={[styles.textoTab, tab === 'registro' && styles.textoTabActivo]}>Registro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'vincular' && styles.tabActivo]}
            onPress={() => setTab('vincular')}
          >
            <Text style={[styles.textoTab, tab === 'vincular' && styles.textoTabActivo]}>Vincular pareja</Text>
          </TouchableOpacity>
        </View>

        {tab === 'registro' ? (
          <View style={styles.formulario}>
            <TextInput
              style={styles.input}
              placeholder="Tu nombre"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Tu correo"
              value={correo}
              onChangeText={setCorreo}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.boton} onPress={registrar} disabled={cargando}>
              {cargando
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.textoBoton}>Crear mi cuenta</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formulario}>
            <Text style={styles.instruccion}>
              Pídele a tu pareja su código de vinculación e ingrésalo aquí:
            </Text>
            <TextInput
              style={[styles.input, styles.inputCodigo]}
              placeholder="ABC123"
              value={codigo}
              onChangeText={c => setCodigo(c.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.boton} onPress={vincular} disabled={cargando}>
              {cargando
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.textoBoton}>Conectarnos 💑</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor:    { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#FFF8FB' },
  logo:          { fontSize: 64, marginBottom: 8 },
  titulo:        { fontSize: 32, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  subtitulo:     { fontSize: 15, color: '#AAA', marginBottom: 32 },
  tabs:          { flexDirection: 'row', backgroundColor: '#F0E0E8', borderRadius: 12, padding: 4, marginBottom: 24, width: '100%' },
  tab:           { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActivo:     { backgroundColor: '#FFF' },
  textoTab:      { fontSize: 14, color: '#AAA', fontWeight: '600' },
  textoTabActivo: { color: '#FF6B9D', fontWeight: 'bold' },
  formulario:    { width: '100%', gap: 12 },
  input:         { backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E8D0DC', borderRadius: 14, padding: 14, fontSize: 15, color: '#333' },
  inputCodigo:   { textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: 'bold', color: '#FF6B9D' },
  instruccion:   { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  boton:         { backgroundColor: '#FF6B9D', paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 8 },
  textoBoton:    { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
