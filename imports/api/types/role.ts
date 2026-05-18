export interface CrudPermission {
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
}

export interface Role {
  discordRoleId?: string;
  _id?: string;
  name: string;
  color?: string;
  description?: string;
  roles?: boolean | CrudPermission;
  dashboard?: boolean;
  orbat?: boolean;
  logs?: boolean;
  settings?: boolean;
  members?: boolean | CrudPermission;
  events?: boolean | CrudPermission;
  tasks?: boolean | CrudPermission;
  squads?: boolean | CrudPermission;
  ranks?: boolean | CrudPermission;
  specializations?: boolean | CrudPermission;
  medals?: boolean | CrudPermission;
  eventTypes?: boolean | CrudPermission;
  briefingTemplates?: boolean | CrudPermission;
  taskStatus?: boolean | CrudPermission;
  registrations?: boolean | CrudPermission;
  discoveryTypes?: boolean | CrudPermission;
  positions?: boolean | CrudPermission;
  questionnaires?: boolean | CrudPermission;
  canCreateEvents?: boolean;
  canManageTasks?: boolean;
  canManageSpecializations?: boolean;
  // Not checked anywhere on the server, so it grants nothing. Kept (rather than
  // stripped on write) so existing roles and backups round-trip unchanged until
  // a behaviour is defined (#357); RolesForm renders it disabled, labelled as
  // having no effect, so the stored value stays visible instead of hidden.
  canManageRecruits?: boolean;
}
