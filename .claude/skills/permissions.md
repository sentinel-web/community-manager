# /permissions

Show permission structure for a module.

## Usage
`/permissions` - List all permission modules
`/permissions <module>` - Show details for specific module

## Instructions

1. **Read permission configuration** from `server/main.js`
2. **Display module structure**
3. **Explain permission checks**

## Permission System Overview

### Boolean Modules
Simple true/false access:
- `dashboard` - View dashboard
- `orbat` - View organization chart
- `logs` - View audit logs
- `settings` - Access settings

### CRUD Modules
Granular read/create/update/delete:
- `members` - Member management
- `events` - Event management
- `tasks` - Task management
- `squads` - Squad management
- `ranks` - Rank management
- `specializations` - Specialization management
- `medals` - Medal management
- `eventTypes` - Event type management
- `taskStatus` - Task status management
- `registrations` - Registration management
- `discoveryTypes` - Discovery type management
- `roles` - Role management

## Permission Structure

### Boolean Permission
```javascript
{
  dashboard: true,  // Has access
  orbat: false,     // No access
}
```

### CRUD Permission
```javascript
{
  members: {
    read: true,
    create: true,
    update: true,
    delete: false,  // Can't delete
  }
}
```

### Legacy Format (auto-converted)
```javascript
{
  members: true,  // Becomes { read: true, create: true, update: true, delete: true }
}
```

## Checking Permissions

Server-side:
```javascript
const hasPermission = await checkPermission(userId, 'members', 'update');
if (!hasPermission) throw new Meteor.Error(403, 'Permission denied');
```

Client-side (in Section):
```javascript
const permissions = getModulePermissions(role, 'members');
// permissions = { canCreate, canUpdate, canDelete }
```

## Collection to Module Mapping

Some collections share permission modules:
- `attendances` → `events`
- `profilePictures` → `members`

## Output Format

```
## Permission Module: <name>

**Type:** Boolean | CRUD

### Operations
- read: <description>
- create: <description>
- update: <description>
- delete: <description>

### Used By
- <collection 1>
- <collection 2>

### Check Example
```javascript
await checkPermission(userId, '<module>', '<operation>');
```
```
