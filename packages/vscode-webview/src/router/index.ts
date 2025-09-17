import { createRouter, createWebHistory, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import SimpleInterface from '../components/SimpleInterface.vue'
import WorkflowInterface from '../components/WorkflowInterface.vue'

// Define routes
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: SimpleInterface,
    meta: {
      title: 'SuperCode'
    }
  },
  {
    path: '/workflow',
    name: 'workflow',
    component: WorkflowInterface,
    meta: {
      title: 'SuperCode Workflow'
    }
  },
  {
    path: '/simple',
    name: 'simple',
    component: SimpleInterface,
    meta: {
      title: 'SuperCode Simple'
    }
  }
]

// Determine if we're in VSCode or standalone mode
const isVSCode = typeof (window as any).acquireVsCodeApi !== 'undefined'

// Create router instance
const router = createRouter({
  // Use hash history in VSCode, regular history in standalone
  history: isVSCode ? createWebHashHistory() : createWebHistory(),
  routes
})

// Navigation guard to update page title
router.beforeEach((to, _from, next) => {
  // Update document title if meta title is available
  if (to.meta?.title) {
    document.title = to.meta.title as string
  }
  next()
})

export default router