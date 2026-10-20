import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Heart,
  HelpCircle,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Tag,
  Trash2,
  User,
  Vote,
  X
} from "lucide-react-native";
import {
  communityPolls as initialPolls,
  lostAndFoundItems as initialLostFound,
  posts as initialPosts,
  societyEvents as initialEvents,
  titleCase
} from "@resolvex/utils";
import type {
  CommunityPoll,
  CommunityPost,
  LostAndFoundItem,
  MarketplaceItem,
  SocietyEvent,
  UserProfile
} from "@resolvex/types";
import {
  ActionButton,
  Card,
  colors,
  EmptyState,
  Muted,
  Pill,
  Screen,
  Title
} from "../../components/mobile-ui";
import { db, isFirebaseConfigured } from "../../lib/firebase";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { subscribeMobileAuth } from "../../lib/auth-service";
import {
  capturePhotoFromCamera,
  pickImageFromGallery
} from "../../lib/device-capabilities";
import { uploadComplaintMedia } from "../../lib/storage-service";

import { useMobileSessionStore } from "../../lib/session-store";
import { StaffHistoryView } from "../../components/staff-views";
import { SecurityDeliveriesView } from "../../components/security-views";

type CommunityTab = "feed" | "polls" | "events" | "marketplace" | "lost_found";

export default function CommunityScreen() {
  const activeRole = useMobileSessionStore((state) => state.userProfile?.role);

  if (activeRole === "maintenance_staff") {
    return <StaffHistoryView />;
  }

  if (activeRole === "security_guard") {
    return (
      <Screen>
        <SecurityDeliveriesView />
      </Screen>
    );
  }

  const [activeTab, setActiveTab] = useState<CommunityTab>("feed");
  const profile = useMobileSessionStore((s) => s.userProfile);

  // Feed State
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);
  const [feedCategoryFilter, setFeedCategoryFilter] = useState<string>("all");
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>({});
  const [newPostModalOpen, setNewPostModalOpen] = useState(false);
  const [newPostBody, setNewPostBody] = useState("");
  const [newPostCategory, setNewPostCategory] = useState<CommunityPost["category"]>("general");
  const [newPostImageUrl, setNewPostImageUrl] = useState("");

  // Comments Sheet State
  const [activeCommentsPost, setActiveCommentsPost] = useState<CommunityPost | null>(null);
  const [commentsList, setCommentsList] = useState<Record<string, Array<{ id: string; author: string; text: string; time: string }>>>({
    "post-rent": [
      { id: "c1", author: "Rahul Sharma (A-1204)", text: "Is car parking slot included with the flat?", time: "2h ago" },
      { id: "c2", author: "Neha Mehta (B-804)", text: "Yes, covered basement 1 parking slot included.", time: "1h ago" }
    ],
    "post-help": [
      { id: "c3", author: "Resident (A-1204)", text: "Try VoltCare electricians, they repaired our backup inverter.", time: "3h ago" }
    ]
  });
  const [newCommentText, setNewCommentText] = useState("");

  // Polls State
  const [polls, setPolls] = useState<CommunityPoll[]>(initialPolls);
  const [userVotedOptionByPoll, setUserVotedOptionByPoll] = useState<Record<string, string>>({
    "poll-ev-charger": "opt-1" // demo user voted
  });

  // Events State
  const [events, setEvents] = useState<SocietyEvent[]>(initialEvents);
  const [userRsvpByEvent, setUserRsvpByEvent] = useState<Record<string, boolean>>({
    "evt-ganesh": true
  });

  // Marketplace State
  const [marketplace, setMarketplace] = useState<MarketplaceItem[]>([]);
  const [marketCategory, setMarketCategory] = useState<string>("all");
  const [newListingModalOpen, setNewListingModalOpen] = useState(false);
  const [itemTitle, setItemTitle] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategory, setItemCategory] = useState<MarketplaceItem["category"]>("furniture");
  const [itemCondition, setItemCondition] = useState<MarketplaceItem["condition"]>("like_new");
  const [itemDescription, setItemDescription] = useState("");
  const [listingImage, setListingImage] = useState<string | null>(null);
  const [isUploadingListingImage, setIsUploadingListingImage] = useState(false);

  // Contact Seller Modal State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactItem, setContactItem] = useState<MarketplaceItem | null>(null);
  const [contactMessage, setContactMessage] = useState("");
  const [isSendingInquiry, setIsSendingInquiry] = useState(false);

  // Lost & Found State
  const [lostFound, setLostFound] = useState<LostAndFoundItem[]>(initialLostFound);
  const [reportLFModalOpen, setReportLFModalOpen] = useState(false);
  const [lfTitle, setLfTitle] = useState("");
  const [lfLocation, setLfLocation] = useState("");
  const [lfDescription, setLfDescription] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured || !profile?.societyId) return;

    // 1. Community Posts
    const qP = query(collection(db, "community_posts"), where("societyId", "==", profile.societyId));
    const unsubP = onSnapshot(
      qP,
      (snap) => {
        const list: CommunityPost[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as CommunityPost));
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setPosts(list);
      },
      (err) => console.warn("Mobile posts listener error:", err)
    );

    // 2. Marketplace Items
    const qM = query(collection(db, "marketplace_items"), where("societyId", "==", profile.societyId));
    const unsubM = onSnapshot(
      qM,
      (snap) => {
        const list: MarketplaceItem[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as MarketplaceItem));
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setMarketplace(list);
      },
      (err) => console.warn("Mobile marketplace listener error:", err)
    );

    return () => {
      unsubP();
      unsubM();
    };
  }, [profile?.societyId]);

  // ─── Feed Handlers ───
  function handleToggleLike(postId: string) {
    const isLiked = likedPostIds[postId];
    setLikedPostIds((prev) => ({ ...prev, [postId]: !isLiked }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes: isLiked ? Math.max(0, p.likes - 1) : p.likes + 1 }
          : p
      )
    );
  }

  function handleCreatePost() {
    if (!newPostBody.trim()) {
      Alert.alert("Required", "Please enter post content.");
      return;
    }

    const id = `post-${Date.now()}`;
    const newPost: CommunityPost = {
      id,
      societyId: profile?.societyId || "soc-ajanta-genx",
      authorUserId: profile?.uid || "usr-resident-1",
      category: newPostCategory,
      body: newPostBody.trim(),
      imageUrl: newPostImageUrl.trim() || undefined,
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured) {
      setDoc(doc(db, "community_posts", id), newPost).catch((e) =>
        console.warn("Firestore post write error:", e)
      );
    }

    setPosts([newPost, ...posts]);
    setNewPostBody("");
    setNewPostImageUrl("");
    setNewPostModalOpen(false);
    Alert.alert("Post Published", "Your post is now visible in the society community feed.");
  }

  function handleAddComment() {
    if (!activeCommentsPost || !newCommentText.trim()) return;
    const commentId = `cm-${Date.now()}`;
    const authorName = profile?.displayName || "Resident";
    const newComment = {
      id: commentId,
      author: authorName,
      text: newCommentText.trim(),
      time: "Just now"
    };

    setCommentsList((prev) => ({
      ...prev,
      [activeCommentsPost.id]: [...(prev[activeCommentsPost.id] || []), newComment]
    }));

    setPosts((prev) =>
      prev.map((p) =>
        p.id === activeCommentsPost.id ? { ...p, comments: p.comments + 1 } : p
      )
    );

    setNewCommentText("");
  }

  // ─── Polls Handler ───
  function handleVote(pollId: string, optionId: string) {
    if (userVotedOptionByPoll[pollId]) {
      Alert.alert("Already Voted", "You have already cast your vote on this society poll.");
      return;
    }

    setUserVotedOptionByPoll((prev) => ({ ...prev, [pollId]: optionId }));
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p;
        return {
          ...p,
          options: p.options.map((opt) =>
            opt.id === optionId
              ? { ...opt, votes: opt.votes + 1, votedUserIds: [...opt.votedUserIds, profile?.uid || "user-me"] }
              : opt
          )
        };
      })
    );
    Alert.alert("Vote Recorded", "Thank you for participating in society governance.");
  }

  // ─── Events Handler ───
  function handleToggleRSVP(eventId: string) {
    const isAttending = userRsvpByEvent[eventId];
    setUserRsvpByEvent((prev) => ({ ...prev, [eventId]: !isAttending }));
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const attendees = isAttending
          ? ev.attendeeUserIds.filter((uid) => uid !== (profile?.uid || "user-me"))
          : [...ev.attendeeUserIds, profile?.uid || "user-me"];
        return { ...ev, attendeeUserIds: attendees };
      })
    );
  }

  // ─── Marketplace Handlers ───
  async function handlePickListingImage(source: "camera" | "gallery") {
    try {
      setIsUploadingListingImage(true);
      const res = source === "camera" ? await capturePhotoFromCamera() : await pickImageFromGallery();
      if (res && res.uri) {
        // Direct Cloudinary upload — strict enforcement, never fallback to local file:// or content:// URI
        const uploadRes = await uploadComplaintMedia(
          profile?.societyId || "soc-green-valley",
          `mkt-${Date.now()}`,
          { uri: res.uri, name: res.name, type: res.type, size: res.size }
        );
        if (uploadRes && uploadRes.url && uploadRes.url.startsWith("https://")) {
          setListingImage(uploadRes.url);
        } else {
          throw new Error("Invalid image URL returned from upload provider.");
        }
      }
    } catch (err: any) {
      setListingImage(null);
      Alert.alert("Upload Failed", err.message || "Failed to upload marketplace image. Please try again.");
    } finally {
      setIsUploadingListingImage(false);
    }
  }

  async function handleCreateListing() {
    if (isUploadingListingImage) {
      Alert.alert("Please Wait", "Photo is currently uploading to cloud storage.");
      return;
    }

    if (!itemTitle.trim() || !itemPrice.trim()) {
      Alert.alert("Required", "Please provide a title and price.");
      return;
    }

    // Strict safety check: Never permit local device URIs to enter Firestore
    if (listingImage && (listingImage.startsWith("file://") || listingImage.startsWith("content://") || !listingImage.startsWith("https://"))) {
      Alert.alert("Upload Incomplete", "Please wait for photo upload to finish or re-select the image.");
      return;
    }

    const priceNum = parseFloat(itemPrice.replace(/[^0-9.]/g, "")) || 0;
    const id = `mkt-${Date.now().toString().slice(-6)}`;
    const newListing: MarketplaceItem = {
      id,
      societyId: profile?.societyId || "soc-green-valley",
      sellerUserId: profile?.uid || "usr-resident",
      title: itemTitle.trim(),
      description: itemDescription.trim() || itemTitle.trim(),
      price: priceNum,
      condition: itemCondition,
      category: itemCategory,
      imageUrl: listingImage || undefined,
      status: "available",
      createdAt: new Date().toISOString()
    };

    try {
      if (isFirebaseConfigured) {
        await setDoc(doc(db, "marketplace_items", id), newListing);
      }
      setMarketplace((prev) => [newListing, ...prev.filter((m) => m.id !== id)]);
      setItemTitle("");
      setItemPrice("");
      setItemDescription("");
      setListingImage(null);
      setNewListingModalOpen(false);
      Alert.alert("Listing Active", "Your item has been listed on the society marketplace.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save listing to database.");
    }
  }

  async function handleSendSellerInquiry() {
    if (!contactItem || !contactMessage.trim()) {
      Alert.alert("Required", "Please type a message for the seller.");
      return;
    }

    setIsSendingInquiry(true);
    try {
      if (isFirebaseConfigured && contactItem.sellerUserId) {
        const notifId = `notif-${Date.now()}`;
        await setDoc(doc(db, "notifications", notifId), {
          id: notifId,
          societyId: profile?.societyId || "soc-green-valley",
          userId: contactItem.sellerUserId,
          title: `Marketplace Inquiry: ${contactItem.title}`,
          body: `${profile?.displayName || "A resident"} (Flat ${profile?.flatId || "Resident"}): "${contactMessage.trim()}"`,
          type: "community",
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      setContactModalOpen(false);
      setContactMessage("");
      setContactItem(null);
      Alert.alert(
        "Inquiry Sent",
        "Your message has been securely sent to the resident seller's in-app notifications."
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send inquiry to seller.");
    } finally {
      setIsSendingInquiry(false);
    }
  }

  // ─── Lost & Found Handlers ───
  function handleReportLF() {
    if (!lfTitle.trim() || !lfLocation.trim()) {
      Alert.alert("Required", "Please provide item name and location found.");
      return;
    }

    const id = `lf-${Date.now().toString().slice(-4)}`;
    const newItem: LostAndFoundItem = {
      id,
      societyId: profile?.societyId || "soc-ajanta-genx",
      reportedByUserId: profile?.uid || "usr-resident",
      title: lfTitle.trim(),
      description: lfDescription.trim() || lfTitle.trim(),
      locationFound: lfLocation.trim(),
      dateFound: new Date().toISOString().split("T")[0],
      imageUrl: "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&auto=format&fit=crop&q=80",
      status: "unclaimed"
    };

    setLostFound([newItem, ...lostFound]);
    setLfTitle("");
    setLfLocation("");
    setLfDescription("");
    setReportLFModalOpen(false);
    Alert.alert("Item Reported", "Notice posted on the society Lost & Found board.");
  }

  function handleClaimLF(itemId: string) {
    setLostFound((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, status: "claimed", claimedByUserId: profile?.uid || "user-me" }
          : item
      )
    );
    Alert.alert(
      "Claim Registered",
      "Notice sent to the resident who found this item. Please coordinate at Security Gate 1 for handover."
    );
  }

  const filteredPosts = posts.filter((p) => {
    if (feedCategoryFilter === "all") return true;
    return p.category === feedCategoryFilter;
  });

  const filteredMarketplace = marketplace.filter((m) => {
    if (marketCategory === "all") return true;
    return m.category === marketCategory;
  });

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View style={localStyles.header}>
          <View>
            <Muted>Ajanta Gen-X Community</Muted>
            <Title>Society Hub</Title>
          </View>
          {activeTab === "feed" && (
            <Pressable
              style={localStyles.primaryButton}
              onPress={() => setNewPostModalOpen(true)}
            >
              <Plus color="#ffffff" size={16} />
              <Text style={localStyles.primaryButtonText}>Post</Text>
            </Pressable>
          )}
          {activeTab === "marketplace" && (
            <Pressable
              style={localStyles.primaryButton}
              onPress={() => setNewListingModalOpen(true)}
            >
              <Plus color="#ffffff" size={16} />
              <Text style={localStyles.primaryButtonText}>Sell</Text>
            </Pressable>
          )}
          {activeTab === "lost_found" && (
            <Pressable
              style={localStyles.primaryButton}
              onPress={() => setReportLFModalOpen(true)}
            >
              <Plus color="#ffffff" size={16} />
              <Text style={localStyles.primaryButtonText}>Report</Text>
            </Pressable>
          )}
        </View>

        {/* Segmented Tabs Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.tabsScroll}>
          <View style={localStyles.tabsRow}>
            {[
              { id: "feed", label: "Feed", icon: MessageCircle },
              { id: "polls", label: "Polls", icon: Vote },
              { id: "events", label: "Events", icon: Calendar },
              { id: "marketplace", label: "Buy & Sell", icon: ShoppingBag },
              { id: "lost_found", label: "Lost & Found", icon: Package }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[localStyles.tabButton, isActive && localStyles.tabButtonActive]}
                  onPress={() => setActiveTab(tab.id as CommunityTab)}
                >
                  <Icon size={14} color={isActive ? "#ffffff" : colors.muted} />
                  <Text style={[localStyles.tabButtonText, isActive && localStyles.tabButtonTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* ─── 1. FEED VIEW ─── */}
        {activeTab === "feed" && (
          <View style={{ marginTop: 12 }}>
            {/* Category Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[
                  { id: "all", label: "All" },
                  { id: "general", label: "General" },
                  { id: "help", label: "Help Needed" },
                  { id: "rent", label: "Rent / Real Estate" },
                  { id: "recommendations", label: "Recommendations" },
                  { id: "events", label: "Events" }
                ].map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setFeedCategoryFilter(cat.id)}
                    style={[
                      localStyles.filterChip,
                      feedCategoryFilter === cat.id && localStyles.filterChipActive
                    ]}
                  >
                    <Text
                      style={[
                        localStyles.filterChipText,
                        feedCategoryFilter === cat.id && localStyles.filterChipTextActive
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {filteredPosts.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No posts in this category"
                description="Share updates, recommendations, or ask a question to fellow residents."
                actionLabel="Create Post"
                onAction={() => setNewPostModalOpen(true)}
              />
            ) : (
              <View style={{ gap: 12 }}>
                {filteredPosts.map((post) => {
                  const author = {
                    name: "Resident Neighbor",
                    flatId: "Verified Resident"
                  };
                  const isLiked = likedPostIds[post.id];
                  const postComments = commentsList[post.id] || [];

                  return (
                    <Card key={post.id} style={{ padding: 14 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                          <View style={localStyles.avatarBox}>
                            <User size={16} color={colors.primary} />
                          </View>
                          <View>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                              {author.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.muted }}>
                              Tower A · Flat A-1204
                            </Text>
                          </View>
                        </View>
                        <Pill tone="secondary">{titleCase(post.category)}</Pill>
                      </View>

                      <Text style={{ marginTop: 10, fontSize: 13, color: colors.text, lineHeight: 20 }}>
                        {post.body}
                      </Text>

                      {post.imageUrl && (
                        <Image
                          source={{ uri: post.imageUrl }}
                          style={{ width: "100%", height: 170, borderRadius: 10, marginTop: 10 }}
                          resizeMode="cover"
                        />
                      )}

                      {/* Post Actions: Like & Comment */}
                      <View style={localStyles.postActionsRow}>
                        <Pressable
                          style={localStyles.postActionButton}
                          onPress={() => handleToggleLike(post.id)}
                        >
                          <Heart
                            size={16}
                            color={isLiked ? colors.danger : colors.muted}
                            fill={isLiked ? colors.danger : "transparent"}
                          />
                          <Text style={[localStyles.postActionText, isLiked && { color: colors.danger, fontWeight: "800" }]}>
                            {post.likes} {post.likes === 1 ? "Like" : "Likes"}
                          </Text>
                        </Pressable>

                        <Pressable
                          style={localStyles.postActionButton}
                          onPress={() => setActiveCommentsPost(post)}
                        >
                          <MessageCircle size={16} color={colors.muted} />
                          <Text style={localStyles.postActionText}>
                            {post.comments || postComments.length} Comments
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ─── 2. POLLS VIEW (Section 17) ─── */}
        {activeTab === "polls" && (
          <View style={{ marginTop: 12, gap: 14 }}>
            {polls.map((poll) => {
              const userVotedOpt = userVotedOptionByPoll[poll.id];
              const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);

              return (
                <Card key={poll.id} style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Pill tone="accent">OFFICIAL POLL</Pill>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      Expires: {new Date(poll.expiresAt).toLocaleDateString()}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text, marginTop: 8 }}>
                    {poll.question}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    Total votes cast: {totalVotes} · One vote per verified resident
                  </Text>

                  <View style={{ marginTop: 14, gap: 10 }}>
                    {poll.options.map((opt) => {
                      const isSelected = userVotedOpt === opt.id;
                      const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;

                      if (userVotedOpt) {
                        // After voting: Show results breakdown
                        return (
                          <View key={opt.id} style={localStyles.pollResultItem}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                              <Text style={[localStyles.pollOptText, isSelected && { fontWeight: "800", color: colors.primary }]}>
                                {opt.text} {isSelected && "✓ (Your Vote)"}
                              </Text>
                              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>
                                {percentage}% ({opt.votes})
                              </Text>
                            </View>
                            <View style={localStyles.pollProgressBarBg}>
                              <View
                                style={[
                                  localStyles.pollProgressBarFill,
                                  { width: `${percentage}%` },
                                  isSelected && { backgroundColor: colors.primary }
                                ]}
                              />
                            </View>
                          </View>
                        );
                      }

                      // Before voting: Show selectable option
                      return (
                        <Pressable
                          key={opt.id}
                          style={localStyles.pollOptionSelectButton}
                          onPress={() => handleVote(poll.id, opt.id)}
                        >
                          <View style={localStyles.radioCircle} />
                          <Text style={localStyles.pollOptSelectText}>{opt.text}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* ─── 3. EVENTS VIEW (Section 18) ─── */}
        {activeTab === "events" && (
          <View style={{ marginTop: 12, gap: 14 }}>
            {events.map((ev) => {
              const isAttending = userRsvpByEvent[ev.id];
              return (
                <Card key={ev.id} style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Pill tone="primary">SOCIETY EVENT</Pill>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                      {ev.attendeeUserIds.length} Residents Attending
                    </Text>
                  </View>

                  <Text style={{ fontSize: 17, fontWeight: "900", color: colors.text, marginTop: 8 }}>
                    {ev.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 }}>
                    {ev.description}
                  </Text>

                  <View style={{ backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, marginVertical: 12, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Calendar size={14} color={colors.muted} />
                      <Text style={{ fontSize: 12, color: colors.text, fontWeight: "700" }}>
                        {ev.eventDate} · {ev.time}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <MapPin size={14} color={colors.muted} />
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        Venue: {ev.venue}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      Organizer: {ev.organizer}
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      localStyles.rsvpButton,
                      isAttending ? localStyles.rsvpButtonActive : localStyles.rsvpButtonInactive
                    ]}
                    onPress={() => handleToggleRSVP(ev.id)}
                  >
                    <Text style={[localStyles.rsvpButtonText, isAttending && localStyles.rsvpButtonTextActive]}>
                      {isAttending ? "Attending ✓ (Tap to cancel)" : "RSVP Attending"}
                    </Text>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}

        {/* ─── 4. MARKETPLACE VIEW (Section 19) ─── */}
        {activeTab === "marketplace" && (
          <View style={{ marginTop: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {["all", "furniture", "vehicles", "electronics", "appliances"].map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setMarketCategory(cat)}
                    style={[
                      localStyles.filterChip,
                      marketCategory === cat && localStyles.filterChipActive
                    ]}
                  >
                    <Text
                      style={[
                        localStyles.filterChipText,
                        marketCategory === cat && localStyles.filterChipTextActive
                      ]}
                    >
                      {titleCase(cat)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {filteredMarketplace.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag size={32} color={colors.muted} />}
                title="No Items for Sale"
                description="Tap 'Sell' above to list an item for society residents."
              />
            ) : (
              <View style={{ gap: 12 }}>
                {filteredMarketplace.map((item) => (
                  <Card key={item.id} style={{ padding: 14 }}>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={{ width: 100, height: 100, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 100,
                            height: 100,
                            borderRadius: 8,
                            backgroundColor: "#f1f5f9",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <ShoppingBag size={28} color={colors.muted} />
                          <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>No Photo</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Pill tone="secondary">{item.condition.replace("_", " ").toUpperCase()}</Pill>
                          <Text style={{ fontSize: 16, fontWeight: "900", color: colors.primary }}>
                            ₹{item.price.toLocaleString()}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text, marginTop: 4 }} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={2}>
                          {item.description}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                          Society Resident Listing · Pickup only
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "flex-end" }}>
                      {item.sellerUserId !== profile?.uid ? (
                        <Pressable
                          style={localStyles.contactSellerButton}
                          onPress={() => {
                            setContactItem(item);
                            setContactMessage(`Hi! I am interested in your listing "${item.title}". Is it still available?`);
                            setContactModalOpen(true);
                          }}
                        >
                          <Text style={localStyles.contactSellerText}>Contact Resident Seller</Text>
                        </Pressable>
                      ) : (
                        <Pill tone="accent">YOUR LISTING</Pill>
                      )}
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ─── 5. LOST & FOUND VIEW (Section 20) ─── */}
        {activeTab === "lost_found" && (
          <View style={{ marginTop: 12, gap: 12 }}>
            {lostFound.map((item) => (
              <Card key={item.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Pill tone={item.status === "claimed" ? "success" : "accent"}>
                    {item.status.toUpperCase()}
                  </Pill>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Found: {item.dateFound}
                  </Text>
                </View>

                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 8 }}>
                  {item.title}
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                  Location Found: {item.locationFound}
                </Text>
                <Text style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>
                  {item.description}
                </Text>

                {item.imageUrl && (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: "100%", height: 150, borderRadius: 8, marginTop: 10 }}
                    resizeMode="cover"
                  />
                )}

                <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Kept safely at Security Gate 1
                  </Text>
                  {item.status === "unclaimed" && (
                    <Pressable
                      style={localStyles.claimButton}
                      onPress={() => handleClaimLF(item.id)}
                    >
                      <Text style={localStyles.claimButtonText}>Claim This Item</Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Post Creation Modal ── */}
      <Modal visible={newPostModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Share with Society</Text>
              <Pressable onPress={() => setNewPostModalOpen(false)}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <Text style={localStyles.inputLabel}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {(["general", "help", "rent", "recommendations", "events"] as const).map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setNewPostCategory(cat)}
                  style={[
                    localStyles.filterChip,
                    newPostCategory === cat && localStyles.filterChipActive
                  ]}
                >
                  <Text
                    style={[
                      localStyles.filterChipText,
                      newPostCategory === cat && localStyles.filterChipTextActive
                    ]}
                  >
                    {titleCase(cat)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={localStyles.inputLabel}>Content *</Text>
            <TextInput
              value={newPostBody}
              onChangeText={setNewPostBody}
              placeholder="What's happening in your society? Ask questions, share news, or recommendations..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              style={[localStyles.textInput, { height: 100, textAlignVertical: "top" }]}
            />

            <View style={localStyles.modalActions}>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                onPress={() => setNewPostModalOpen(false)}
              >
                <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreatePost}
              >
                <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Publish Post</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Comments Sheet Modal ── */}
      {activeCommentsPost && (
        <Modal visible={!!activeCommentsPost} animationType="slide" transparent>
          <View style={localStyles.modalOverlay}>
            <View style={[localStyles.modalContent, { maxHeight: "80%" }]}>
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>Comments ({commentsList[activeCommentsPost.id]?.length || 0})</Text>
                <Pressable onPress={() => setActiveCommentsPost(null)}>
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                {(commentsList[activeCommentsPost.id] || []).length === 0 ? (
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", marginVertical: 20 }}>
                    No comments yet. Be the first to reply!
                  </Text>
                ) : (
                  (commentsList[activeCommentsPost.id] || []).map((c) => (
                    <View key={c.id} style={localStyles.commentItem}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>
                          {c.author}
                        </Text>
                        <Text style={{ fontSize: 10, color: colors.muted }}>{c.time}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.text, marginTop: 2 }}>{c.text}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
                <TextInput
                  value={newCommentText}
                  onChangeText={setNewCommentText}
                  placeholder="Add a comment..."
                  placeholderTextColor="#94a3b8"
                  style={[localStyles.textInput, { flex: 1 }]}
                />
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.primary, height: 42, paddingHorizontal: 16 }]}
                  onPress={handleAddComment}
                >
                  <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Send</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Marketplace Listing Modal ── */}
      <Modal visible={newListingModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>List Item for Sale</Text>
              <Pressable onPress={() => setNewListingModalOpen(false)}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={localStyles.inputLabel}>Item Title *</Text>
              <TextInput
                value={itemTitle}
                onChangeText={setItemTitle}
                placeholder="e.g. Study Table with Drawers"
                placeholderTextColor="#94a3b8"
                style={localStyles.textInput}
              />

              <Text style={localStyles.inputLabel}>Category</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {(["furniture", "vehicles", "electronics", "appliances", "other"] as const).map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setItemCategory(cat as any)}
                    style={[
                      localStyles.filterChip,
                      itemCategory === cat && localStyles.filterChipActive
                    ]}
                  >
                    <Text
                      style={[
                        localStyles.filterChipText,
                        itemCategory === cat && localStyles.filterChipTextActive
                      ]}
                    >
                      {titleCase(cat)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={localStyles.inputLabel}>Price (₹) *</Text>
              <TextInput
                value={itemPrice}
                onChangeText={setItemPrice}
                placeholder="e.g. 2500"
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                style={localStyles.textInput}
              />

              <Text style={localStyles.inputLabel}>Description</Text>
              <TextInput
                value={itemDescription}
                onChangeText={setItemDescription}
                placeholder="Dimensions, condition, reason for selling..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={2}
                style={[localStyles.textInput, { height: 64 }]}
              />

              <Text style={localStyles.inputLabel}>Item Photo (Optional)</Text>
              {listingImage ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
                  <Image
                    source={{ uri: listingImage }}
                    style={{ width: 72, height: 72, borderRadius: 8 }}
                  />
                  <Pressable
                    onPress={() => setListingImage(null)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 8, backgroundColor: "#fee2e2", borderRadius: 6 }}
                  >
                    <Trash2 size={16} color="#ef4444" />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#ef4444" }}>Remove Photo</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <Pressable
                    onPress={() => handlePickListingImage("camera")}
                    disabled={isUploadingListingImage}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      backgroundColor: "#f8fafc"
                    }}
                  >
                    <Camera size={16} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                      {isUploadingListingImage ? "Uploading..." : "Camera"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handlePickListingImage("gallery")}
                    disabled={isUploadingListingImage}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      backgroundColor: "#f8fafc"
                    }}
                  >
                    <Package size={16} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                      {isUploadingListingImage ? "Uploading..." : "Gallery"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <View style={localStyles.modalActions}>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                onPress={() => setNewListingModalOpen(false)}
              >
                <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateListing}
              >
                <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Create Listing</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Contact Seller Modal ── */}
      <Modal visible={contactModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Contact Resident Seller</Text>
              <Pressable onPress={() => setContactModalOpen(false)}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            {contactItem && (
              <View style={{ backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{contactItem.title}</Text>
                <Text style={{ fontSize: 13, fontWeight: "900", color: colors.primary, marginTop: 2 }}>
                  ₹{contactItem.price.toLocaleString()}
                </Text>
              </View>
            )}

            <Text style={localStyles.inputLabel}>Your Message to Seller *</Text>
            <TextInput
              value={contactMessage}
              onChangeText={setContactMessage}
              placeholder="Inquire about availability, condition, pickup time..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              style={[localStyles.textInput, { height: 80, textAlignVertical: "top" }]}
            />
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
              🔒 Privacy Protected: Sent directly to the seller's in-app notification center. Private phone numbers are never exposed.
            </Text>

            <View style={localStyles.modalActions}>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                onPress={() => setContactModalOpen(false)}
              >
                <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSendSellerInquiry}
                disabled={isSendingInquiry}
              >
                <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>
                  {isSendingInquiry ? "Sending..." : "Send Message"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Report Lost & Found Modal ── */}
      <Modal visible={reportLFModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Report Found Item</Text>
              <Pressable onPress={() => setReportLFModalOpen(false)}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <Text style={localStyles.inputLabel}>Item Name *</Text>
            <TextInput
              value={lfTitle}
              onChangeText={setLfTitle}
              placeholder="e.g. Set of 3 brass keys with blue keychain"
              placeholderTextColor="#94a3b8"
              style={localStyles.textInput}
            />

            <Text style={localStyles.inputLabel}>Location Found *</Text>
            <TextInput
              value={lfLocation}
              onChangeText={setLfLocation}
              placeholder="e.g. Tower A Ground Floor Lift Lobby"
              placeholderTextColor="#94a3b8"
              style={localStyles.textInput}
            />

            <Text style={localStyles.inputLabel}>Description / Notes</Text>
            <TextInput
              value={lfDescription}
              onChangeText={setLfDescription}
              placeholder="Describe condition or handover instructions..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={2}
              style={[localStyles.textInput, { height: 60 }]}
            />

            <View style={localStyles.modalActions}>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                onPress={() => setReportLFModalOpen(false)}
              >
                <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleReportLF}
              >
                <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Post Report</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 12
  },
  tabsScroll: {
    marginTop: 12
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted
  },
  tabButtonTextActive: {
    color: "#ffffff"
  },
  filterChip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: "800"
  },
  avatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  postActionsRow: {
    flexDirection: "row",
    gap: 18,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.border
  },
  postActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  postActionText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600"
  },
  pollResultItem: {
    marginBottom: 8
  },
  pollOptText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "600"
  },
  pollProgressBarBg: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden"
  },
  pollProgressBarFill: {
    height: 8,
    backgroundColor: colors.secondary,
    borderRadius: 4
  },
  pollOptionSelectButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#ffffff"
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.primary
  },
  pollOptSelectText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  rsvpButton: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  rsvpButtonActive: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.success
  },
  rsvpButtonInactive: {
    backgroundColor: colors.primary
  },
  rsvpButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff"
  },
  rsvpButtonTextActive: {
    color: colors.success
  },
  contactSellerButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.primary
  },
  contactSellerText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800"
  },
  claimButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.primary
  },
  claimButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800"
  },
  commentItem: {
    padding: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    marginBottom: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: "85%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#f1f5f9"
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  modalButtonText: {
    fontSize: 13,
    fontWeight: "800"
  }
});
