import { Role } from "../../generated/prisma";
import { ERROR_MESSAGES } from "../constants/errorMessages";
import { InternalServerError } from "../errors/InternalServerError";
import { UserRepository } from "../repositories/UserRepository";

const userRepository = new UserRepository();

export const createUser = async (
  name: string,
  email: string,
  password: string,
  role: Role
) => {
  try {
    const newUser = await userRepository.createUser({
      name,
      email,
      password,
      role,
    });

    return newUser;
  } catch (error: unknown) {
    throw new InternalServerError(ERROR_MESSAGES.ERROR_CREATING_USER, {
      cause: error as Error,
    });
  }
};

export const getUser = async (
  userId: string | undefined,
  email: string | undefined
) => {
  try {
    const user = await userRepository.findByEmailOrId(email, userId);
    return user;
  } catch (error: unknown) {
    throw new InternalServerError(ERROR_MESSAGES.ERROR_FETCHING_USERS, {
      cause: error as Error,
    });
  }
};
