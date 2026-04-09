import { Organisation } from "../../generated/prisma";
import { PrismaTransactionClient } from "../types";
import {
  CreateOrganisationDTO,
  UpdateOrganisationDTO,
  FindOrganisationOptions,
} from "../types/repository/organisation";
import prisma from "../utils/prismaClient";

import { BaseRepository } from "./BaseRepository";

export class OrganisationRepository extends BaseRepository<Organisation> {
  async findBySlug(
    slug: string,
    tx?: PrismaTransactionClient
  ): Promise<Organisation | null> {
    const client = tx ?? prisma;
    return client.organisation.findUnique({
      where: { slug },
    });
  }

  async findActiveById(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organisation | null> {
    const client = tx ?? prisma;
    return client.organisation.findFirst({
      where: {
        id,
        isActive: true,
      },
    });
  }

  async findById(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organisation | null> {
    const client = tx ?? prisma;
    return client.organisation.findUnique({
      where: { id },
    });
  }

  async createOrganisation(
    data: CreateOrganisationDTO,
    tx?: PrismaTransactionClient
  ): Promise<Organisation> {
    const client = tx ?? prisma;
    return client.organisation.create({
      data,
    });
  }

  async updateOrganisation(
    id: string,
    data: UpdateOrganisationDTO,
    tx?: PrismaTransactionClient
  ): Promise<Organisation> {
    const client = tx ?? prisma;
    return client.organisation.update({
      where: { id },
      data,
    });
  }

  async deactivateOrganisation(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organisation> {
    const client = tx ?? prisma;
    return client.organisation.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async reactivateOrganisation(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organisation> {
    const client = tx ?? prisma;
    return client.organisation.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async findAllActive(
    options?: FindOrganisationOptions,
    tx?: PrismaTransactionClient
  ): Promise<Organisation[]> {
    const client = tx ?? prisma;
    return client.organisation.findMany({
      where: {
        isActive: true,
      },
      ...options,
    });
  }

  async countActive(tx?: PrismaTransactionClient): Promise<number> {
    const client = tx ?? prisma;
    return client.organisation.count({
      where: {
        isActive: true,
      },
    });
  }

  async findAll(
    options?: FindOrganisationOptions & { includeInactive?: boolean },
    tx?: PrismaTransactionClient
  ): Promise<{ organisations: Organisation[]; total: number }> {
    const client = tx ?? prisma;
    const where = options?.includeInactive ? {} : { isActive: true };

    const [organisations, total] = await Promise.all([
      client.organisation.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        orderBy: options?.orderBy ?? { createdAt: "desc" },
      }),
      client.organisation.count({ where }),
    ]);

    return { organisations, total };
  }

  async deleteOrganisation(
    id: string,
    tx?: PrismaTransactionClient
  ): Promise<Organisation> {
    const client = tx ?? prisma;
    return client.organisation.delete({
      where: { id },
    });
  }
}
