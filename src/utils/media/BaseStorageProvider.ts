import { getImagePreset } from "../../config/imagePresets";
import {
  IStorageProvider,
  StorageProvider,
  UploadOptions,
  UploadResult,
  DeleteOptions,
  DeleteResult,
  TransformUrlOptions,
  UploadedFile,
  FileValidationResult,
  MediaMimeType,
} from "../../types/media";
import logger from "../logger";

export abstract class BaseStorageProvider implements IStorageProvider {
  abstract readonly name: StorageProvider;

  abstract isConfigured(): boolean;

  abstract upload(
    file: Buffer | string,
    options: UploadOptions
  ): Promise<UploadResult>;

  abstract delete(
    publicId: string,
    options?: DeleteOptions
  ): Promise<DeleteResult>;

  abstract getTransformedUrl(options: TransformUrlOptions): string;

  abstract getBaseUrl(): string;

  validateFile(
    file: UploadedFile,
    options: UploadOptions
  ): FileValidationResult {
    const preset = getImagePreset(options.category);

    if (file.size > preset.maxSize) {
      const maxSizeMB = (preset.maxSize / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
        size: file.size,
      };
    }

    const mimeType = file.mimetype as MediaMimeType;
    if (!preset.allowedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `File type "${file.mimetype}" is not allowed. Allowed types: ${preset.allowedTypes.join(", ")}`,
        mimeType,
        size: file.size,
      };
    }

    return {
      valid: true,
      mimeType,
      size: file.size,
    };
  }

  protected generatePublicId(
    options: UploadOptions,
    originalFilename: string
  ): string {
    const baseName = originalFilename.replace(/\.[^/.]+$/, "");

    const sanitized = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);

    if (options.publicId) {
      return options.publicId;
    }

    const parts: string[] = [options.category];

    if (options.entityId) {
      parts.push(options.entityId.substring(0, 8));
    }

    parts.push(sanitized || "image");
    parts.push(`${timestamp}-${random}`);

    return parts.join("-");
  }

  protected buildFolderPath(options: UploadOptions): string {
    const preset = getImagePreset(options.category);
    let folder = options.folder || preset.folder;

    if (options.organizationId) {
      folder = `orgs/${options.organizationId}/${folder}`;
    }

    return folder;
  }

  protected logUploadSuccess(
    result: UploadResult,
    options: UploadOptions
  ): void {
    logger.info("File uploaded successfully", {
      provider: this.name,
      publicId: result.publicId,
      category: options.category,
      size: result.bytes,
      format: result.format,
      dimensions: `${result.width}x${result.height}`,
      organizationId: options.organizationId,
      entityId: options.entityId,
    });
  }

  protected logUploadError(error: Error, options: UploadOptions): void {
    logger.error("File upload failed", {
      provider: this.name,
      category: options.category,
      organizationId: options.organizationId,
      entityId: options.entityId,
      error: error.message,
    });
  }

  protected logDeleteSuccess(publicId: string): void {
    logger.info("File deleted successfully", {
      provider: this.name,
      publicId,
    });
  }

  protected logDeleteError(error: Error, publicId: string): void {
    logger.error("File deletion failed", {
      provider: this.name,
      publicId,
      error: error.message,
    });
  }
}
