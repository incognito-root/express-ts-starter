import { User } from "../../generated/prisma/client";
import { PrismaTransactionClient } from "../types";
import { CreateUserDTO } from "../types/repository/user";
import prisma from "../utils/prismaClient";

import { BaseRepository } from "./BaseRepository";

export class UserRepository extends BaseRepository<User> {
  async findByEmail(
    email: string,
    includePassword = false,
    tx?: PrismaTransactionClient
  ) {
    const client = tx ?? prisma;
    return client.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
      },
      omit: {
        password: !includePassword,
      },
    });
  }

  async findByEmailOrId(
    email: string | undefined,
    id: string | undefined,
    tx?: PrismaTransactionClient
  ) {
    const client = tx ?? prisma;
    return client.user.findFirst({
      where: {
        OR: [{ id }, { email: { equals: email, mode: "insensitive" } }],
      },
    });
  }

  async findActiveById(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Omit<User, "password"> | null> {
    const client = tx ?? prisma;
    return client.user.findFirst({
      where: {
        id,
        isActive: true,
      },
    });
  }

  async findById(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Omit<User, "password"> | null> {
    const client = tx ?? prisma;
    return client.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: CreateUserDTO, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.user.create({
      data,
    });
  }

  async updateVerificationStatus(
    id: string,
    isVerified: boolean,
    tx?: PrismaTransactionClient
  ): Promise<Omit<User, "password">> {
    const client = tx ?? prisma;
    return client.user.update({
      where: { id },
      data: { isVerified },
    });
  }

  async deactivateUser(id: string, tx?: PrismaTransactionClient) {
    const client = tx ?? prisma;
    return client.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
