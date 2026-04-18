/**
 * Data Transfer Object for creating a new organization
 */
export interface CreateorganizationDTO {
  name: string;
  slug: string;
  isActive?: boolean;
}

/**
 * Data Transfer Object for updating an existing organization
 */
export interface UpdateorganizationDTO {
  name?: string;
  slug?: string;
  isActive?: boolean;
}

/**
 * Options for querying organizations with pagination and sorting
 */
export interface FindorganizationOptions {
  skip?: number;
  take?: number;
  orderBy?: Record<string, "asc" | "desc">;
}
