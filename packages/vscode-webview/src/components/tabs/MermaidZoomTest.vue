<template>
  <div class="mermaid-zoom-test">
    <div class="test-header">
      <h1>Mermaid Diagram Zoom & Pan Demo</h1>
      <p class="subtitle">Click on any diagram below to explore the new zoom and pan functionality</p>
    </div>

    <div class="demo-grid">
      <!-- Flowchart Example -->
      <div class="demo-card">
        <h3>Flowchart Diagram</h3>
        <MarkdownRenderer
          :content="flowchartContent"
          :enableMermaid="true"
        />
      </div>

      <!-- Sequence Diagram Example -->
      <div class="demo-card">
        <h3>Sequence Diagram</h3>
        <MarkdownRenderer
          :content="sequenceDiagramContent"
          :enableMermaid="true"
        />
      </div>

      <!-- Class Diagram Example -->
      <div class="demo-card">
        <h3>Class Diagram</h3>
        <MarkdownRenderer
          :content="classDiagramContent"
          :enableMermaid="true"
        />
      </div>

      <!-- State Diagram Example -->
      <div class="demo-card">
        <h3>State Diagram</h3>
        <MarkdownRenderer
          :content="stateDiagramContent"
          :enableMermaid="true"
        />
      </div>

      <!-- ER Diagram Example -->
      <div class="demo-card">
        <h3>Entity Relationship Diagram</h3>
        <MarkdownRenderer
          :content="erDiagramContent"
          :enableMermaid="true"
        />
      </div>

      <!-- Gantt Chart Example -->
      <div class="demo-card">
        <h3>Gantt Chart</h3>
        <MarkdownRenderer
          :content="ganttChartContent"
          :enableMermaid="true"
        />
      </div>

      <!-- Pie Chart Example -->
      <div class="demo-card">
        <h3>Pie Chart</h3>
        <MarkdownRenderer
          :content="pieChartContent"
          :enableMermaid="true"
        />
      </div>

      <!-- Git Graph Example -->
      <div class="demo-card">
        <h3>Git Graph</h3>
        <MarkdownRenderer
          :content="gitGraphContent"
          :enableMermaid="true"
        />
      </div>
    </div>

    <div class="instructions">
      <h2>How to Use the Zoom Modal</h2>
      <div class="instruction-grid">
        <div class="instruction-item">
          <div class="icon">🖱️</div>
          <strong>Mouse Controls</strong>
          <ul>
            <li>Click on any diagram to open the zoom modal</li>
            <li>Drag to pan around the diagram</li>
            <li>Scroll to zoom in/out</li>
          </ul>
        </div>
        <div class="instruction-item">
          <div class="icon">⌨️</div>
          <strong>Keyboard Shortcuts</strong>
          <ul>
            <li><kbd>+</kbd> / <kbd>-</kbd> : Zoom in/out</li>
            <li><kbd>R</kbd> : Reset view</li>
            <li><kbd>F</kbd> : Fit to screen</li>
            <li><kbd>Space</kbd> : Toggle fullscreen</li>
            <li><kbd>D</kbd> : Download SVG</li>
            <li><kbd>ESC</kbd> : Close modal</li>
          </ul>
        </div>
        <div class="instruction-item">
          <div class="icon">👆</div>
          <strong>Touch Controls</strong>
          <ul>
            <li>Pinch to zoom</li>
            <li>Single finger drag to pan</li>
            <li>Double tap to reset</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MarkdownRenderer from '../shared/MarkdownRenderer.vue'

// Mermaid diagram examples
const flowchartContent = ref(`
## Complex System Architecture

\`\`\`mermaid
flowchart TB
    subgraph "Frontend Layer"
        A[React App] --> B[Redux Store]
        B --> C[API Client]
        A --> D[Component Library]
        D --> E[Design System]
    end

    subgraph "Backend Layer"
        C --> F[API Gateway]
        F --> G[Auth Service]
        F --> H[User Service]
        F --> I[Payment Service]

        G --> J[(User DB)]
        H --> J
        I --> K[(Payment DB)]
    end

    subgraph "Infrastructure"
        F --> L[Load Balancer]
        L --> M[Cache Layer]
        M --> N[CDN]

        J --> O[Backup]
        K --> O
    end

    style A fill:#8b5cf6,color:#fff
    style F fill:#10b981,color:#fff
    style L fill:#3b82f6,color:#fff
\`\`\`
`)

const sequenceDiagramContent = ref(`
## User Authentication Flow

\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant F as Frontend
    participant A as Auth Service
    participant D as Database
    participant E as Email Service

    U->>B: Enter credentials
    B->>F: Submit login form
    F->>A: POST /auth/login
    A->>D: Validate credentials
    D-->>A: User found
    A->>A: Generate JWT
    A->>E: Send login notification
    E-->>U: Email sent
    A-->>F: Return token
    F->>B: Store token
    B-->>U: Redirect to dashboard

    Note over U,D: Secure authentication complete
\`\`\`
`)

const classDiagramContent = ref(`
## System Class Structure

\`\`\`mermaid
classDiagram
    class User {
        +String id
        +String email
        +String name
        +Date createdAt
        +login()
        +logout()
        +updateProfile()
    }

    class Admin {
        +String role
        +Array permissions
        +manageUsers()
        +viewAnalytics()
    }

    class Product {
        +String id
        +String name
        +Float price
        +Integer stock
        +purchase()
        +updateStock()
    }

    class Order {
        +String orderId
        +Date orderDate
        +Float total
        +String status
        +process()
        +cancel()
        +refund()
    }

    class Payment {
        +String transactionId
        +String method
        +Float amount
        +processPayment()
        +validateCard()
    }

    User <|-- Admin
    User "1" --> "*" Order : places
    Order "*" --> "*" Product : contains
    Order "1" --> "1" Payment : has
\`\`\`
`)

const stateDiagramContent = ref(`
## Order Processing State Machine

\`\`\`mermaid
stateDiagram-v2
    [*] --> Pending: Order Placed

    Pending --> Processing: Payment Confirmed
    Pending --> Cancelled: User Cancels

    Processing --> Shipped: Items Packed
    Processing --> Failed: Out of Stock

    Shipped --> InTransit: Picked by Carrier
    InTransit --> Delivered: Package Received
    InTransit --> Returned: Delivery Failed

    Delivered --> Completed: Customer Confirms
    Delivered --> Refunded: Return Requested

    Returned --> Refunded: Return Processed
    Failed --> Refunded: Payment Reversed
    Cancelled --> [*]
    Completed --> [*]
    Refunded --> [*]

    note right of Processing
        Inventory check and
        warehouse allocation
    end note
\`\`\`
`)

const erDiagramContent = ref(`
## Database Schema

\`\`\`mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string customer_id PK
        string name
        string email UK
        string phone
        date created_at
    }
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        string order_id PK
        string customer_id FK
        date order_date
        string status
        float total_amount
    }
    ORDER_ITEM {
        string item_id PK
        string order_id FK
        string product_id FK
        int quantity
        float price
    }
    PRODUCT ||--o{ ORDER_ITEM : "ordered in"
    PRODUCT {
        string product_id PK
        string name
        string category
        float price
        int stock_quantity
    }
\`\`\`
`)

const ganttChartContent = ref(`
## Project Timeline

\`\`\`mermaid
gantt
    title Development Roadmap 2024
    dateFormat  YYYY-MM-DD
    section Planning
    Requirements Analysis   :done,    des1, 2024-01-01, 2024-01-15
    System Design          :done,    des2, 2024-01-10, 2024-01-25
    Technical Specs        :done,    des3, 2024-01-20, 2024-02-01

    section Development
    Backend API            :active,  dev1, 2024-02-01, 2024-03-15
    Frontend UI            :active,  dev2, 2024-02-15, 2024-03-30
    Database Setup         :done,    dev3, 2024-02-01, 2024-02-20
    Integration            :         dev4, 2024-03-15, 2024-04-01

    section Testing
    Unit Testing           :         test1, 2024-03-01, 2024-03-20
    Integration Testing    :         test2, 2024-03-20, 2024-04-10
    User Acceptance        :         test3, 2024-04-10, 2024-04-25

    section Deployment
    Staging Deploy         :         dep1, 2024-04-20, 2024-04-25
    Production Deploy      :         dep2, 2024-04-25, 2024-05-01
    Post-Launch Support    :         dep3, 2024-05-01, 2024-05-15
\`\`\`
`)

const pieChartContent = ref(`
## Technology Stack Distribution

\`\`\`mermaid
pie title Technology Usage in Project
    "TypeScript" : 35
    "Vue 3" : 25
    "Node.js" : 20
    "PostgreSQL" : 10
    "Docker" : 5
    "Others" : 5
\`\`\`
`)

const gitGraphContent = ref(`
## Git Branch Strategy

\`\`\`mermaid
gitGraph
    commit id: "Initial commit"
    commit id: "Setup project"

    branch develop
    checkout develop
    commit id: "Add authentication"
    commit id: "Add user service"

    branch feature/payment
    checkout feature/payment
    commit id: "Payment gateway"
    commit id: "Stripe integration"
    checkout develop
    merge feature/payment

    branch feature/ui
    checkout feature/ui
    commit id: "Dashboard UI"
    commit id: "Responsive design"
    checkout develop
    merge feature/ui

    checkout main
    merge develop tag: "v1.0.0"

    checkout develop
    commit id: "Bug fixes"

    branch hotfix/security
    checkout hotfix/security
    commit id: "Security patch"
    checkout main
    merge hotfix/security tag: "v1.0.1"

    checkout develop
    merge hotfix/security
\`\`\`
`)
</script>

<style scoped>
.mermaid-zoom-test {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.test-header {
  text-align: center;
  margin-bottom: 3rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(16, 185, 129, 0.05));
  border-radius: 16px;
  border: 1px solid rgba(139, 92, 246, 0.1);
}

h1 {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #8b5cf6, #10b981);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.125rem;
  color: #94a3b8;
  margin: 0;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.demo-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(139, 92, 246, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.demo-card:hover {
  border-color: rgba(139, 92, 246, 0.3);
  box-shadow: 0 10px 40px rgba(139, 92, 246, 0.1);
  transform: translateY(-2px);
}

.demo-card h3 {
  color: #a78bfa;
  font-size: 1.25rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.instructions {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.2));
  border: 1px solid rgba(139, 92, 246, 0.1);
  border-radius: 16px;
  padding: 2rem;
  margin-top: 3rem;
}

.instructions h2 {
  color: #e2e8f0;
  font-size: 1.75rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.instruction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.instruction-item {
  text-align: center;
}

.instruction-item .icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.instruction-item strong {
  display: block;
  color: #a78bfa;
  font-size: 1.125rem;
  margin-bottom: 1rem;
}

.instruction-item ul {
  text-align: left;
  color: #cbd5e1;
  font-size: 0.875rem;
  list-style: none;
  padding: 0;
}

.instruction-item li {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  position: relative;
}

.instruction-item li::before {
  content: '→';
  position: absolute;
  left: 0;
  color: #8b5cf6;
}

kbd {
  padding: 0.125rem 0.375rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8rem;
  color: #c4b5fd;
  margin: 0 0.25rem;
}

/* Responsive */
@media (max-width: 768px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 2rem;
  }

  .instruction-grid {
    grid-template-columns: 1fr;
  }
}
</style>