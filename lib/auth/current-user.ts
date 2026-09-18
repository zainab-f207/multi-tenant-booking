export interface CurrentUser {
  id: string;
  tenantId: string;
  roleName: string;
  email: string;
}

export class AuthNotImplementedError extends Error {
  constructor() {
    super(
      "getCurrentUser() is not implemented yet. Week 1 does not include a real authentication/session backend."
    );

    this.name = "AuthNotImplementedError";
  }
}

export async function getCurrentUser(): Promise<CurrentUser> {
  throw new AuthNotImplementedError();
}