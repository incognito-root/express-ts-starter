import { Request, Response } from "express";
import multer, { FileFilterCallback, Multer, StorageEngine } from "multer";

import { FILE_SIZE_LIMITS } from "../config/imagePresets";
import { ERROR_MESSAGES } from "../constants/errorMessages";
import { BadRequestError } from "../errors/BadRequestError";
import { ImageMimeType, MediaMimeType } from "../types/media";

const ALLOWED_IMAGE_TYPES: ImageMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const ALLOWED_MEDIA_TYPES: MediaMimeType[] = [
  ...ALLOWED_IMAGE_TYPES,
  "video/mp4",
];

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  const mimeType = file.mimetype as ImageMimeType;

  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    callback(null, true);
  } else {
    callback(new BadRequestError(ERROR_MESSAGES.INVALID_FILE_TYPE));
  }
};

const mediaFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  const mimeType = file.mimetype as MediaMimeType;

  if (ALLOWED_MEDIA_TYPES.includes(mimeType)) {
    callback(null, true);
  } else {
    callback(new BadRequestError(ERROR_MESSAGES.INVALID_FILE_TYPE));
  }
};

const memoryStorage: StorageEngine = multer.memoryStorage();

function createUploader(maxSize: number): Multer {
  return multer({
    storage: memoryStorage,
    fileFilter: imageFileFilter,
    limits: {
      fileSize: maxSize,
      files: 1,
    },
  });
}

export const uploadSmall = createUploader(FILE_SIZE_LIMITS.SMALL);

export const uploadMedium = createUploader(FILE_SIZE_LIMITS.MEDIUM);

export const uploadLarge = createUploader(FILE_SIZE_LIMITS.LARGE);

const uploadLargeMedia = multer({
  storage: memoryStorage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: FILE_SIZE_LIMITS.LARGE,
    files: 1,
  },
});

export const singleUpload = {
  logo: uploadSmall.single("logo"),

  banner: uploadLargeMedia.single("banner"),

  photo: uploadSmall.single("photo"),

  image: uploadMedium.single("image"),

  /** Generic factory: use any field name and size */
  field: (fieldName: string, size: "small" | "medium" | "large" = "medium") => {
    const uploader =
      size === "small"
        ? uploadSmall
        : size === "large"
          ? uploadLarge
          : uploadMedium;
    return uploader.single(fieldName);
  },
};

export const multipleUpload = {
  images: multer({
    storage: memoryStorage,
    fileFilter: imageFileFilter,
    limits: {
      fileSize: FILE_SIZE_LIMITS.MEDIUM,
      files: 5,
    },
  }).array("images", 5),
};

export function handleMulterError(
  error: Error,
  _req: Request,
  _res: Response,
  next: (err?: Error) => void
): void {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      next(new BadRequestError(ERROR_MESSAGES.FILE_SIZE_EXCEEDED));
    } else if (error.code === "LIMIT_FILE_COUNT") {
      next(new BadRequestError("Too many files. Maximum 5 files allowed."));
    } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
      next(new BadRequestError(`Unexpected field: ${error.field}`));
    } else {
      next(new BadRequestError(error.message));
    }
  } else {
    next(error);
  }
}

export default singleUpload;
