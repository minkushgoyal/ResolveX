import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import type { ComplaintGPSLocation } from "@resolvex/types";
import { auth, db, isFirebaseConfigured } from "./firebase";

/**
 * Safely detects if the current runtime environment is Expo Go / Store Client.
 * In Expo SDK 53+, remote Android notification native functionality was removed from Expo Go.
 * Importing or executing expo-notifications inside Expo Go causes immediate crash.
 */
export function isRunningInExpoGo(): boolean {
  try {
    return (
      Constants?.executionEnvironment === ExecutionEnvironment.StoreClient ||
      (Constants as any)?.appOwnership === "expo"
    );
  } catch {
    return true;
  }
}

let cachedNotifications: typeof import("expo-notifications") | null = null;

/**
 * Dynamically loads expo-notifications ONLY in non-Expo Go environments (Development Build / Standalone).
 * In Expo Go or Web, this always returns null, preventing any evaluation of the native notification module.
 */
async function getNotificationsModule(): Promise<typeof import("expo-notifications") | null> {
  if (Platform.OS === "web" || isRunningInExpoGo()) {
    return null;
  }
  if (cachedNotifications) {
    return cachedNotifications;
  }
  try {
    cachedNotifications = await import("expo-notifications");
    return cachedNotifications;
  } catch (err) {
    console.warn("[Notifications] Failed to load expo-notifications module:", err);
    return null;
  }
}

/**
 * Configure foreground notification presentation handler.
 * Called within application lifecycle (RootLayout useEffect).
 * In Expo Go, this safely returns without loading expo-notifications.
 */
export async function configureNotificationHandler(): Promise<void> {
  if (Platform.OS === "web" || isRunningInExpoGo()) return;
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority?.HIGH ?? "high"
      })
    });
  } catch (err) {
    console.warn("[Notifications] Failed to set notification handler:", err);
  }
}

export interface MediaCaptureResult {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export interface DeviceLocationResult {
  gps?: ComplaintGPSLocation;
  denied: boolean;
  error?: string;
}

/**
 * Capture a photo using the device camera
 */
export async function capturePhotoFromCamera(): Promise<MediaCaptureResult | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      "Camera permission is required to capture photo evidence. Please enable camera access in your device settings."
    );
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: true,
    aspect: [4, 3]
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const name = asset.fileName || `camera_${Date.now()}.jpg`;
  const type = asset.mimeType || "image/jpeg";

  return {
    uri: asset.uri,
    name,
    type,
    size: asset.fileSize
  };
}

/**
 * Pick an image from the device gallery
 */
export async function pickImageFromGallery(): Promise<MediaCaptureResult | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      "Photo library permission is required to select images. Please enable gallery access in your device settings."
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: true,
    aspect: [4, 3]
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const name = asset.fileName || `gallery_${Date.now()}.jpg`;
  const type = asset.mimeType || "image/jpeg";

  return {
    uri: asset.uri,
    name,
    type,
    size: asset.fileSize
  };
}

/**
 * Obtains real GPS location from device hardware.
 * If permission is denied or location services are disabled, returns honest denied state.
 * NEVER returns fake or simulated coordinates!
 */
export async function getCurrentDeviceLocation(): Promise<DeviceLocationResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      return {
        denied: true,
        error: "GPS location permission was denied. You may provide manual location details."
      };
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });

    return {
      denied: false,
      gps: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
        capturedAt: new Date(pos.timestamp).toISOString(),
        captureMethod: "gps"
      }
    };
  } catch (err: any) {
    return {
      denied: true,
      error: err?.message || "Location services are unavailable on this device."
    };
  }
}

/**
 * Registers device for push notifications and synchronizes token with Firestore user profile.
 * - In Development Build / Standalone: requests notification permissions and registers real Expo push token.
 * - In Expo Go: handles the SDK 53+ remote notification limitation gracefully with an informative log,
 *   returning null rather than failing silently, faking a token, or crashing on module import.
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  // Detect Expo Go client environment (remote Android notifications unavailable in Expo Go for SDK 53+)
  if (isRunningInExpoGo()) {
    console.info(
      "[Push Notifications] Remote Android notifications are unavailable in Expo Go (SDK 53+). " +
      "A development build is required (npx expo run:android). Push token registration skipped in Expo Go."
    );
    return null;
  }

  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission denied by user.");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData?.data || null;

    if (token && userId && isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, "users", userId), {
          pushToken: token,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Could not save push token to Firestore profile:", e);
      }
    }

    return token;
  } catch (err: any) {
    console.warn("Push notification setup error:", err?.message || err);
    return null;
  }
}
