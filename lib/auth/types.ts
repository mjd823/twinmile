export type UserRole = "admin" | "driver";

export type AuthUser = {
  _id: unknown;
  email: string;
  role: UserRole;
  mustChangePassword?: boolean;
};

export type Session = {
  _id: unknown;
  userId: unknown;
  tokenHash: string;
  role: UserRole;
  createdAt: Date;
  expiresAt: Date;
};
