import { createApp } from 'vue'
import SimpleInterface from './components/SimpleInterface.vue'
import './style.css'

// Create and mount the Vue app
const app = createApp(SimpleInterface)

// Mount to the #app element
app.mount('#app')

// Export for potential external use
export { SimpleInterface }
export * from './types'