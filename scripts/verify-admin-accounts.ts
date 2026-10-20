import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCWuYsd-5WbErb8I1SCqrikFsfgaWsk7yo",
  authDomain: "resolvex-community.firebaseapp.com",
  projectId: "resolvex-community",
  storageBucket: "resolvex-community.firebasestorage.app",
  messagingSenderId: "946394564050",
  appId: "1:946394564050:web:1f62cfa06df2358c38f40b"
};

const app = initializeApp(firebaseConfig, "auth-verification-check");
const auth = getAuth(app);
const db = getFirestore(app);

async function checkAccount(email: string, pass: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    console.log(`[AUTH SUCCESS] Email: ${email} -> UID: ${cred.user.uid}`);
    const userDoc = await getDoc(doc(db, "users", cred.user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log(`   Firestore doc users/${cred.user.uid}:`, {
        displayName: data.displayName,
        role: data.role,
        platformRoles: data.platformRoles,
        societyId: data.societyId,
        isSocietyAdmin: data.isSocietyAdmin,
        status: data.status
      });
      return { ok: true, uid: cred.user.uid, data };
    } else {
      console.log(`   Firestore doc users/${cred.user.uid} DOES NOT EXIST.`);
      return { ok: true, uid: cred.user.uid, data: null };
    }
  } catch (err: any) {
    console.log(`[AUTH FAILED] Email: ${email} -> Code: ${err.code} Message: ${err.message}`);
    return { ok: false, error: err.code };
  }
}

async function main() {
  console.log("=== CHECKING ADMIN & STAFF CREDENTIALS ===");

  console.log("\n1. Checking Ajanta Admin (admin.ajanta@resolvex.com)...");
  await checkAccount("admin.ajanta@resolvex.com", "Admin@ResolveX2026");

  console.log("\n2. Checking General/Green Valley Admin (admin@resolvex.com)...");
  await checkAccount("admin@resolvex.com", "Admin@ResolveX2026");

  console.log("\n3. Checking potential individual society admin emails...");
  await checkAccount("admin.greenvalley@resolvex.com", "Admin@ResolveX2026");
  await checkAccount("admin.grandarch@resolvex.com", "Admin@ResolveX2026");
  await checkAccount("admin.arch@resolvex.com", "Admin@ResolveX2026");

  console.log("\n4. Checking Vikas Kumar credentials...");
  console.log("   Attempt 4a: vikas.kumar@resolvex.com with VikasPass@2026!");
  await checkAccount("vikas.kumar@resolvex.com", "VikasPass@2026!");
  console.log("   Attempt 4b: vikas.kumar@resolvex.com with Staff@ResolveX2026");
  await checkAccount("vikas.kumar@resolvex.com", "Staff@ResolveX2026");
  console.log("   Attempt 4c: vikas.kumar@example.com with Staff@ResolveX2026");
  await checkAccount("vikas.kumar@example.com", "Staff@ResolveX2026");

  console.log("\n5. Querying all administrative users in Firestore (via super_admin)...");
  const adminCred = await signInWithEmailAndPassword(auth, "admin@resolvex.com", "Admin@ResolveX2026");
  const usersSnap = await getDocs(collection(db, "users"));
  console.log(`Total users in Firestore: ${usersSnap.size}`);
  usersSnap.forEach((d) => {
    const u = d.data();
    if (
      u.role === "society_admin" ||
      u.role === "super_admin" ||
      u.role === "society_manager" ||
      u.isSocietyAdmin === true ||
      (u.platformRoles && (u.platformRoles.includes("society_admin") || u.platformRoles.includes("super_admin")))
    ) {
      console.log(`-> Admin User: UID=${d.id} | Email=${u.email} | Name=${u.displayName} | Society=${u.societyId} | Role=${u.role} | Roles=${JSON.stringify(u.platformRoles)} | Status=${u.status}`);
    }
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
