export const Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
export const registerPlugin = () => new Proxy({}, { get: () => async () => ({}) });
export const LocalNotifications = new Proxy({}, { get: () => async () => ({}) });
export const Clipboard = { read: async () => ({}) };
export const Filesystem = { writeFile: async () => ({}) };
export const Directory = { Cache: 'CACHE' };
export const Encoding = { UTF8: 'utf8' };
export const Share = { share: async () => ({}) };
export const App = { addListener: () => ({ remove() {} }), exitApp: async () => {} };
