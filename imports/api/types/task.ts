import type { MemberId } from './shared';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskComment {
  userId: string;
  text: string;
  createdAt: Date;
}

export interface Task {
  _id?: string;
  name: string;
  status?: string;
  participants?: MemberId[];
  priority?: TaskPriority;
  link?: string;
  description?: string;
  parent?: string;
  completedBy?: MemberId[];
  createdAt?: Date;
  comments?: TaskComment[];
}
