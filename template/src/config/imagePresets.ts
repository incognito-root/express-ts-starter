import {
  ImageCategory,
  ImageMimeType,
  ImagePreset,
  ImageTransformOptions,
  MediaMimeType,
} from "../types/media";

const STANDARD_IMAGE_TYPES: ImageMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const ALL_IMAGE_TYPES: ImageMimeType[] = [
  ...STANDARD_IMAGE_TYPES,
  "image/gif",
  "image/svg+xml",
];

const ALL_MEDIA_TYPES: MediaMimeType[] = [...ALL_IMAGE_TYPES, "video/mp4"];

export const FILE_SIZE_LIMITS = {
  /** 2MB for logos and avatars */
  SMALL: 2 * 1024 * 1024,
  /** 5MB for standard images */
  MEDIUM: 5 * 1024 * 1024,
  /** 10MB for banners and large images */
  LARGE: 10 * 1024 * 1024,
} as const;

const DEFAULT_OPTIMIZATION: ImageTransformOptions = {
  quality: 85,
  format: "webp",
};

export const IMAGE_PRESETS: Record<ImageCategory, ImagePreset> = {
  logo: {
    name: "logo",
    maxSize: FILE_SIZE_LIMITS.SMALL,
    allowedTypes: ALL_IMAGE_TYPES,
    folder: "logos",
    dimensions: { width: 400, height: 400 },
    transformation: {
      ...DEFAULT_OPTIMIZATION,
      width: 400,
      height: 400,
      fit: "contain",
      background: "transparent",
    },
  },

  banner: {
    name: "banner",
    maxSize: FILE_SIZE_LIMITS.LARGE,
    allowedTypes: ALL_MEDIA_TYPES,
    folder: "banners",
    dimensions: { width: 1920, height: 480 },
    transformation: {
      ...DEFAULT_OPTIMIZATION,
      width: 1920,
      height: 480,
      fit: "cover",
      gravity: "center",
    },
  },

  photo: {
    name: "photo",
    maxSize: FILE_SIZE_LIMITS.SMALL,
    allowedTypes: STANDARD_IMAGE_TYPES,
    folder: "photos",
    dimensions: { width: 400, height: 400 },
    transformation: {
      ...DEFAULT_OPTIMIZATION,
      width: 400,
      height: 400,
      fit: "cover",
      gravity: "face",
    },
  },

  image: {
    name: "image",
    maxSize: FILE_SIZE_LIMITS.MEDIUM,
    allowedTypes: STANDARD_IMAGE_TYPES,
    folder: "images",
    dimensions: { width: 1200, height: 900 },
    transformation: {
      ...DEFAULT_OPTIMIZATION,
      width: 1200,
      height: 900,
      fit: "inside",
    },
  },

  general: {
    name: "general",
    maxSize: FILE_SIZE_LIMITS.MEDIUM,
    allowedTypes: ALL_IMAGE_TYPES,
    folder: "general",
    dimensions: { width: 1200, height: 1200 },
    transformation: {
      ...DEFAULT_OPTIMIZATION,
      fit: "inside",
    },
  },
};

export function getImagePreset(category: ImageCategory): ImagePreset {
  return IMAGE_PRESETS[category];
}

export function getUploadFolder(
  category: ImageCategory,
  organizationId?: string,
  entityId?: string
): string {
  const preset = IMAGE_PRESETS[category];
  let folder = preset.folder;

  if (organizationId) {
    folder = `orgs/${organizationId}/${folder}`;
  }

  if (entityId) {
    folder = `${folder}/${entityId}`;
  }

  return folder;
}
