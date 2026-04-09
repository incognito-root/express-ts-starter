/**
 * Data Transfer Object for creating a new organisation
 */
export interface CreateOrganisationDTO {
  name: string;
  slug: string;
  isActive?: boolean;
}

/**
 * Data Transfer Object for updating an existing organisation
 */
export interface UpdateOrganisationDTO {
  name?: string;
  slug?: string;
  isActive?: boolean;
}

/**
 * Options for querying organisations with pagination and sorting
 */
export interface FindOrganisationOptions {
  skip?: number;
  take?: number;
  orderBy?: Record<string, "asc" | "desc">;
}
