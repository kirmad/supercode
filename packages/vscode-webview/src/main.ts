import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import { getADOCredentials } from './config/ado.config'

// Debug: Log ADO settings when app loads
console.log('[SuperCode] App starting...');
console.log('[SuperCode] Window ADO Settings:', (window as any).adoSettings);
console.log('[SuperCode] ADO Credentials from config:', getADOCredentials());

// Create Vue app with router
const app = createApp(App)

// Use router
app.use(router)

// Mount to the #app element
app.mount('#app')

// Export for potential external use
export { default as SimpleInterface } from './components/SimpleInterface.vue'
export { default as WorkflowInterface } from './components/WorkflowInterface.vue'
export * from './types'