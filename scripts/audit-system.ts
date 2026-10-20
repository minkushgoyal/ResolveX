import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCWuYsd-5WbErb8I1SCqrikFsfgaWsk7yo",
  authDomain: "resolvex-community.firebaseapp.com",
  projectId: "resolvex-community",
  storageBucket: "resolvex-community.firebasestorage.app",
  messagingSenderId: "946394564050",
  appId: "1:946394564050:web:1f62cfa06df2358c38f40b"
};

const app = initializeApp(firebaseConfig, "audit-app");
const auth = getAuth(app);
const db = getFirestore(app);

async function runAudit() {
  console.log("==================================================================");
  console.log("RESOLVEX SYSTEM AUDIT - LIVE DATABASE INSPECTION");
  console.log("==================================================================");

  try {
    const cred = await signInWithEmailAndPassword(auth, "priyanshuchauhan@gmail.com", "Password@ResolveX2026");
    console.log("✓ Logged in as:", cred.user.email, "(UID:", cred.user.uid, ")");

    // 1. Inspect user profile
    const profileSnap = await getDoc(doc(db, "users", cred.user.uid));
    if (profileSnap.exists()) {
      console.log("✓ User profile:", JSON.stringify(profileSnap.data(), null, 2));
    } else {
      console.log("✗ User profile doc missing for UID:", cred.user.uid);
    }

    // 2. Query users in society
    const societyId = profileSnap.data()?.societyId || "soc-ajanta-genx";
    console.log("\n--- Querying users in society:", societyId, "---");
    const usersSnap = await getDocs(query(collection(db, "users"), where("societyId", "==", societyId)));
    console.log("Total users found:", usersSnap.size);
    usersSnap.forEach((d) => {
      const u = d.data();
      console.log(`- ${d.id}: ${u.name || u.displayName || u.email} | Role: ${u.role} | Status: ${u.status} | Household: ${u.householdId}`);
    });

    // 3. Inspect complaints
    console.log("\n--- Querying complaints ---");
    const userHousehold = profileSnap.data()?.householdId;
    if (userHousehold) {
      const householdComplaints = await getDocs(
        query(collection(db, "complaints"), where("householdId", "==", userHousehold))
      );
      console.log(`Household (${userHousehold}) complaints:`, householdComplaints.size);
      householdComplaints.forEach((d) => {
        const c = d.data();
        console.log(`- ${d.id}: [${c.status}] ${c.title} (Location: ${c.locationType}, Room: ${c.location})`);
      });
    }

    // Test the mobile complaints query (where societyId == ...)
    try {
      const societyComplaints = await getDocs(
        query(collection(db, "complaints"), where("societyId", "==", societyId))
      );
      console.log("Society complaints query (where societyId == ...):", societyComplaints.size);
    } catch (e: any) {
      console.log("✗ Society complaints query FAILED as expected by rules:", e.message);
    }

    // 4. Inspect notifications
    console.log("\n--- Querying notifications ---");
    const myNotifs = await getDocs(
      query(collection(db, "notifications"), where("userId", "==", cred.user.uid))
    );
    console.log(`User notifications (where userId == ${cred.user.uid}):`, myNotifs.size);

    try {
      const societyNotifs = await getDocs(
        query(collection(db, "notifications"), where("societyId", "==", societyId))
      );
      console.log("Society notifications query:", societyNotifs.size);
    } catch (e: any) {
      console.log("✗ Society notifications query FAILED as expected by rules:", e.message);
    }

    // 5. Inspect marketplace items
    console.log("\n--- Querying marketplace items ---");
    const marketSnap = await getDocs(
      query(collection(db, "marketplace_items"), where("societyId", "==", societyId))
    );
    console.log("Marketplace items found:", marketSnap.size);
    marketSnap.forEach((d) => {
      const m = d.data();
      console.log(`- ${d.id}: ${m.title} | Price: ₹${m.price} | Images:`, m.images);
    });

    // 6. Inspect bills
    console.log("\n--- Querying bills ---");
    if (userHousehold) {
      const billsSnap = await getDocs(
        query(collection(db, "bills"), where("householdId", "==", userHousehold))
      );
      console.log(`Household bills:`, billsSnap.size);
      billsSnap.forEach((d) => {
        const b = d.data();
        console.log(`- ${d.id}: ${b.title || b.category} | Period: ${b.billingPeriod} | Amount: ₹${b.amount} | Status: ${b.status}`);
      });
    }

    // 7. Inspect visitor passes
    console.log("\n--- Querying visitor passes ---");
    if (userHousehold) {
      const passesSnap = await getDocs(
        query(collection(db, "visitor_passes"), where("householdId", "==", userHousehold))
      );
      console.log(`Household visitor passes:`, passesSnap.size);
      passesSnap.forEach((d) => {
        const p = d.data();
        console.log(`- ${d.id}: Visitor: ${p.visitorName} | Code: ${p.passCode} | Status: ${p.status}`);
      });
    }

  } catch (err: any) {
    console.error("Audit error:", err);
  }
}

runAudit();
