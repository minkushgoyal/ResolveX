import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const CLOUD_NAME = "hokjgxrf";
const UPLOAD_PRESET = "resolvex_mobile";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const firebaseConfig = {
  apiKey: "AIzaSyCWuYsd-5WbErb8I1SCqrikFsfgaWsk7yo",
  authDomain: "resolvex-community.firebaseapp.com",
  projectId: "resolvex-community",
  messagingSenderId: "946394564050",
  appId: "1:946394564050:web:1f62cfa06df2358c38f40b"
};

const app = initializeApp(firebaseConfig, "verify-cloudinary-suite");
const auth = getAuth(app);
const db = getFirestore(app);

// Helper to upload a sample buffer to Cloudinary using standard FormData
async function uploadSampleImageToCloudinary(filename: string, label: string): Promise<string> {
  const testPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const buffer = Buffer.from(testPngBase64, "base64");
  const blob = new Blob([buffer], { type: "image/png" });

  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("upload_preset", UPLOAD_PRESET);

  console.log(`[Upload] Uploading ${label} to Cloudinary...`);
  const res = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Cloudinary upload failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  if (!data.secure_url || !data.secure_url.startsWith("https://")) {
    throw new Error(`Cloudinary did not return a valid HTTPS secure_url: ${JSON.stringify(data)}`);
  }

  console.log(`[Upload Success] ${label} -> ${data.secure_url}`);
  return data.secure_url;
}

// Verify URL is live, accessible and returns real image bytes
async function verifyUrlIsAccessible(url: string, label: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image at ${url}: status ${res.status}`);
  }
  const contentType = res.headers.get("content-type");
  const arrayBuffer = await res.arrayBuffer();
  console.log(`[Verified Render] ${label}: Content-Type=${contentType}, Bytes=${arrayBuffer.byteLength}`);
  if (!contentType?.includes("image")) {
    throw new Error(`URL did not return an image content type: ${contentType}`);
  }
}

async function runRuntimeVerification() {
  console.log("==================================================");
  console.log("RESOLVEX — CLOUDINARY MIGRATION RUNTIME TEST SUITE");
  console.log("==================================================");

  // 1. Authenticate with live resident account
  console.log("\n1. Resident Authentication Check...");
  const residentCred = await signInWithEmailAndPassword(auth, "priyanshuchauhan@gmail.com", "Password@ResolveX2026");
  const residentUser = residentCred.user;
  console.log(`✓ Authenticated resident: ${residentUser.email} (UID: ${residentUser.uid})`);

  const residentProfileSnap = await getDoc(doc(db, "users", residentUser.uid));
  const residentProfile = residentProfileSnap.data()!;
  console.log(`  Profile: ${residentProfile.displayName}, Society: ${residentProfile.societyId}, Household: ${residentProfile.householdId}`);

  const societyId = residentProfile.societyId || "soc-green-valley";
  const householdId = residentProfile.householdId || "hh-1-t1402";

  // 2. Feature: Resident Complaint Photo Upload
  console.log("\n2. Resident Complaint Photo Flow...");
  const complaintEvidenceUrl = await uploadSampleImageToCloudinary("resident_evidence.png", "Resident Complaint Evidence");
  await verifyUrlIsAccessible(complaintEvidenceUrl, "Resident Evidence");

  const testComplaintId = `test-cloudinary-cmp-${Date.now()}`;
  const complaintDocRef = doc(db, "complaints", testComplaintId);
  const now = new Date().toISOString();

  await setDoc(complaintDocRef, {
    id: testComplaintId,
    societyId,
    householdId,
    flatId: residentProfile.flatId || "flat-1-t1402",
    towerId: residentProfile.towerId || "tower-1",
    createdByUserId: residentUser.uid,
    reportedBy: residentUser.uid,
    reportedByName: residentProfile.displayName || "Resident",
    title: "Cloudinary Verification Test Complaint",
    description: "Automated verification ticket testing Cloudinary secure URL persistence in complaints.",
    status: "open",
    priority: "medium",
    category: "plumbing",
    locationType: "flat",
    location: "Tower 1, Flat 1402",
    locationSource: "manual",
    structuredLocation: {
      locationType: "flat",
      societyId,
      towerId: residentProfile.towerId || "tower-1",
      flatId: residentProfile.flatId || "flat-1-t1402",
      householdId,
      roomOrArea: "Kitchen Sink"
    },
    gpsLocation: {
      latitude: 0,
      longitude: 0,
      capturedAt: now,
      captureMethod: "manual"
    },
    attachments: [
      {
        id: `att-${Date.now()}`,
        url: complaintEvidenceUrl,
        type: "image",
        name: "resident_evidence.png"
      }
    ],
    createdAt: now,
    updatedAt: now
  });

  const readComplaintSnap = await getDoc(complaintDocRef);
  const readComplaintData = readComplaintSnap.data();
  console.log("✓ Firestore Complaint created and retrieved successfully.");
  console.log("  Stored attachments[0].url:", readComplaintData?.attachments?.[0]?.url);
  if (readComplaintData?.attachments?.[0]?.url !== complaintEvidenceUrl) {
    throw new Error("Mismatch in stored complaint attachment URL!");
  }
  if (!readComplaintData?.attachments?.[0]?.url?.startsWith("https://res.cloudinary.com/")) {
    throw new Error(`Complaint attachment is not a Cloudinary URL: ${readComplaintData?.attachments?.[0]?.url}`);
  }

  // 3. Feature: Buy & Sell Marketplace Flow
  console.log("\n3. Buy & Sell Marketplace Flow...");
  const marketplaceItemUrl = await uploadSampleImageToCloudinary("marketplace_item.png", "Marketplace Item Photo");
  await verifyUrlIsAccessible(marketplaceItemUrl, "Marketplace Item");

  const testMarketplaceId = `test-mkt-${Date.now()}`;
  const mktDocRef = doc(db, "marketplace_items", testMarketplaceId);
  await setDoc(mktDocRef, {
    id: testMarketplaceId,
    societyId,
    sellerUserId: residentUser.uid,
    title: "Wooden Coffee Table (Cloudinary Test)",
    description: "Cloudinary verified image test item",
    price: 1500,
    condition: "like_new",
    category: "furniture",
    imageUrl: marketplaceItemUrl,
    status: "available",
    createdAt: now
  });

  const readMktSnap = await getDoc(mktDocRef);
  const readMktData = readMktSnap.data();
  console.log("✓ Firestore Marketplace Item created and retrieved successfully.");
  console.log("  Stored imageUrl:", readMktData?.imageUrl);
  if (!readMktData?.imageUrl?.startsWith("https://res.cloudinary.com/")) {
    throw new Error(`Marketplace item has non-Cloudinary URL: ${readMktData?.imageUrl}`);
  }
  if (readMktData?.imageUrl?.startsWith("file://") || readMktData?.imageUrl?.startsWith("content://")) {
    throw new Error(`CRITICAL: Marketplace item has invalid local file URI: ${readMktData?.imageUrl}`);
  }

  // 4. Feature: Technician Resolution Proof Flow
  console.log("\n4. Technician Resolution Proof Flow...");
  const resolutionProofUrl = await uploadSampleImageToCloudinary("resolution_proof.png", "Technician Resolution Proof");
  await verifyUrlIsAccessible(resolutionProofUrl, "Resolution Proof");

  // Sign in as society admin to update complaint with technician resolution proof
  const adminCred = await signInWithEmailAndPassword(auth, "admin@resolvex.com", "Admin@ResolveX2026");
  console.log(`✓ Authenticated society management: ${adminCred.user.email}`);

  await updateDoc(complaintDocRef, {
    status: "resident_confirmation",
    resolutionProofUrl: resolutionProofUrl,
    resolutionNote: "Tested pipe joint and verified repair photographic proof on-site."
  });

  const updatedComplaintSnap = await getDoc(complaintDocRef);
  const updatedComplaintData = updatedComplaintSnap.data();
  console.log("✓ Firestore Complaint updated with resolutionProofUrl successfully.");
  console.log("  Stored resolutionProofUrl:", updatedComplaintData?.resolutionProofUrl);
  if (updatedComplaintData?.resolutionProofUrl !== resolutionProofUrl) {
    throw new Error("Mismatch in stored resolutionProofUrl!");
  }
  if (!updatedComplaintData?.resolutionProofUrl?.startsWith("https://res.cloudinary.com/")) {
    throw new Error(`resolutionProofUrl is not a Cloudinary URL: ${updatedComplaintData?.resolutionProofUrl}`);
  }

  // 5. Cleanup Test Records
  console.log("\n5. Cleaning up test records from live Firestore...");
  await deleteDoc(complaintDocRef);
  await deleteDoc(mktDocRef);
  console.log("✓ All temporary test records removed cleanly.");

  console.log("\n==================================================");
  console.log("ALL RUNTIME TESTS PASSED WITH 100% SUCCESS!");
  console.log("==================================================");
  process.exit(0);
}

runRuntimeVerification().catch((err) => {
  console.error("Runtime test failed:", err);
  process.exit(1);
});
