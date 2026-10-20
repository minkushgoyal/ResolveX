import { Platform } from "react-native";

export interface MobileUploadResult {
  url: string;
  name: string;
  size: number;
}

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "hokjgxrf";
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "resolvex_mobile";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

/**
 * Derives a valid image MIME type from explicit type or URI extension.
 * Defaults to image/jpeg when extension/type cannot be determined.
 */
function getMimeTypeFromUri(uri: string, explicitType?: string): string {
  if (explicitType && explicitType.startsWith("image/")) {
    const lower = explicitType.toLowerCase();
    if (lower === "image/jpeg" || lower === "image/jpg") return "image/jpeg";
    if (lower === "image/png") return "image/png";
    if (lower === "image/webp") return "image/webp";
  }

  const cleanUri = uri.split("?")[0].split("#")[0];
  const extension = cleanUri.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

/**
 * Generates a clean safe filename from URI or explicit name.
 */
function getSafeFileName(uri: string, explicitName?: string): string {
  if (explicitName && explicitName.trim()) {
    const sanitized = explicitName.replace(/[^a-zA-Z0-9.-]/g, "_");
    return sanitized.includes(".") ? sanitized : `${sanitized}.jpg`;
  }
  const cleanUri = uri.split("?")[0].split("#")[0];
  const lastSegment = cleanUri.split("/").pop();
  if (lastSegment && lastSegment.includes(".")) {
    return `${Date.now()}_${lastSegment.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  }
  return `resolvex-${Date.now()}.jpg`;
}

/**
 * Validates and uploads media directly to Cloudinary using React Native native multipart FormData.
 * Never converts local URIs into Blobs on native iOS/Android, avoiding the Android OkHttp
 * "Unsupported FormDataPart implementation" error.
 * NEVER returns fake local file:// URLs or simulated success.
 */
export async function uploadComplaintMedia(
  societyId: string,
  complaintId: string,
  file: Blob | File | { uri: string; name?: string; type?: string; size?: number },
  kind: "proof" | "attachment" = "attachment"
): Promise<MobileUploadResult> {
  const isUriObject = typeof file === "object" && file !== null && "uri" in file && typeof file.uri === "string";

  // Reject non-image explicit MIME types
  if ("type" in file && file.type && !file.type.startsWith("image/")) {
    throw new Error(
      `Unsupported file type: ${file.type}. Please upload a JPEG, PNG, or WebP image.`
    );
  }

  // 1. Enforce 10MB application size limit if known up-front
  if ("size" in file && typeof file.size === "number" && file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Photo size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 10MB limit.`
    );
  }

  // 2. Build React Native native multipart FormData
  const formData = new FormData();

  let fileName = `resolvex-${Date.now()}.jpg`;
  let fileSize = 0;

  if (isUriObject) {
    const mimeType = getMimeTypeFromUri(file.uri, file.type);
    fileName = getSafeFileName(file.uri, file.name);
    fileSize = file.size || 0;

    if (Platform.OS === "web" && (file.uri.startsWith("blob:") || file.uri.startsWith("data:"))) {
      // Browser environment in Expo Web
      const resp = await fetch(file.uri);
      const blob = await resp.blob();
      formData.append("file", blob, fileName);
    } else {
      // Native React Native (iOS / Android) multipart file descriptor
      // MUST NOT use Blob here to avoid Android OkHttp "Unsupported FormDataPart implementation"
      formData.append("file", {
        uri: file.uri,
        name: fileName,
        type: mimeType
      } as any);
    }
  } else {
    // Fallback if standard File/Blob is passed directly
    fileName = (file as any).name || `resolvex-${Date.now()}.jpg`;
    fileSize = (file as any).size || 0;
    formData.append("file", file as any);
  }

  formData.append("upload_preset", UPLOAD_PRESET);

  // 3. Dispatch upload request to Cloudinary with timeout handling
  // IMPORTANT: Do NOT manually set Content-Type header. React Native automatically
  // generates multipart/form-data with the correct boundary parameter.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      const errorMsg =
        data?.error?.message ||
        `Cloudinary upload failed with status ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    if (!data.secure_url || typeof data.secure_url !== "string") {
      throw new Error("Cloudinary response did not return a valid secure_url.");
    }

    if (!data.secure_url.startsWith("https://res.cloudinary.com/")) {
      throw new Error(`Invalid secure_url domain returned by Cloudinary: ${data.secure_url}`);
    }

    return {
      url: data.secure_url,
      name: data.original_filename || fileName,
      size: data.bytes || fileSize
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Photo upload timed out after 30 seconds. Please check your network connection.");
    }
    console.error("Cloudinary mobile upload error:", err);
    throw new Error(err.message || "Failed to upload photo to Cloudinary. Please try again.");
  } finally {
    clearTimeout(timeoutId);
  }
}

// Alias for technician uploads
export const uploadTechnicianMedia = uploadComplaintMedia;
