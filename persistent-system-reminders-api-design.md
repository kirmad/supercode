# Persistent System Reminders API Design

## Overview

Design for a simple API to add persistent system reminders to opencode sessions that persist across compaction.

## Requirements

- **Simple API**: Minimal endpoints for CRUD operations
- **Persistence**: Reminders survive session compaction
- **Session-scoped**: Reminders are tied to specific sessions
- **Integration**: Works with existing reminder infrastructure

## Data Model

### PersistentReminder Interface
```typescript
interface PersistentReminder {
  id: string                    // Unique identifier
  message: string              // Reminder content
  priority: 'low' | 'normal' | 'high'  // Priority level (affects display order)
  createdAt: string           // ISO timestamp
  expiresAt?: string          // Optional expiration timestamp
  metadata?: Record<string, any>  // Optional metadata
}
```

### Storage Structure
```typescript
interface SessionReminders {
  sessionID: string
  reminders: PersistentReminder[]
  lastUpdated: string
}
```

## API Endpoints

### Base Path: `/api/v1/sessions/{sessionID}/reminders`

### 1. Add Reminder
```
POST /api/v1/sessions/{sessionID}/reminders
Content-Type: application/json

{
  "message": "string (required)",
  "priority": "low" | "normal" | "high" (optional, default: "normal"),
  "expiresAt": "ISO string (optional)",
  "metadata": "object (optional)"
}

Response: 201 Created
{
  "id": "string",
  "message": "string",
  "priority": "normal",
  "createdAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-01-02T00:00:00Z",
  "metadata": {}
}
```

### 2. List Reminders
```
GET /api/v1/sessions/{sessionID}/reminders
Query Parameters:
  - priority: filter by priority level
  - active: boolean (exclude expired reminders)

Response: 200 OK
{
  "reminders": [PersistentReminder],
  "count": number
}
```

### 3. Update Reminder
```
PUT /api/v1/sessions/{sessionID}/reminders/{reminderID}
Content-Type: application/json

{
  "message": "string (optional)",
  "priority": "low" | "normal" | "high" (optional)",
  "expiresAt": "ISO string (optional)",
  "metadata": "object (optional)"
}

Response: 200 OK
{
  // Updated PersistentReminder
}
```

### 4. Delete Reminder
```
DELETE /api/v1/sessions/{sessionID}/reminders/{reminderID}

Response: 204 No Content
```

### 5. Clear All Reminders
```
DELETE /api/v1/sessions/{sessionID}/reminders

Response: 204 No Content
```

## Storage Mechanism

### Storage Location
- Store in session metadata that survives compaction
- Use existing session storage infrastructure
- File: `packages/opencode/src/session/persistent-reminders.ts`

### Storage Implementation
```typescript
// Session-scoped storage using existing session infrastructure
export class PersistentReminderStorage {
  private static readonly STORAGE_KEY = 'persistent_reminders'

  static async get(sessionID: string): Promise<PersistentReminder[]>
  static async set(sessionID: string, reminders: PersistentReminder[]): Promise<void>
  static async add(sessionID: string, reminder: Omit<PersistentReminder, 'id' | 'createdAt'>): Promise<PersistentReminder>
  static async remove(sessionID: string, reminderID: string): Promise<boolean>
  static async clear(sessionID: string): Promise<void>
}
```

### Compaction Integration
- Store reminders in session metadata that's preserved during compaction
- Integrate with existing CompactionManager to ensure persistence
- Clean up expired reminders during compaction

## Integration Points

### 1. Modify Existing Reminder System
Update `packages/opencode/src/session/todo-reminders.ts`:

```typescript
export async function allReminders(sessionID: string): Promise<string[]> {
  const reminders: string[] = []

  // Get ephemeral todo reminders (existing)
  const todoReminders = await todoReminders(sessionID)
  reminders.push(...todoReminders)

  // Get persistent system reminders (new)
  const persistentReminders = await PersistentReminderStorage.getActive(sessionID)
  const systemReminders = persistentReminders
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .map(r => `<system-reminder>\n${r.message}\n</system-reminder>`)
  reminders.push(...systemReminders)

  return reminders
}
```

### 2. Server Route Integration
Create new route file: `packages/opencode/src/server/reminder-routes.ts`

```typescript
export const reminderRoutes = new Hono()
  .post('/sessions/:sessionID/reminders', addReminder)
  .get('/sessions/:sessionID/reminders', listReminders)
  .put('/sessions/:sessionID/reminders/:reminderID', updateReminder)
  .delete('/sessions/:sessionID/reminders/:reminderID', deleteReminder)
  .delete('/sessions/:sessionID/reminders', clearReminders)
```

### 3. Main Server Integration
Update `packages/opencode/src/server/server.ts`:

```typescript
import { reminderRoutes } from './reminder-routes'

// Add to Server.App
.route('/api/v1', reminderRoutes)
```

## Implementation Files

### New Files to Create:
1. `packages/opencode/src/session/persistent-reminders.ts` - Storage and business logic
2. `packages/opencode/src/server/reminder-routes.ts` - API routes and handlers

### Files to Modify:
1. `packages/opencode/src/session/todo-reminders.ts` - Integrate persistent reminders
2. `packages/opencode/src/server/server.ts` - Add route registration
3. `packages/opencode/src/session/compaction.ts` - Ensure reminders survive compaction

## Error Handling

### HTTP Status Codes:
- `200 OK` - Successful operations
- `201 Created` - Reminder created
- `204 No Content` - Successful deletion
- `400 Bad Request` - Invalid input
- `404 Not Found` - Session or reminder not found
- `500 Internal Server Error` - Server errors

### Validation:
- Required fields validation
- Message length limits (max 1000 characters)
- Priority enum validation
- ISO timestamp validation for dates
- Session existence validation

## Security Considerations

- **Session Validation**: Ensure session exists before operations
- **Input Sanitization**: Sanitize reminder messages
- **Rate Limiting**: Prevent spam (max 50 reminders per session)
- **Size Limits**: Limit reminder message size and metadata

## Usage Examples

### Adding a High-Priority Reminder
```bash
curl -X POST http://localhost:3000/api/v1/sessions/session-123/reminders \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Remember to run tests before committing",
    "priority": "high"
  }'
```

### Listing Active Reminders
```bash
curl http://localhost:3000/api/v1/sessions/session-123/reminders?active=true
```

### Removing a Reminder
```bash
curl -X DELETE http://localhost:3000/api/v1/sessions/session-123/reminders/reminder-456
```

## Future Enhancements

- **Categories/Tags**: Group reminders by category
- **Recurring Reminders**: Support for recurring reminders
- **Rich Content**: Support for markdown or structured content
- **Triggers**: Context-based reminder triggers
- **Templates**: Predefined reminder templates