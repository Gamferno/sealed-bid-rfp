// Provides a named WebSocket export to fix Vite + isomorphic-ws resolution issues
export const WebSocket = globalThis.WebSocket;
export default globalThis.WebSocket;
