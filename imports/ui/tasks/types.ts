import type { Task } from '/imports/api/types/task';

export interface TaskFilterModel {
  type?: string;
  status?: string[];
  participants?: Task['participants'];
}
