# Persistent System Reminders - Implementation Summary

## Quick Overview

Simple REST API for adding persistent system reminders to opencode sessions that survive compaction.

## Core Design

### Data Model
```typescript
interface PersistentReminder {
  id: string
  message: string
  priority: 'low' | 'normal' | 'high'
  createdAt: string
  expiresAt?: string
  metadata?: Record<string, any>
}
```

### API Endpoints
- `POST /api/v1/sessions/{sessionID}/reminders` - Add reminder
- `GET /api/v1/sessions/{sessionID}/reminders` - List reminders
- `PUT /api/v1/sessions/{sessionID}/reminders/{id}` - Update reminder
- `DELETE /api/v1/sessions/{sessionID}/reminders/{id}` - Delete reminder
- `DELETE /api/v1/sessions/{sessionID}/reminders` - Clear all

## Implementation Steps

### 1. Create Storage Layer
**File**: `packages/opencode/src/session/persistent-reminders.ts`
```typescript
export class PersistentReminderStorage {
  static async get(sessionID: string): Promise<PersistentReminder[]>
  static async add(sessionID: string, reminder: Partial<PersistentReminder>): Promise<PersistentReminder>
  static async remove(sessionID: string, reminderID: string): Promise<boolean>
  // ... other CRUD operations
}
```

### 2. Create API Routes
**File**: `packages/opencode/src/server/reminder-routes.ts`
```typescript
export const reminderRoutes = new Hono()
  .post('/sessions/:sessionID/reminders', addReminder)
  .get('/sessions/:sessionID/reminders', listReminders)
  // ... other endpoints
```

### 3. Integrate with Existing Reminder System
**Modify**: `packages/opencode/src/session/todo-reminders.ts`
```typescript
export async function allReminders(sessionID: string): Promise<string[]> {
  const reminders = []

  // Existing todo reminders
  reminders.push(...await todoReminders(sessionID))

  // New persistent reminders
  const persistent = await PersistentReminderStorage.getActive(sessionID)
  reminders.push(...persistent.map(formatAsSystemReminder))

  return reminders
}
```

### 4. Add Routes to Server
**Modify**: `packages/opencode/src/server/server.ts`
```typescript
import { reminderRoutes } from './reminder-routes'

// Add to Server.App
.route('/api/v1', reminderRoutes)
```

### 5. Ensure Compaction Persistence
**Modify**: `packages/opencode/src/session/compaction.ts`
- Ensure reminder storage survives compaction
- Clean up expired reminders during compaction

## Key Features

- **Session-scoped**: Reminders tied to specific sessions
- **Priority levels**: low/normal/high with display ordering
- **Expiration**: Optional reminder expiration
- **Compaction-safe**: Survives session compaction
- **Validation**: Input validation and error handling
- **Rate limiting**: Max 50 reminders per session

## Usage Example
```bash
# Add a high-priority reminder
curl -X POST http://localhost:3000/api/v1/sessions/abc123/reminders \
  -H "Content-Type: application/json" \
  -d '{"message": "Run tests before commit", "priority": "high"}'

# List active reminders
curl http://localhost:3000/api/v1/sessions/abc123/reminders?active=true
```

## Files to Create/Modify

### New Files:
1. `packages/opencode/src/session/persistent-reminders.ts`
2. `packages/opencode/src/server/reminder-routes.ts`

### Modified Files:
1. `packages/opencode/src/session/todo-reminders.ts`
2. `packages/opencode/src/server/server.ts`
3. `packages/opencode/src/session/compaction.ts`

## Design Principles Achieved

✅ Simple API with minimal endpoints
✅ Persists across compaction
✅ Session-scoped storage
✅ Integrates with existing reminder system
✅ Follows opencode patterns and conventions