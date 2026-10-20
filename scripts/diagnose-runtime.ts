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

const app = initializeApp(firebaseConfig, "diagnostic-app-" + Date.now());
const auth = getAuth(app);
const db = getFirestore(app);

async function diagnose() {
  console.log("=== DIAGNOSTIC RUN STARTED ===");

  // 1. Admin login
  const adminCred = await signInWithEmailAndPassword(auth, "admin.ajanta@resolvex.com", "Admin@ResolveX2026");
  console.log("Admin logged in. UID:", adminCred.user.uid);
  const adminDoc = await getDoc(doc(db, "users", adminCred.user.uid));
  console.log("Admin doc:", adminDoc.data());

  // 2. Pending verifications query in soc-ajanta-genx
  console.log("\n--- Checking Pending Registrations in soc-ajanta-genx ---");
  const pendingStatuses = ["pending", "pending_verification", "pending_approval"];
  for (const st of pendingStatuses) {
    const qPending = query(
      collection(db, "users"),
      where("societyId", "==", "soc-ajanta-genx"),
      where("status", "==", st)
    );
    const snap = await getDocs(qPending);
    console.log(`Query status='${st}': found ${snap.size} docs`);
    snap.forEach(d => {
      console.log(`  - ${d.id}: email=${d.data().email}, name=${d.data().displayName}, status=${d.data().status}`);
    });
  }

  // Also query without status filter to see all statuses
  const allAjantaUsers = await getDocs(query(collection(db, "users"), where("societyId", "==", "soc-ajanta-genx")));
  const statusCounts: Record<string, number> = {};
  allAjantaUsers.forEach(d => {
    const st = d.data().status || "none";
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });
  console.log("All Ajanta user statuses:", statusCounts);

  // 3. Complaints in soc-ajanta-genx
  console.log("\n--- Checking Complaints in soc-ajanta-genx ---");
  const cmpSnap = await getDocs(query(collection(db, "complaints"), where("societyId", "==", "soc-ajanta-genx")));
  console.log(`Total complaints in soc-ajanta-genx: ${cmpSnap.size}`);
  cmpSnap.forEach(d => {
    const c = d.data();
    console.log(`- Complaint ${d.id}:`);
    console.log(`    title: "${c.title}"`);
    console.log(`    category: ${c.category}, status: ${c.status}, priority: ${c.priority}`);
    console.log(`    reportedBy: ${c.reportedBy} (${c.reportedByName})`);
    console.log(`    householdId: ${c.householdId}, flatId: ${c.flatId}`);
    console.log(`    createdAt: ${c.createdAt}`);
  });

  // 4. Bookings in soc-ajanta-genx
  console.log("\n--- Checking Amenity Bookings in soc-ajanta-genx ---");
  const bkSnap = await getDocs(query(collection(db, "amenity_bookings"), where("societyId", "==", "soc-ajanta-genx")));
  console.log(`Total amenity bookings in soc-ajanta-genx: ${bkSnap.size}`);
  bkSnap.forEach(d => {
    const b = d.data();
    console.log(`- Booking ${d.id}: amenity=${b.amenityName || b.amenityId}, user=${b.userName || b.userId}, date=${b.date}, slot=${b.slot}, status=${b.status}`);
  });

  // 5. Check Green Valley user
  console.log("\n--- Checking Green Valley User ---");
  const gvCred = await signInWithEmailAndPassword(auth, "priyanshuchauhan@gmail.com", "Password@ResolveX2026");
  console.log("GV User UID:", gvCred.user.uid);
  const gvDoc = await getDoc(doc(db, "users", gvCred.user.uid));
  console.log("GV Doc:", gvDoc.data());

  console.log("=== DIAGNOSTIC RUN COMPLETE ===");
}

diagnose().catch(console.error);
