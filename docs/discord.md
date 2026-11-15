# Discord Integration

Two-way sync between the app and one Discord server, run by a bot inside the Meteor server process
(`server/discord/`, discord.js). Configure it under **Settings → Discord Integration** (requires the
`settings` permission).

## Setup

1. Create an application and bot in the Discord Developer Portal. Enable the privileged
   **Server Members Intent**; enable **Message Content Intent** only if spam protection is used.
2. Invite the bot with the `bot` and `applications.commands` scopes and these permissions:
   Manage Roles, Manage Events, Create Events, Send Messages, Create Public Threads, Manage Threads,
   Manage Messages and Moderate Members (the last two only for spam protection).
3. Move the bot's own role **above** every role it should assign — Discord refuses role changes
   at or above the bot's highest role.
4. In the app: enter the bot token and server ID, enable the integration, save. Once the status
   shows "Connected", pick the channels and map ranks, roles, squads and specializations to
   Discord roles in their forms.
5. Link members (see below), then run **Synchronize all members now** once.

The status line on the settings page shows the connection state and the last runtime error
(for example a missing permission).

## Linking members

Members are matched by Discord user ID (`profile.discordId`), never by username — a username is
editable text and would let one member receive another member's changes.

- **Self-service:** a member opens their own profile → *Link Discord account* → runs the shown
  `/link code:…` command on the server. The code is single-use and valid for 10 minutes.
- **Bootstrap:** *Link members by Discord username* links every unlinked member whose stored
  Discord username matches exactly one server member. Use it once, if the stored usernames are trusted.
- `/unlink`, or *Unlink* on the profile, removes the link; the bot then removes the managed roles.

## What is synced

| Feature | Web → Discord | Discord → web |
|---|---|---|
| Ranks, squads, specializations | Mapped roles are granted/removed when the member changes | Granting/removing a mapped role updates the member (switch off with *Apply Discord role changes*). A rank can be replaced but not removed. With squad-scoped permissions enabled, squads are web → Discord only, because the squad decides what a member may access |
| Permission roles | Mapped role is granted/removed | **Never** — a Discord role must not grant permissions in the app |
| Events (event types with *Mirror events to Discord*, never private events) | Scheduled event and announcement are created, updated and deleted with the event | Renaming/rescheduling the scheduled event updates the event. Deleting it detaches it (the event stays, it is not recreated) |
| Event sign-up | The announcement lists the attendees | The *Sign up / sign off* button and "Interested" on the scheduled event |
| Registrations | New application is posted (name, requested ID, Discord username only), optionally with a thread; marked and archived once accepted or removed | — (accepting creates an account and stays in the app) |
| Tasks | Optional direct message on assignment | `/tasks` lists open tasks |

Slash commands (replies are visible to the caller only): `/link`, `/unlink`, `/events`, `/tasks`, `/profile`.

Roles that are not mapped are never touched. Changes made while the bot was offline are not
replayed; *Synchronize all members now* pushes the web state of every linked member to Discord.
A backup restore stops the bot for its duration and restarts it afterwards.
Events that existed before their event type was switched to mirroring are announced on their next edit.

## Security model

- The bot token is stored encrypted (AES-256-GCM, `server/encryption.ts`) and is write-only: it is
  excluded from the `settings` publication and from `settings.findOne`.
- The encryption key comes from `/run/secrets/encryption_key` (generated per stack by
  `scripts/deploy.sh`), or `Meteor.settings.private.encryptionKey`. Outside production a fixed
  development key is used. A backup restored into a stack with a different key needs the token re-entered.
- All `discord-*` settings are written through `discord.configure`; `settings.upsert` rejects them.
- `profile.discordId`, `discordEventId` and `discordMessageId` are server-owned and rejected or
  ignored on client writes.
- Nothing the bot posts can ping `@everyone` or users; only the recruiter roles on a new application
  and the muted member in a spam warning are mentioned.
- Changes that originate in Discord are written to the audit log (`discord.*`, `events.rsvp.*` with `via: 'discord'`).

## Code map

- `server/discord/bot.ts` — lifecycle (`startDiscordBot`), status, the serial work queue, `observeLive`
- `memberSync.ts`, `eventSync.ts`, `registrationSync.ts`, `taskSync.ts`, `commands.ts`, `spamProtection.ts` — one feature each
- `imports/api/discord/` — pure logic (role diff, rich text → markdown, settings keys), unit-tested in `tests/server/discordRoleSync.test.ts`
- `server/apis/discord.server.ts` — Meteor methods (`discord.configure`, `.guild`, `.syncMembers`, `.linkByTag`, `.createLinkCode`, `.unlink`)

The bot runs in every server process. Run a single app instance, or the Discord side is written twice.
