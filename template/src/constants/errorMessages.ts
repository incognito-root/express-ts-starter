export const ERROR_MESSAGES = {
  // Auth errors
  USER_ALREADY_EXISTS: "User already exists.",
  ERROR_CREATING_ACCOUNT: "Error creating account.",
  ACCOUNT_NOT_FOUND: "Account not found.",
  INVALID_CREDENTIALS: "Invalid credentials.",
  ERROR_LOGIN_FAILED: "Error during login.",
  REFRESH_TOKEN_EXPIRED: "Refresh token has expired.",
  INVALID_TOKEN_SIGNATURE: "Invalid token signature.",
  ERROR_REFRESH_TOKEN_FAILED: "Error refreshing token.",
  ERROR_INVALIDATE_TOKEN: "Error invalidating token.",
  ERROR_FETCHING_USER_DATA: "Error fetching user data",
  ERROR_SENDING_VERIFICATION_EMAIL: "Error sending verification email.",
  INVALID_VERIFICATION_TOKEN: "Invalid or expired verification token.",
  EMAIL_ALREADY_VERIFIED: "Email is already verified.",
  ERROR_VERIFYING_EMAIL: "Error verifying email.",

  // Auth token errors
  INVALID_TOKEN: "Invalid token.",
  USER_NOT_FOUND_OR_INACTIVE: "User not found or inactive.",
  INVALID_TOKEN_PAYLOAD: "Invalid token payload.",
  TOKEN_REVOKED: "Token revoked.",
  TOKEN_EXPIRED: "Token expired.",
  USER_ID_NOT_FOUND_IN_TOKEN: "User ID not found in token.",
  MISSING_USER_ID_IN_TOKEN: "Missing user ID in token.",

  // User management errors
  USER_NOT_FOUND: "User not found.",
  ERROR_CREATING_USER: "Error creating user.",
  ERROR_UPDATING_USER: "Error updating user.",
  ERROR_DELETING_USER: "Error deleting user.",
  EMAIL_ALREADY_IN_USE: "Email is already in use by another account.",
  ERROR_FETCHING_USERS: "Error fetching users.",
  USER_DEPENDENCIES_EXIST: "Cannot delete user due to existing dependencies.",

  // Organization errors
  organization_NOT_FOUND: "Organization not found.",
  organization_ALREADY_EXISTS: "Organization with this name already exists.",
  ACTIVE_organization_NOT_FOUND: "Active organization not found.",
  ERROR_CREATING_organization: "Error creating organization.",
  ERROR_UPDATING_organization: "Error updating organization.",
  ERROR_DELETING_organization: "Error deleting organization.",
  ERROR_REACTIVATING_organization: "Error reactivating organization.",
  ERROR_FETCHING_organization: "Error fetching organization.",
  ERROR_FETCHING_organizationS: "Error fetching organizations.",

  // Authorization errors
  SUPER_ADMIN_REQUIRED: "This action requires SUPER_ADMIN privileges.",
  NO_ORGANIZATION_SELECTED: "No organization selected in current context.",
  SUPER_ADMIN_ONLY: "This action requires SUPER_ADMIN role.",

  // Media upload errors
  CLOUDINARY_NOT_CONFIGURED:
    "Media upload service is not configured. Please contact administrator.",
  INVALID_FILE_TYPE:
    "Invalid file type. Only images (JPEG, PNG, GIF, WebP, SVG) are allowed.",
  FILE_SIZE_EXCEEDED: "File size exceeds maximum allowed size.",
  NO_FILE_UPLOADED: "No file was uploaded. Please select a file to upload.",
  ERROR_UPLOADING_FILE: "Error uploading file. Please try again.",
  ERROR_DELETING_FILE: "Error deleting file from storage.",
  INVALID_IMAGE_URL: "Invalid image URL format.",

  // Validation errors
  DISPOSABLE_EMAIL_NOT_ALLOWED: "Disposable email addresses are not allowed.",
  INVALID_STATUS: "Invalid status value.",

  // General system errors
  PROVIDER_MUST_BE_SUPPLIED:
    "Provider must be supplied for first initialization.",
  CIRCUIT_BREAKER_OPEN: "Circuit breaker is currently open.",
  OTP_FAILED_TO_GENERATE: "Failed to generate OTP.",
  OTP_FAILED_TO_SET: "Failed to set OTP.",
  OTP_FAILED_TO_GET: "Failed to get OTP.",
  OTP_FAILED_TO_GET_EXPIRY: "Failed to get OTP expiry.",
  OTP_VERIFICATION_FAILED: "OTP verification failed.",
  RATE_LIMIT_EXCEEDED: "Rate limit exceeded.",
  UNKNOWN_EMAIL_JOB_TYPE: "Unknown email job type.",

  // Repository/Database errors
  ERROR_EXECUTING_AGGREGATION: "Error executing aggregation query.",

  // WebSocket infrastructure errors
  WS_AUTH_REQUIRED: "Authentication required for this action",
  WS_INSUFFICIENT_PERMISSIONS: "Insufficient permissions for this action",
  WS_PAYLOAD_TOO_LARGE: "Payload exceeds size limit",
  WS_TOO_MANY_REQUESTS: "Too many requests",
};
