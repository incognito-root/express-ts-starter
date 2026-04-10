import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

import { getEnv } from "../../config/env";
import { getImagePreset } from "../../config/imagePresets";
import { ERROR_MESSAGES } from "../../constants/errorMessages";
import { InternalServerError } from "../../errors/InternalServerError";
import {
  DeleteOptions,
  DeleteResult,
  ImageTransformOptions,
  StorageProvider,
  TransformUrlOptions,
  UploadOptions,
  UploadResult,
} from "../../types/media";

import { BaseStorageProvider } from "./BaseStorageProvider";

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export class CloudinaryProvider extends BaseStorageProvider {
  readonly name: StorageProvider = "cloudinary";
  private configured: boolean = false;
  private cloudName: string = "";

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    const env = getEnv();
    const config: CloudinaryConfig = {
      cloudName: env.CLOUDINARY_CLOUD_NAME || "",
      apiKey: env.CLOUDINARY_API_KEY || "",
      apiSecret: env.CLOUDINARY_API_SECRET || "",
    };

    if (config.cloudName && config.apiKey && config.apiSecret) {
      cloudinary.config({
        cloud_name: config.cloudName,
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        secure: true,
      });

      this.cloudName = config.cloudName;
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getBaseUrl(): string {
    return `https://res.cloudinary.com/${this.cloudName}`;
  }

  async upload(
    file: Buffer | string,
    options: UploadOptions
  ): Promise<UploadResult> {
    if (!this.configured) {
      throw new InternalServerError(ERROR_MESSAGES.CLOUDINARY_NOT_CONFIGURED);
    }

    try {
      const preset = getImagePreset(options.category);
      const folder = this.buildFolderPath(options);
      const publicId = this.generatePublicId(
        options,
        options.publicId || "image"
      );

      // Use "auto" for banner/general to support video, "image" for others
      const resourceType = ["banner", "general"].includes(options.category)
        ? "auto"
        : "image";

      const transformation =
        resourceType === "auto"
          ? undefined
          : this.buildTransformation(
              options.transformation || preset.transformation
            );

      const uploadOptions: Record<string, unknown> = {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: options.overwrite ?? false,
        tags: [...(options.tags || []), options.category],
      };

      if (transformation) {
        uploadOptions.transformation = transformation;
      }

      if (options.organizationId) {
        (uploadOptions.tags as string[]).push(`org:${options.organizationId}`);
      }

      if (options.entityId) {
        (uploadOptions.tags as string[]).push(`entity:${options.entityId}`);
      }

      let result: UploadApiResponse;

      if (Buffer.isBuffer(file)) {
        result = await new Promise<UploadApiResponse>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                reject(error);
              } else if (result) {
                resolve(result);
              } else {
                reject(new InternalServerError("Upload failed with no result"));
              }
            }
          );
          uploadStream.end(file);
        });
      } else {
        result = await cloudinary.uploader.upload(file, uploadOptions);
      }

      const uploadResult: UploadResult = {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        originalFilename:
          result.original_filename || options.publicId || "image",
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        provider: this.name,
        createdAt: new Date(result.created_at),
        resourceType: "image",
        etag: result.etag,
        folder: (result.folder as string) || folder,
        tags: result.tags || [],
      };

      this.logUploadSuccess(uploadResult, options);
      return uploadResult;
    } catch (error) {
      this.logUploadError(error as Error, options);
      throw error;
    }
  }

  async delete(
    publicId: string,
    options?: DeleteOptions
  ): Promise<DeleteResult> {
    if (!this.configured) {
      throw new InternalServerError(ERROR_MESSAGES.CLOUDINARY_NOT_CONFIGURED);
    }

    try {
      const deleteOptions: Record<string, unknown> = {
        resource_type: "image",
        invalidate: options?.invalidate ?? true,
      };

      const result = (await cloudinary.uploader.destroy(
        publicId,
        deleteOptions
      )) as { result: string };

      const deleteResult: DeleteResult = {
        success: result.result === "ok",
        publicId,
        provider: this.name,
      };

      if (deleteResult.success) {
        this.logDeleteSuccess(publicId);
      }

      return deleteResult;
    } catch (error) {
      this.logDeleteError(error as Error, publicId);
      throw error;
    }
  }

  getTransformedUrl(options: TransformUrlOptions): string {
    if (!this.configured) {
      throw new InternalServerError(ERROR_MESSAGES.CLOUDINARY_NOT_CONFIGURED);
    }

    const transformation = this.buildTransformation(options);

    return cloudinary.url(options.publicId, {
      transformation,
      secure: true,
    });
  }

  private buildTransformation(
    options: ImageTransformOptions
  ): Record<string, unknown>[] {
    const transformation: Record<string, unknown> = {};

    if (options.width) transformation.width = options.width;
    if (options.height) transformation.height = options.height;

    if (options.fit) {
      const fitMap: Record<string, string> = {
        cover: "fill",
        contain: "fit",
        fill: "scale",
        inside: "limit",
        outside: "mfit",
      };
      transformation.crop = fitMap[options.fit] || options.fit;
    }

    if (options.gravity) {
      const gravityMap: Record<string, string> = {
        center: "center",
        north: "north",
        south: "south",
        east: "east",
        west: "west",
        face: "face",
        auto: "auto",
      };
      transformation.gravity = gravityMap[options.gravity] || options.gravity;
    }

    if (options.quality) transformation.quality = options.quality;
    if (options.format) transformation.fetch_format = options.format;
    if (options.radius) transformation.radius = options.radius;
    if (options.background) {
      transformation.background = options.background.replace("#", "");
    }

    return [transformation];
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
}

let cloudinaryProvider: CloudinaryProvider | null = null;

export function getCloudinaryProvider(): CloudinaryProvider {
  if (!cloudinaryProvider) {
    cloudinaryProvider = new CloudinaryProvider();
  }
  return cloudinaryProvider;
}
