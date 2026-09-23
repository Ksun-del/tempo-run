// Ловим фатальные ошибки как можно раньше
import './src/lib/crash';
// Фоновая задача геолокации должна быть объявлена до запуска приложения.
import './src/lib/tracker';
import 'expo-router/entry';
