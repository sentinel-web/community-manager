import MembersCollection from '../../imports/api/collections/members.collection';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import type { Task } from '../../imports/api/types';
import { observeLive, type BotContext, type StopFn } from './bot';

/** Sends a direct message to every linked member who is newly assigned to a task (opt-in setting). */
export async function startTaskSync(context: BotContext): Promise<StopFn> {
  const { client, config, t, enqueue } = context;
  if (!config['discord-task-notifications']) return () => undefined;

  const notify = (task: Task, previous: string[] = []) => {
    const assigned = (task.participants ?? []).filter(id => !previous.includes(id));
    if (!assigned.length) return;
    enqueue(async () => {
      const members = await MembersCollection.find({ _id: { $in: assigned }, 'profile.discordId': { $exists: true } }, { fields: { 'profile.discordId': 1 } }).fetchAsync();
      for (const member of members) {
        // A member who blocks direct messages is not an error.
        await client.users.send(member.profile!.discordId!, t('discord.bot.taskAssigned', { name: task.name })).catch(() => undefined);
      }
    });
  };

  return observeLive(TasksCollection.find({}, { fields: { name: 1, participants: 1 } }), {
    added: task => notify(task),
    changed: (task, previous) => notify(task, previous.participants),
  });
}
