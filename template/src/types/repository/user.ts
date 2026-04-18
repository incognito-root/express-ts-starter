import { Role } from "../../../generated/prisma/enums";

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role: Role;
  isVerified?: boolean;
  isActive?: boolean;
}

export interface UpdateUserVerificationDTO {
  isVerified: boolean;
}
