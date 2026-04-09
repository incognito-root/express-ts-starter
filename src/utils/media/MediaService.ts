import { ERROR_MESSAGES } from "../../constants/errorMessages";
import { BadRequestError } from "../../errors/BadRequestError";
import { InternalServerError } from "../../errors/InternalServerError";
import {
  DeleteResult,
  ImageCategory,
  IStorageProvider,
  MediaUploadResponse,
  StorageProvider,
  TransformUrlOptions,
  UploadedFile,
  UploadOptions,
  UploadResult,
} from "../../types/media";
import logger from "../logger";

import { getCloudinaryProvider } from "./CloudinaryProvider";

interface MediaServiceConfig {
  defaultProvider: StorageProvider;
  fallbackProvider?: StorageProvider;
}

export class MediaService {
  private providers: Map<StorageProvider, IStorageProvider> = new Map();
  private defaultProvider: StorageProvider;
  private fallbackProvider?: StorageProvider;

  constructor(config?: Partial<MediaServiceConfig>) {
    this.defaultProvider = config?.defaultProvider || "cloudinary";
    this.fallbackProvider = config?.fallbackProvider;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const cloudinary = getCloudinaryProvider();
    if (cloudinary.isConfigured()) {
      this.providers.set("cloudinary", cloudinary);
      logger.info("Cloudinary storage provider initialized");
    }

    if (this.providers.size === 0) {
      logger.warn("No storage providers configured. Media uploads will fail.");
    }
  }

  private getProvider(preferred?: StorageProvider): IStorageProvider {
    const providerName = preferred || this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (provider) {
      return provider;
    }

    if (this.fallbackProvider) {
      const fallback = this.providers.get(this.fallbackProvider);
      if (fallback) {
        logger.warn(
          `Primary provider ${providerName} not available, using fallback ${this.fallbackProvider}`
        );
        return fallback;
      }
    }

    const [firstProvider] = this.providers.values();
    if (firstProvider) {
      logger.warn(
        `Requested provider ${providerName} not available, using ${firstProvider.name}`
      );
      return firstProvider;
    }

    throw new InternalServerError(ERROR_MESSAGES.CLOUDINARY_NOT_CONFIGURED);
  }

  isAvailable(): boolean {
    return this.providers.size > 0;
  }

  getAvailableProviders(): StorageProvider[] {
    return Array.from(this.providers.keys());
  }

  async upload(
    file: UploadedFile,
    category: ImageCategory,
    options: Partial<UploadOptions> = {}
  ): Promise<MediaUploadResponse> {
    const provider = this.getProvider();

    const uploadOptions: UploadOptions = {
      folder: options.folder || "",
      category,
      ...options,
    };

    const validation = provider.validateFile(file, uploadOptions);
    if (!validation.valid) {
      throw new BadRequestError(
        validation.error || ERROR_MESSAGES.INVALID_FILE_TYPE
      );
    }

    try {
      const result = await provider.upload(file.buffer, uploadOptions);
      return this.toMediaResponse(result);
    } catch (error) {
      logger.error("Media upload failed", {
        category,
        originalName: file.originalname,
        size: file.size,
        error: (error as Error).message,
      });

      throw new InternalServerError(ERROR_MESSAGES.ERROR_UPLOADING_FILE, {
        cause: error as Error,
      });
    }
  }

  async uploadFromUrl(
    url: string,
    category: ImageCategory,
    options: Partial<UploadOptions> = {}
  ): Promise<MediaUploadResponse> {
    const provider = this.getProvider();

    const uploadOptions: UploadOptions = {
      folder: options.folder || "",
      category,
      ...options,
    };

    try {
      const result = await provider.upload(url, uploadOptions);
      return this.toMediaResponse(result);
    } catch (error) {
      logger.error("Media upload from URL failed", {
        category,
        url,
        error: (error as Error).message,
      });

      throw new InternalServerError(ERROR_MESSAGES.ERROR_UPLOADING_FILE, {
        cause: error as Error,
      });
    }
  }

  async delete(publicId: string): Promise<DeleteResult> {
    const provider = this.getProvider();

    try {
      return await provider.delete(publicId, { invalidate: true });
    } catch (error) {
      logger.error("Media deletion failed", {
        publicId,
        error: (error as Error).message,
      });

      throw new InternalServerError(ERROR_MESSAGES.ERROR_DELETING_FILE, {
        cause: error as Error,
      });
    }
  }

  getTransformedUrl(options: TransformUrlOptions): string {
    const provider = this.getProvider();
    return provider.getTransformedUrl(options);
  }

  getThumbnailUrl(publicId: string, size: number = 150): string {
    return this.getTransformedUrl({
      publicId,
      width: size,
      height: size,
      fit: "cover",
      quality: 60,
      format: "webp",
    });
  }

  getResponsiveUrls(
    publicId: string,
    sizes: number[] = [320, 640, 960, 1280, 1920]
  ): Record<number, string> {
    const urls: Record<number, string> = {};

    for (const width of sizes) {
      urls[width] = this.getTransformedUrl({
        publicId,
        width,
        quality: 80,
        format: "webp",
      });
    }

    return urls;
  }

  private toMediaResponse(result: UploadResult): MediaUploadResponse {
    return {
      url: result.secureUrl,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
    };
  }
}

let mediaService: MediaService | null = null;

export function getMediaService(): MediaService {
  if (!mediaService) {
    mediaService = new MediaService();
  }
  return mediaService;
}

export default getMediaService;
