# /logs

Check recent audit logs for debugging.

## Usage
`/logs` - Show recent 20 logs
`/logs <count>` - Show specific number of logs
`/logs <action>` - Filter by action (e.g., `/logs members.created`)

## Instructions

1. **Query the logs collection** to fetch recent entries
2. **Format output** for readability
3. **Highlight important information**

## Log Structure

Logs are stored in the `logs` collection with:
- `action` - What happened (e.g., `members.created`, `events.updated`)
- `data` - Associated data (id, changes, etc.)
- `createdAt` - Timestamp
- `userId` - Who performed the action (if available)

## Commands

To query logs programmatically:

```javascript
// In Meteor shell or server code
const logs = await LogsCollection.find(
  {},
  { sort: { createdAt: -1 }, limit: 20 }
).fetchAsync();
```

## Output Format

```
## Recent Logs

| Time | Action | Data |
|------|--------|------|
| <timestamp> | <action> | <summary> |
| ... | ... | ... |

### Details

#### <Action 1>
- **Time:** <full timestamp>
- **Data:** <formatted JSON>
```

## Common Actions

- `<collection>.created` - New document inserted
- `<collection>.updated` - Document modified
- `<collection>.deleted` - Document removed

## Debugging Tips

- Filter by collection to trace specific changes
- Check timestamps to correlate with user reports
- Look for patterns in error-related logs
- Use data field to see what changed
