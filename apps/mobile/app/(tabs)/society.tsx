import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { householdRoleLabels } from "@resolvex/utils";
import type { UserProfile } from "@resolvex/types";
import { Card, colors, EmptyState, Muted, Pill, Screen, Title } from "../../components/mobile-ui";
import { db, isFirebaseConfigured } from "../../lib/firebase";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useMobileSessionStore } from "../../lib/session-store";

interface HouseholdData {
  id: string;
  displayName: string;
  inviteCode?: string;
  flatId?: string;
  towerId?: string;
}

interface TowerData {
  id: string;
  name: string;
  floors?: number;
  societyId: string;
}

export default function SocietyScreen() {
  const profile = useMobileSessionStore((state) => state.userProfile);
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [towerList, setTowerList] = useState<TowerData[]>([]);

  useEffect(() => {
    const currentHouseholdId = profile?.householdId;
    if (!isFirebaseConfigured || !currentHouseholdId) return;

    // 1. Fetch household doc
    getDoc(doc(db, "households", currentHouseholdId))
      .then((snap) => {
        if (snap.exists()) {
          setHousehold({ ...(snap.data() as any), id: snap.id });
        } else {
          setHousehold({
            id: currentHouseholdId,
            displayName: profile?.displayName ? `${profile.displayName.split(" ")[0]}'s Residence` : "My Household",
            flatId: profile?.flatId,
            towerId: profile?.towerId
          });
        }
      })
      .catch(() => {
        setHousehold({
          id: currentHouseholdId,
          displayName: profile?.displayName ? `${profile.displayName.split(" ")[0]}'s Residence` : "My Household",
          flatId: profile?.flatId,
          towerId: profile?.towerId
        });
      });

    // 2. Subscribe to household members
    const qMembers = query(
      collection(db, "users"),
      where("householdId", "==", currentHouseholdId)
    );
    const unsubMembers = onSnapshot(
      qMembers,
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as UserProfile), uid: d.id }));
        setMembers(list);
      },
      (err) => console.warn("Household members listener error:", err)
    );

    // 3. Subscribe to towers in this society
    let unsubTowers: (() => void) | undefined;
    if (profile?.societyId) {
      const qTowers = query(
        collection(db, "towers"),
        where("societyId", "==", profile.societyId)
      );
      unsubTowers = onSnapshot(
        qTowers,
        (snap) => {
          const list: TowerData[] = [];
          snap.forEach((d) => list.push({ ...(d.data() as TowerData), id: d.id }));
          if (list.length > 0) {
            setTowerList(list);
          } else {
            // Display active tower from user profile if collection not explicitly populated
            const activeTower = profile.towerId
              ? `Tower ${profile.towerId.replace("tower-", "").toUpperCase()}`
              : "Tower 1";
            setTowerList([
              { id: profile.towerId || "tower-1", name: activeTower, floors: 14, societyId: profile.societyId }
            ]);
          }
        },
        () => {
          const activeTower = profile.towerId
            ? `Tower ${profile.towerId.replace("tower-", "").toUpperCase()}`
            : "Tower 1";
          setTowerList([
            { id: profile.towerId || "tower-1", name: activeTower, floors: 14, societyId: profile.societyId }
          ]);
        }
      );

      return () => {
        unsubMembers();
        if (unsubTowers) unsubTowers();
      };
    }

    return () => unsubMembers();
  }, [profile?.householdId, profile?.societyId]);

  const flatLabel = profile?.flatId ? `Flat ${profile.flatId.replace("flat-", "").toUpperCase()}` : "Flat";
  const towerLabel = profile?.towerId ? `Tower ${profile.towerId.replace("tower-", "").toUpperCase()}` : "Tower";

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        <Title>My Household</Title>
        <Muted>
          {household?.displayName || "Household Unit"} · {flatLabel}, {towerLabel}
        </Muted>

        {members.length > 0 ? (
          members.map((member) => {
            const hRole = member.householdRole || member.role || "resident";
            return (
              <Card key={member.uid || member.email} style={{ marginTop: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                      {member.displayName || member.name || member.email}
                    </Text>
                    <Muted>{member.phone || member.email || "Household Member"}</Muted>
                  </View>
                  <Pill tone={hRole === "owner" ? "primary" : hRole === "tenant" ? "accent" : "secondary"}>
                    {householdRoleLabels[hRole as keyof typeof householdRoleLabels] || hRole.toUpperCase()}
                  </Pill>
                </View>
              </Card>
            );
          })
        ) : (
          <Card style={{ marginTop: 12, padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                  {profile?.displayName || "Current Resident"}
                </Text>
                <Muted>{profile?.phone || profile?.email || "Primary Occupant"}</Muted>
              </View>
              <Pill tone="primary">
                {profile?.householdRole === "owner" ? "Owner" : "Resident"}
              </Pill>
            </View>
          </Card>
        )}

        <Text style={[{ marginTop: 24, color: colors.text, fontSize: 20, fontWeight: "900" }]}>
          Society Towers
        </Text>
        {towerList.map((tower) => (
          <Card key={tower.id} style={{ marginTop: 10 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{tower.name}</Text>
            <Muted>{tower.floors ? `${tower.floors} floors · ` : ""}Verified resident access enabled</Muted>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
