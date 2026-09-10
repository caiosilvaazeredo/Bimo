import { SetMetadata } from '@nestjs/common';
import { ProfessorRole } from '../../professor/professor-role.enum';

export const ROLES_KEY = 'roles';

/** RBAC (RNF-SEC-03): restringe a rota aos papéis informados. */
export const Roles = (...roles: ProfessorRole[]) =>
  SetMetadata(ROLES_KEY, roles);
