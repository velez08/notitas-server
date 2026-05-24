// ============================================================
//  App.js  —  Punto de entrada principal con React Navigation
//  Instala: npm install @react-navigation/native @react-navigation/bottom-tabs
//           @react-navigation/stack react-native-screens
//           react-native-safe-area-context
// ============================================================

import React, { useEffect, useState } from 'react';
import { NavigationContainer }        from '@react-navigation/native';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { createStackNavigator }       from '@react-navigation/stack';
import { Text, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications             from 'expo-notifications';

import VerNota    from './screens/VerNota';
import CrearNota  from './screens/CrearNota';
import Perfil     from './screens/Perfil';
import Login      from './screens/Login';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// Configurar el comportamiento de notificaciones en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

function TabsApp() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = { Inicio: '💌', Crear: '✏️', Perfil: '👤' };
          return <Text style={{ fontSize: focused ? 22 : 18 }}>{icons[route.name]}</Text>;
        },
        tabBarActiveTintColor:   '#FF6B9D',
        tabBarInactiveTintColor: '#AAA',
        tabBarStyle: { borderTopColor: '#F0E0E8', paddingBottom: 8, height: 60 },
        headerStyle:            { backgroundColor: '#FFF8FB' },
        headerTitleStyle:       { color: '#333', fontWeight: 'bold' },
        headerShadowVisible:    false
      })}
    >
      <Tab.Screen name="Inicio" component={VerNota}   options={{ title: 'Notitas 💌' }} />
      <Tab.Screen name="Crear"  component={CrearNota} options={{ title: 'Nueva Nota' }} />
      <Tab.Screen name="Perfil" component={Perfil}    options={{ title: 'Mi Perfil' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [sesionActiva, setSesionActiva] = useState(null); // null = cargando

  useEffect(() => {
    checkSession();
    registerForPushNotifications();
  }, []);

  async function checkSession() {
    try {
      const uid = await AsyncStorage.getItem('uid');
      setSesionActiva(!!uid);
    } catch {
      setSesionActiva(false);
    }
  }

  async function registerForPushNotifications() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      const uid   = await AsyncStorage.getItem('uid');
      if (!uid || !token) return;

      // Guardar token en el servidor
      await fetch('https://TU-SERVIDOR.com/actualizar-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid, tokenPush: token })
      });
    } catch (e) {
      console.warn('Push notifications no disponibles:', e.message);
    }
  }

  if (sesionActiva === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8FB' }}>
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {sesionActiva
          ? <Stack.Screen name="Main" component={TabsApp} />
          : <Stack.Screen name="Login" component={Login}
              options={{ animationTypeForReplace: 'pop' }} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  );
}
