import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc, getDoc, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCWuYsd-5WbErb8I1SCqrikFsfgaWsk7yo",
  authDomain: "resolvex-community.firebaseapp.com",
  projectId: "resolvex-community",
  storageBucket: "resolvex-community.firebasestorage.app",
  messagingSenderId: "946394564050",
  appId: "1:946394564050:web:1f62cfa06df2358c38f40b"
};

const app = initializeApp(firebaseConfig, "migration-app-" + Date.now());
const auth = getAuth(app);
const db = getFirestore(app);

async function migrate() {
  console.log("=== MIGRATING DATA TO CANONICAL AJANTA SOCIETY ===");
  // Sign in as super_admin
  await signInWithEmailAndPassword(auth, "admin@resolvex.com", "Admin@ResolveX2026");
  console.log("✓ Signed in as super admin");

  // 1. Ensure societies/soc-ajanta-genx exists
  const ajantaSocRef = doc(db, "societies", "soc-ajanta-genx");
  const ajantaSocSnap = await getDoc(ajantaSocRef);
  if (!ajantaSocSnap.exists()) {
    await setDoc(ajantaSocRef, {
      id: "soc-ajanta-genx",
      name: "Ajanta Gen-X Residency",
      tagline: "Modern Community Living Redefined",
      address: "Tower A-D, Plot 4, Sector 78, Noida, Uttar Pradesh 201301",
      city: "Noida",
      rwaRegistrationNumber: "RWA-UP-NOIDA-2021-9921",
      helplinePhone: "+91 120 499 8800",
      createdAt: "2026-08-01T09:00:00.000Z",
      settings: {
        approvalRequiredForJoin: true,
        tenantsCanViewBills: true,
        directoryPhoneVisibleByDefault: false,
        complaintEscalationHours: {
          notifyManager: 24,
          increasePriority: 48,
          notifyAdmin: 72
        }
      }
    });
    console.log("✓ Created societies/soc-ajanta-genx document in Firestore");
  } else {
    console.log("✓ societies/soc-ajanta-genx already exists");
  }

  // 2. Update Mehdi user doc
  const mehdiUid = "k6M5EjFdw9QheOSqRbdxP8J7wQN2";
  const mehdiRef = doc(db, "users", mehdiUid);
  const mehdiSnap = await getDoc(mehdiRef);
  if (mehdiSnap.exists()) {
    await updateDoc(mehdiRef, {
      societyId: "soc-ajanta-genx",
      towerId: "tower-a",
      flatId: "flat-a-1204",
      householdId: "hh-a-1204",
      updatedAt: new Date().toISOString()
    });
    console.log("✓ Updated Mehdi's profile to societyId: soc-ajanta-genx, flat: flat-a-1204");
  } else {
    console.warn("Mehdi doc does not exist!");
  }

  // 3. Update Mehdi's complaints to soc-ajanta-genx
  const mehdiCmps = await getDocs(query(collection(db, "complaints"), where("reportedBy", "==", mehdiUid)));
  console.log(`Found ${mehdiCmps.size} complaints created by Mehdi:`);
  for (const cmpDoc of mehdiCmps.docs) {
    await updateDoc(doc(db, "complaints", cmpDoc.id), {
      societyId: "soc-ajanta-genx",
      householdId: "hh-a-1204",
      flatId: "flat-a-1204",
      towerId: "tower-a",
      updatedAt: new Date().toISOString()
    });
    console.log(`  - Migrated complaint ${cmpDoc.id} to soc-ajanta-genx`);
  }

  // 4. Update Mehdi's bookings to soc-ajanta-genx
  const mehdiBkgs = await getDocs(query(collection(db, "amenity_bookings"), where("userId", "==", mehdiUid)));
  console.log(`Found ${mehdiBkgs.size} bookings created by Mehdi:`);
  for (const bkgDoc of mehdiBkgs.docs) {
    await updateDoc(doc(db, "amenity_bookings", bkgDoc.id), {
      societyId: "soc-ajanta-genx",
      householdId: "hh-a-1204",
      updatedAt: new Date().toISOString()
    });
    console.log(`  - Migrated booking ${bkgDoc.id} to soc-ajanta-genx`);
  }

  // 5. Update Harsh Sharma to soc-ajanta-genx as pending
  const harshUid = "hhOPrjpShaOiUlOxUEDSL2jkPQm2";
  const harshRef = doc(db, "users", harshUid);
  const harshSnap = await getDoc(harshRef);
  if (harshSnap.exists()) {
    await updateDoc(harshRef, {
      societyId: "soc-ajanta-genx",
      status: "pending",
      updatedAt: new Date().toISOString()
    });
    console.log("✓ Updated Harsh Sharma's profile to societyId: soc-ajanta-genx, status: pending");
  }

  // 6. Ensure canonical amenities for soc-ajanta-genx
  const amenitiesList = [
    {
      id: "amenity-badminton",
      societyId: "soc-ajanta-genx",
      name: "Indoor Badminton Court 1",
      icon: "dumbbell",
      openingHour: "06:00",
      closingHour: "21:00",
      slotMinutes: 45,
      charge: 0,
      capacity: 4,
      status: "active"
    },
    {
      id: "amenity-clubhouse",
      societyId: "soc-ajanta-genx",
      name: "Clubhouse Banquet Hall",
      icon: "building",
      openingHour: "09:00",
      closingHour: "23:00",
      slotMinutes: 240,
      charge: 500,
      capacity: 40,
      status: "active"
    },
    {
      id: "amenity-gym",
      societyId: "soc-ajanta-genx",
      name: "Central Health & Fitness Gym",
      icon: "dumbbell",
      openingHour: "05:30",
      closingHour: "22:00",
      slotMinutes: 60,
      charge: 0,
      capacity: 20,
      status: "active"
    },
    {
      id: "amenity-pool",
      societyId: "soc-ajanta-genx",
      name: "Swimming Pool Deck",
      icon: "waves",
      openingHour: "06:00",
      closingHour: "20:00",
      slotMinutes: 60,
      charge: 0,
      capacity: 15,
      status: "active"
    },
    {
      id: "amenity-single",
      societyId: "soc-ajanta-genx",
      name: "Private Squash Court",
      icon: "activity",
      openingHour: "06:00",
      closingHour: "21:00",
      slotMinutes: 30,
      charge: 0,
      capacity: 1,
      status: "active"
    },
    {
      id: "amenity-yoga",
      societyId: "soc-ajanta-genx",
      name: "Yoga & Meditation Studio",
      icon: "heart",
      openingHour: "06:00",
      closingHour: "20:00",
      slotMinutes: 60,
      charge: 0,
      capacity: 10,
      status: "active"
    }
  ];

  for (const amn of amenitiesList) {
    await setDoc(doc(db, "amenities", amn.id), amn, { merge: true });
    console.log(`✓ Ensured amenity: ${amn.id} (${amn.name}) in soc-ajanta-genx with capacity ${amn.capacity}`);
  }

  console.log("=== MIGRATION COMPLETE ===");
}

migrate().catch(console.error);
