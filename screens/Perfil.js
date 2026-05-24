// ============================================================
//  Perfil.js  —  Perfil, código de vinculación y estadísticas
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, Alert, ScrollView, ActivityIndicator, Share
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://192.168.1.7:3000';

export default function Perfil() {
  const [perfil, setPerfil]         = useState(null);
  const [codigoInput, setCodigoInput] = useState('');
  const [cargando, setCargando]     = useState(true);
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => { cargarPerfil(); }, []);

  async function cargarPerfil() {
    setCargando(true);
    try {
      const uid    = await AsyncStorage.getItem('uid');
      const nombre = await AsyncStorage.getItem('nombre');
      if (!uid) return;
      const res  = await fetch(`${API_URL}/perfil/${uid}`);
      const data = await res.json();
      if (res.ok) setPerfil(data);
      else setPerfil({ nombre, uid, codigo_vinculacion: '??????', id_pareja: null });
    } catch {
      const nombre = await AsyncStorage.getItem('nombre') ?? 'Usuario';
      setPerfil({ nombre, codigo_vinculacion: '??????', id_pareja: null });
    } finally {
      setCargando(false);
    }
  }

  async function compartirCodigo() {
    if (!perfil?.codigo_vinculacion) return;
    await Share.share({
      message: `¡Conéctate conmigo en Notitas! Mi código es: ${perfil.codigo_vinculacion} 💌`,
      title:   'Mi código de Notitas'
    });
  }

  async function vincularPareja() {
    if (codigoInput.trim().length < 6) {
      return Alert.alert('Código inválido', 'Ingresa los 6 caracteres del código.');
    }
    setVinculando(true);
    try {
      const uid = await AsyncStorage.getItem('uid');
      const res  = await fetch(`${API_URL}/vincular-pareja`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uidUsuarioActual: uid, codigoPareja: codigoInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      Alert.alert('¡Conectados! 💑', data.mensaje);
      setCodigoInput('');
      cargarPerfil();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setVinculando(false);
    }
  }

  if (cargando) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#FFF8FB' }}>
        <ActivityIndicator color="#FF6B9D" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.contenedor}>
      {/* Avatar */}
      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetra}>{(perfil?.nombre ?? 'U')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.nombre}>{perfil?.nombre ?? 'Usuario'}</Text>
        <Text style={styles.correo}>{perfil?.correo ?? ''}</Text>
        <TouchableOpacity style={styles.codigoBadge} onPress={compartirCodigo}>
          <Text style={styles.codigoTexto}>{perfil?.codigo_vinculacion ?? '------'}</Text>
          <Text style={styles.codigoHint}>Toca para compartir tu código</Text>
        </TouchableOpacity>
      </View>

      {/* Estado de conexión */}
      {perfil?.nombre_pareja ? (
        <View style={styles.parejaCard}>
          <Text style={styles.parejaEmoji}>💑</Text>
          <View>
            <Text style={styles.parejaLabel}>Conectado/a con</Text>
            <Text style={styles.parejaNombre}>{perfil.nombre_pareja}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.vincularBox}>
          <Text style={styles.vincularTitle}>Vincular pareja 🔗</Text>
          <Text style={styles.vincularDesc}>Ingresa el código de tu pareja:</Text>
          <TextInput
            style={styles.codeInput}
            value={codigoInput}
            onChangeText={v => setCodigoInput(v.toUpperCase())}
            placeholder="ABC123"
            placeholderTextColor="#CCC"
            maxLength={6}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.btnVincular} onPress={vincularPareja} disabled={vinculando}>
            {vinculando
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.btnVincularText}>Conectarnos 💑</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:           { flex:1, backgroundColor:'#FFF8FB' },
  contenedor:       { padding:20, gap:16, paddingBottom:40 },
  heroCard:         { backgroundColor:'#FFF', borderRadius:24, borderWidth:1.5, borderColor:'#F0E0E8', padding:24, alignItems:'center', gap:8 },
  avatar:           { width:72, height:72, borderRadius:36, backgroundColor:'#FF6B9D', justifyContent:'center', alignItems:'center' },
  avatarLetra:      { fontSize:28, fontWeight:'bold', color:'#FFF' },
  nombre:           { fontSize:22, fontWeight:'bold', color:'#333' },
  correo:           { fontSize:13, color:'#AAA' },
  codigoBadge:      { backgroundColor:'#FF6B9D', paddingVertical:10, paddingHorizontal:24, borderRadius:16, alignItems:'center', marginTop:8 },
  codigoTexto:      { fontSize:22, fontWeight:'bold', color:'#FFF', letterSpacing:4 },
  codigoHint:       { fontSize:11, color:'rgba(255,255,255,0.8)', marginTop:2 },
  parejaCard:       { backgroundColor:'#FFF', borderRadius:16, borderWidth:1.5, borderColor:'#F0E0E8', padding:16, flexDirection:'row', alignItems:'center', gap:14 },
  parejaEmoji:      { fontSize:32 },
  parejaLabel:      { fontSize:12, color:'#AAA' },
  parejaNombre:     { fontSize:18, fontWeight:'bold', color:'#333' },
  vincularBox:      { backgroundColor:'#F5F0FF', borderRadius:16, borderWidth:1.5, borderColor:'#D4B8F5', padding:18, gap:10 },
  vincularTitle:    { fontSize:16, fontWeight:'bold', color:'#9C6FDE' },
  vincularDesc:     { fontSize:13, color:'#888' },
  codeInput:        { backgroundColor:'#FFF', borderWidth:2, borderColor:'#D4B8F5', borderRadius:12, padding:12, fontSize:22, textAlign:'center', letterSpacing:6, fontWeight:'bold', color:'#9C6FDE' },
  btnVincular:      { backgroundColor:'#9C6FDE', paddingVertical:14, borderRadius:30, alignItems:'center' },
  btnVincularText:  { color:'#FFF', fontSize:15, fontWeight:'bold' }
});
