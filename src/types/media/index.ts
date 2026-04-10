export type StorageProvider = "cloudinary" | "s3" | "local";

export type ImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "image/svg+xml";

export type VideoMimeType = "video/mp4";

export type MediaMimeType = ImageMimeType | VideoMimeType;

export type ImageCategory = "logo" | "banner" | "photo" | "image" | "general";

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  format?: "jpeg" | "png" | "webp" | "avif";
  quality?: number;
  gravity?: "center" | "north" | "south" | "east" | "west" | "face" | "auto";
  radius?: number | "max";
  background?: string;
}

export interface UploadOptions {
  folder: string;
  publicId?: string;
  category: ImageCategory;
  transformation?: ImageTransformOptions;
  tags?: string[];
  overwrite?: boolean;
  organizationId?: string;
  entityId?: string;
}

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  originalFilename: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  provider: StorageProvider;
  createdAt: Date;
  resourceType: "image";
  etag?: string;
  folder: string;
  tags: string[];
}

export interface DeleteOptions {
  invalidate?: boolean;
}

export interface DeleteResult {
  success: boolean;
  publicId: string;
  provider: StorageProvider;
}

export interface TransformUrlOptions extends ImageTransformOptions {
  publicId: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: MediaMimeType;
  size?: number;
}

export interface FileValidationConfig {
  maxSize: number;
  allowedTypes: ImageMimeType[];
  minDimensions?: { width: number; height: number };
  maxDimensions?: { width: number; height: number };
}

export interface ImagePreset {
  name: ImageCategory;
  maxSize: number;
  allowedTypes: MediaMimeType[];
  folder: string;
  dimensions: {
    width: number;
    height: number;
  };
  transformation: ImageTransformOptions;
}

export interface IStorageProvider {
  readonly name: StorageProvider;
  isConfigured(): boolean;
  validateFile(
    file: UploadedFile,
    options: UploadOptions
  ): FileValidationResult;
  upload(file: Buffer | string, options: UploadOptions): Promise<UploadResult>;
  delete(publicId: string, options?: DeleteOptions): Promise<DeleteResult>;
  getTransformedUrl(options: TransformUrlOptions): string;
  getBaseUrl(): string;
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface MediaUploadResponse {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  size: number;
}
