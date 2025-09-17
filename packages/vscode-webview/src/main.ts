import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

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