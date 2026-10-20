import { Tabs } from "expo-router";
import {
  Bell,
  ClipboardList,
  Clock,
  Grid,
  Home,
  MessageSquareText,
  Package,
  QrCode,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  Wrench
} from "lucide-react-native";
import { useMobileSessionStore } from "../../lib/session-store";

const brand = "#4338ca";

export default function TabsLayout() {
  const userProfile = useMobileSessionStore((state) => state.userProfile);
  const activeRole = userProfile?.role || "resident";

  const isStaff = activeRole === "maintenance_staff";
  const isGuard = activeRole === "security_guard";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand,
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: {
          height: 68,
          paddingTop: 6,
          paddingBottom: 10,
          borderTopColor: "#e2e8f0",
          backgroundColor: "#ffffff"
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isStaff ? "Dashboard" : isGuard ? "Gate Desk" : "Home",
          tabBarIcon: ({ color }) =>
            isGuard ? <Shield color={color} size={21} /> : <Home color={color} size={21} />
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: isStaff ? "My Work" : isGuard ? "Visitors" : "Complaints",
          tabBarIcon: ({ color }) =>
            isStaff ? (
              <Wrench color={color} size={21} />
            ) : isGuard ? (
              <Users color={color} size={21} />
            ) : (
              <ClipboardList color={color} size={21} />
            )
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: isStaff ? "History" : isGuard ? "Deliveries" : "Community",
          tabBarIcon: ({ color }) =>
            isStaff ? (
              <Clock color={color} size={21} />
            ) : isGuard ? (
              <Package color={color} size={21} />
            ) : (
              <MessageSquareText color={color} size={21} />
            )
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: isStaff ? "Alerts" : isGuard ? "Pass Scan" : "Services",
          tabBarIcon: ({ color }) =>
            isStaff ? (
              <Bell color={color} size={21} />
            ) : isGuard ? (
              <QrCode color={color} size={21} />
            ) : (
              <Wrench color={color} size={21} />
            )
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: isStaff ? "Profile" : isGuard ? "Guard Post" : "More",
          tabBarIcon: ({ color }) =>
            isStaff ? (
              <UserCheck color={color} size={21} />
            ) : isGuard ? (
              <ShieldCheck color={color} size={21} />
            ) : (
              <Grid color={color} size={21} />
            )
        }}
      />
      <Tabs.Screen
        name="society"
        options={{
          href: null
        }}
      />
    </Tabs>
  );
}
