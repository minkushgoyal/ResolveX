export interface UploadResult {
  url: string;
  name: string;
  size: number;
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "hokjgxrf";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "resolvex_mobile";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function isAllowedImage(mimeType?: string, fileName?: string): boolean {
  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return true;
  }
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && ALLOWED_EXTENSIONS.has(ext)) {
      return true;
    }
  }
  return false;
}

/**
 * Uploads an image to Cloudinary using the unsigned resolvex_mobile preset.
 * Replaces Firebase Cloud Storage without requiring Blaze billing plan.
 */
export async function uploadFile(
  folder: string,
  file: File | Blob,
  customName?: string
): Promise<UploadResult> {
  // 1. File Size Validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 10MB limit. Please select a smaller file.`
    );
  }

  const fileName = customName || (file instanceof File ? file.name : `media-${Date.now()}.jpg`);
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  // 2. MIME Type Validation (image-only: JPG, PNG, WebP)
  const mimeType = file.type || "image/jpeg";
  if (!isAllowedImage(mimeType, fileName)) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Please upload a JPEG, PNG, or WebP image.`
    );
  }

  // 3. Build multipart form data
  const formData = new FormData();
  formData.append("file", file, safeName);
  formData.append("upload_preset", UPLOAD_PRESET);

  // 4. Send request with AbortController timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: "POST",
      body: formData,
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

    return {
      url: data.secure_url,
      name: data.original_filename || fileName,
      size: data.bytes || file.size
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Image upload timed out after 30 seconds. Please check your network connection.");
    }
    console.error("Cloudinary web upload error:", err);
    throw new Error(err.message || "Failed to upload image to Cloudinary. Check network.");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Scoped complaint image attachment upload
 */
export async function uploadComplaintMedia(
  societyId: string,
  complaintId: string,
  file: File | Blob
): Promise<UploadResult> {
  return uploadFile(`societies/${societyId}/complaints/${complaintId}`, file);
}

/**
 * Scoped technician resolution proof upload
 */
export async function uploadResolutionProof(
  societyId: string,
  complaintId: string,
  file: File | Blob
): Promise<UploadResult> {
  return uploadFile(`societies/${societyId}/complaint-proofs/${complaintId}`, file);
}

/**
 * Scoped user avatar upload
 */
export async function uploadUserAvatar(
  userId: string,
  file: File | Blob
): Promise<UploadResult> {
  return uploadFile(`users/${userId}`, file);
}
