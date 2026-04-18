import { Organization } from "../../generated/prisma/client.js";
import { PrismaTransactionClient } from "../types/index.js";
import {
  CreateorganizationDTO,
  UpdateorganizationDTO,
  FindorganizationOptions,
} from "../types/repository/organization.js";
import prisma from "../utils/prismaClient.js";

import { BaseRepository } from "./BaseRepository.js";

export class organizationRepository extends BaseRepository<Organization> {
  async findBySlug(
    slug: string,
    tx?: PrismaTransactionClient
  ): Promise<Organization | null> {
    const client = tx ?? prisma;
    return client.organization.findUnique({
      where: { slug },
    });
  }

  async findActiveById(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organization | null> {
    const client = tx ?? prisma;
    return client.organization.findFirst({
      where: {
        id,
        isActive: true,
      },
    });
  }

  async findById(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organization | null> {
    const client = tx ?? prisma;
    return client.organization.findUnique({
      where: { id },
    });
  }

  async createorganization(
    data: CreateorganizationDTO,
    tx?: PrismaTransactionClient
  ): Promise<Organization> {
    const client = tx ?? prisma;
    return client.organization.create({
      data,
    });
  }

  async updateorganization(
    id: string,
    data: UpdateorganizationDTO,
    tx?: PrismaTransactionClient
  ): Promise<Organization> {
    const client = tx ?? prisma;
    return client.organization.update({
      where: { id },
      data,
    });
  }

  async deactivateorganization(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organization> {
    const client = tx ?? prisma;
    return client.organization.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async reactivateorganization(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organization> {
    const client = tx ?? prisma;
    return client.organization.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async findAllActive(
    options?: FindorganizationOptions,
    tx?: PrismaTransactionClient
  ): Promise<Organization[]> {
    const client = tx ?? prisma;
    return client.organization.findMany({
      where: {
        isActive: true,
      },
      ...options,
    });
  }

  async countActive(tx?: PrismaTransactionClient): Promise<number> {
    const client = tx ?? prisma;
    return client.organization.count({
      where: {
        isActive: true,
      },
    });
  }

  async findAll(
    options?: FindorganizationOptions & { includeInactive?: boolean },
    tx?: PrismaTransactionClient
  ): Promise<{ organizations: Organization[]; total: number }> {
    const client = tx ?? prisma;
    const where = options?.includeInactive ? {} : { isActive: true };

    const [organizations, total] = await Promise.all([
      client.organization.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy ?? { createdAt: "desc" },
      }),
      client.organization.count({ where }),
    ]);

    return { organizations, total };
  }

  async deleteorganization(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organization> {
    const client = tx ?? prisma;
    return client.organization.delete({
      where: { id },
    });
  }
}
