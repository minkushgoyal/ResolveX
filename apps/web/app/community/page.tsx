"use client";

import { useEffect, useState } from "react";
import {
  BarChart2,
  Calendar,
  Check,
  CheckCircle,
  Heart,
  HelpCircle,
  ImagePlus,
  MapPin,
  MessageCircle,
  MessageSquare,
  Plus,
  Send,
  ShoppingBag,
  Tag,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  communityPolls,
  lostAndFoundItems,
  marketplaceItems as initialMarketplaceItems,
  posts as initialPosts,
  residents,
  societyEvents as initialSocietyEvents,
  formatCurrency,
  titleCase
} from "@resolvex/utils";
import type { CommunityPost, MarketplaceItem, SocietyEvent } from "@resolvex/types";
import { AppShell } from "@/components/app-shell";
import { AnimatedSection, Badge, Button, Card } from "@/components/ui";
import { cn } from "@resolvex/ui";
import { useAuth } from "@/lib/auth-context";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import {
  createMarketplaceListing,
  createPost,
  rsvpEvent,
  subscribeEvents,
  subscribeMarketplace,
  subscribePolls,
  subscribePosts,
  votePoll
} from "@/lib/services";

type TabType = "feed" | "marketplace" | "polls" | "events" | "lost_found";

const tabs: Array<{ id: TabType; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "feed", label: "Discussion", icon: MessageSquare },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { id: "polls", label: "Polls", icon: BarChart2 },
  { id: "events", label: "Events", icon: Calendar },
  { id: "lost_found", label: "Lost & Found", icon: HelpCircle }
];

export default function CommunityPage() {
  const { userProfile } = useAuth();
  const currentUserId = userProfile?.uid || "usr-resident-1";
  const societyId = userProfile?.societyId || "soc-ajanta-genx";

  const [activeTab, setActiveTab] = useState<TabType>("feed");
  const [postsList, setPostsList] = useState<CommunityPost[]>(initialPosts);
  const [newPostBody, setNewPostBody] = useState("");
  const [polls, setPolls] = useState(communityPolls);

  // Marketplace State
  const [itemsList, setItemsList] = useState<MarketplaceItem[]>(initialMarketplaceItems);
  const [showListingModal, setShowListingModal] = useState(false);
  const [listingTitle, setListingTitle] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingCategory, setListingCategory] = useState<MarketplaceItem["category"]>("furniture");
  const [listingCondition, setListingCondition] = useState<MarketplaceItem["condition"]>("like_new");
  const [listingDescription, setListingDescription] = useState("");
  const [listingImageUrl, setListingImageUrl] = useState("");

  // Contact Seller State
  const [contactingItem, setContactingItem] = useState<MarketplaceItem | null>(null);
  const [contactMessage, setContactMessage] = useState("Hi, is this still available? I am interested in purchasing it.");

  // Events State
  const [eventsList, setEventsList] = useState<SocietyEvent[]>(initialSocietyEvents);
  const [rsvpdEventIds, setRsvpdEventIds] = useState<string[]>([]);

  // Lost & Found Claim State
  const [claimingItem, setClaimingItem] = useState<typeof lostAndFoundItems[0] | null>(null);
  const [claimProofNote, setClaimProofNote] = useState("");

  // Subscribe to real services
  useEffect(() => {
    const unsubPosts = subscribePosts(societyId, (posts) => {
      setPostsList(posts);
    });
    const unsubPolls = subscribePolls(societyId, (p) => {
      setPolls(p);
    });
    const unsubMkt = subscribeMarketplace(societyId, (items) => {
      setItemsList(items);
    });
    const unsubEvents = subscribeEvents(societyId, (evts) => {
      setEventsList(evts);
    });
    return () => {
      unsubPosts();
      unsubPolls();
      unsubMkt();
      unsubEvents();
    };
  }, [societyId, userProfile?.uid]);

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newPostBody.trim()) return;

    try {
      const newPost = await createPost({
        societyId,
        authorUserId: currentUserId,
        category: "general",
        body: newPostBody.trim()
      });
      setPostsList((prev) => [newPost, ...prev.filter((p) => p.id !== newPost.id)]);
      setNewPostBody("");
      toast.success("Post published to community feed!");
    } catch (err: any) {
      toast.error(err.message || "Could not publish post");
    }
  }

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    if (!listingTitle.trim() || !listingPrice) return;

    const parsedPrice = parseFloat(listingPrice) || 0;
    const cleanImageUrl = listingImageUrl.trim() ? listingImageUrl.trim() : undefined;
    try {
      const newItem = await createMarketplaceListing({
        societyId,
        sellerUserId: currentUserId,
        title: listingTitle.trim(),
        description: listingDescription.trim() || `Item listed by resident of ${userProfile?.flatId ? `Flat ${userProfile.flatId.replace("flat-", "").toUpperCase()}` : "society"}.`,
        price: parsedPrice,
        condition: listingCondition,
        category: listingCategory,
        imageUrl: cleanImageUrl
      });
      setItemsList((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)]);
      setShowListingModal(false);
      setListingTitle("");
      setListingPrice("");
      setListingDescription("");
      setListingImageUrl("");
      toast.success(`Listing published: "${newItem.title}" is now visible to all residents.`);
    } catch (err: any) {
      toast.error(err.message || "Could not publish listing");
    }
  }

  async function handleSendContactMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!contactingItem) return;

    try {
      if (isFirebaseConfigured && contactingItem.sellerUserId) {
        const notifId = `notif-${Date.now()}`;
        await setDoc(doc(db, "notifications", notifId), {
          id: notifId,
          societyId,
          userId: contactingItem.sellerUserId,
          title: `Marketplace Inquiry: ${contactingItem.title}`,
          body: `${userProfile?.displayName || "A resident"} (${userProfile?.flatId ? `Flat ${userProfile.flatId.replace("flat-", "").toUpperCase()}` : "Resident"}): "${contactMessage.trim()}"`,
          type: "community",
          read: false,
          createdAt: new Date().toISOString()
        });
      }
      toast.success(`Inquiry sent directly to resident seller regarding "${contactingItem.title}".`);
      setContactingItem(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message to seller.");
    }
  }

  async function handleToggleRsvp(eventId: string) {
    const isAlreadyRsvpd = rsvpdEventIds.includes(eventId);
    if (isAlreadyRsvpd) {
      setRsvpdEventIds(rsvpdEventIds.filter((id) => id !== eventId));
      setEventsList(
        eventsList.map((evt) =>
          evt.id === eventId
            ? { ...evt, attendeeUserIds: evt.attendeeUserIds.filter((u) => u !== currentUserId) }
            : evt
        )
      );
      await rsvpEvent({ eventId, societyId, userId: currentUserId, attending: false });
      toast.info("RSVP cancelled.");
    } else {
      setRsvpdEventIds([...rsvpdEventIds, eventId]);
      setEventsList(
        eventsList.map((evt) =>
          evt.id === eventId
            ? { ...evt, attendeeUserIds: [...evt.attendeeUserIds, currentUserId] }
            : evt
        )
      );
      await rsvpEvent({ eventId, societyId, userId: currentUserId, attending: true });
      toast.success("RSVP Confirmed! Digital pass added to your account.");
    }
  }

  function handleClaimItem(e: React.FormEvent) {
    e.preventDefault();
    if (!claimingItem) return;
    toast.success(`Claim submitted for "${claimingItem.title}". Security Gate 1 dispatch informed.`);
    setClaimingItem(null);
    setClaimProofNote("");
  }

  async function handleVote(pollId: string, optionId: string) {
    try {
      await votePoll(pollId, optionId, currentUserId, societyId);
      toast.success("Vote recorded in Firestore!");
    } catch (err: any) {
      toast.error(err.message || "Failed to record vote.");
    }
  }

  return (
    <AppShell>
      <AnimatedSection className="space-y-5">

        {/* Page header */}
        <div>
          <p className="rx-eyebrow mb-1">Resident Community Hub</p>
          <h2 className="text-2xl font-bold tracking-tight">Community & Engagement</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect with neighbours, vote on polls, buy/sell pre-owned items, RSVP for society events, and track lost belongings.
          </p>
        </div>

        {/* Tab bar — underline style */}
        <div className="flex border-b overflow-x-auto scrollbar-none -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium rx-transition whitespace-nowrap",
                  active
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Feed ────────────────────────────────────────────────────────── */}
        {activeTab === "feed" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {/* Compose post */}
              <Card className="p-4">
                <form onSubmit={handleCreatePost} className="space-y-3">
                  <textarea
                    rows={3}
                    value={newPostBody}
                    onChange={(e) => setNewPostBody(e.target.value)}
                    className="w-full rounded-lg border bg-muted/30 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none placeholder:text-muted-foreground/60"
                    placeholder="Share something with your society neighbours…"
                  />
                  <div className="flex items-center justify-between">
                    <Button type="button" variant="ghost" size="sm" className="text-xs">
                      <ImagePlus size={14} className="mr-1.5" />
                      Attach Image
                    </Button>
                    <Button type="submit" size="sm">
                      <Send size={14} className="mr-1.5" />
                      Post
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Posts */}
              {postsList.map((post) => {
                const author = residents.find((r) => r.id === post.authorUserId) || residents[0];
                return (
                  <Card key={post.id} className="p-4 space-y-3 rx-transition hover:border-border/70">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {author.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{author.name}</p>
                          <span className="text-xs text-muted-foreground capitalize">{titleCase(post.category)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Tower A · {author.householdRole}</p>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed">{post.body}</p>

                    {post.imageUrl && (
                      <div className="h-48 overflow-hidden rounded-lg bg-muted">
                        <img src={post.imageUrl} alt="Post Attachment" className="h-full w-full object-cover" />
                      </div>
                    )}

                    <div className="flex items-center gap-4 border-t pt-2.5 text-xs text-muted-foreground">
                      <button className="flex items-center gap-1.5 font-medium hover:text-primary rx-transition">
                        <Heart size={14} />
                        {post.likes}
                      </button>
                      <button className="flex items-center gap-1.5 font-medium hover:text-primary rx-transition">
                        <MessageCircle size={14} />
                        {post.comments}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Sidebar */}
            <aside className="space-y-4">
              <Card className="p-4 space-y-2">
                <h4 className="text-sm font-semibold">Community Guidelines</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Keep discussions respectful, maintain resident privacy, and follow society bylaws. Posts are visible to all verified residents.
                </p>
              </Card>
              <Card className="p-4 space-y-2">
                <h4 className="text-sm font-semibold">Active Committees</h4>
                <p className="text-xs text-muted-foreground">
                  Cultural & Festival Committee · Green Campus & Garden Group · Sports Council
                </p>
              </Card>
            </aside>
          </div>
        )}

        {/* ── Marketplace ──────────────────────────────────────────────── */}
        {activeTab === "marketplace" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Resident Marketplace</h3>
                <p className="text-xs text-muted-foreground">Buy, sell, and exchange pre-owned goods directly within the society</p>
              </div>
              <Button size="sm" onClick={() => setShowListingModal(true)}>
                <Plus size={14} className="mr-1.5" />
                Post Listing
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {itemsList.map((item) => (
                <Card key={item.id} className="overflow-hidden flex flex-col rx-transition hover:border-border/80">
                  <div className="relative h-44 overflow-hidden bg-muted flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                        <ShoppingBag size={32} className="opacity-40 mb-1" />
                        <span className="text-xs font-semibold">No Image Available</span>
                        <span className="text-[10px] text-muted-foreground/60">Verified Resident Listing</span>
                      </div>
                    )}
                    <div className="absolute right-3 top-3">
                      <span className="rounded-full bg-background/90 px-2.5 py-1 text-sm font-bold backdrop-blur-sm shadow-xs">
                        ₹{item.price.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                        {item.category}
                      </span>
                      <h4 className="mt-0.5 font-bold leading-snug">{item.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2 border-t">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
                        {item.condition.replace("_", " ")}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setContactingItem(item)}>
                        Contact Seller
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── Polls ─────────────────────────────────────────────────────── */}
        {activeTab === "polls" && (
          <div className="grid gap-4 md:grid-cols-2">
            {polls.map((poll) => {
              const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
              const userVotedOption = poll.options.find((opt) => opt.votedUserIds?.includes(currentUserId));
              const hasVoted = Boolean(userVotedOption);

              return (
                <Card key={poll.id} className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge tone="blue">Resident Poll</Badge>
                      {hasVoted && (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={12} /> Vote Recorded
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Expires: Sept 15</span>
                  </div>
                  <h3 className="text-base font-bold">{poll.question}</h3>

                  <div className="space-y-2">
                    {poll.options.map((opt) => {
                      const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                      const isSelected = opt.votedUserIds?.includes(currentUserId);
                      return (
                        <button
                          key={opt.id}
                          disabled={hasVoted}
                          onClick={() => handleVote(poll.id, opt.id)}
                          className={cn(
                            "w-full text-left rx-transition group p-2.5 rounded-lg border",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : hasVoted
                              ? "border-border/60 opacity-80 cursor-default"
                              : "border-border hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5 text-sm font-medium">
                            <span className="flex items-center gap-1.5">
                              {isSelected && <Check size={14} className="text-primary font-bold" />}
                              <span className={isSelected ? "font-bold text-foreground" : "text-foreground"}>
                                {opt.text}
                              </span>
                              {isSelected && (
                                <span className="text-[11px] font-bold text-primary">(Your Vote)</span>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {pct}% ({opt.votes} {opt.votes === 1 ? "vote" : "votes"})
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full rx-transition",
                                isSelected ? "bg-primary" : "bg-primary/70"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {totalVotes} total verified resident votes {hasVoted ? "· 1 vote per resident enforced" : "· Click an option to vote"}
                  </p>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Events ─────────────────────────────────────────────────────── */}
        {activeTab === "events" && (
          <div className="grid gap-4 md:grid-cols-2">
            {eventsList.map((evt) => {
              const isRsvpd = rsvpdEventIds.includes(evt.id);
              return (
                <Card key={evt.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/8 text-primary">
                      <span className="text-xs font-bold uppercase">
                        {evt.eventDate.split(" ")[0]?.substring(0, 3)}
                      </span>
                      <span className="text-lg font-black leading-none">
                        {evt.eventDate.split(" ")[1] || evt.eventDate.split("-")[2] || ""}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold leading-snug">{evt.title}</h3>
                      <p className="mt-0.5 text-xs text-secondary font-semibold">{evt.organizer} · {evt.time}</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">{evt.description}</p>

                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin size={13} />
                      {evt.venue} · {evt.attendeeUserIds.length} Attending
                    </span>
                    <Button
                      size="sm"
                      variant={isRsvpd ? "outline" : "primary"}
                      onClick={() => handleToggleRsvp(evt.id)}
                    >
                      {isRsvpd ? (
                        <>
                          <Check size={14} className="mr-1 text-emerald-600" />
                          RSVP'd
                        </>
                      ) : (
                        "RSVP"
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Lost & Found ──────────────────────────────────────────────── */}
        {activeTab === "lost_found" && (
          <div className="grid gap-4 md:grid-cols-2">
            {lostAndFoundItems.map((lf) => (
              <Card key={lf.id} className="p-4 space-y-3">
                <div className="flex gap-4">
                  {lf.imageUrl && (
                    <img
                      src={lf.imageUrl}
                      alt={lf.title}
                      className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge tone="amber">Found Item</Badge>
                      <span className="text-xs text-muted-foreground">{lf.dateFound}</span>
                    </div>
                    <h3 className="font-bold">{lf.title}</h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={12} />
                      {lf.locationFound}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{lf.description}</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => setClaimingItem(lf)}
                >
                  Claim This Item
                </Button>
              </Card>
            ))}
          </div>
        )}
      </AnimatedSection>

      {/* ── Post Marketplace Listing Modal ───────────────────────────────── */}
      {showListingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-base font-bold">Post Pre-Owned Item</h3>
                <p className="text-xs text-muted-foreground">List an item for sale to society residents</p>
              </div>
              <button
                onClick={() => setShowListingModal(false)}
                className="rounded-md p-1 rx-transition hover:bg-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateListing} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Item Title
                </label>
                <input
                  type="text"
                  required
                  value={listingTitle}
                  onChange={(e) => setListingTitle(e.target.value)}
                  placeholder="e.g. Ergonomic Office Desk Chair"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                    Category
                  </label>
                  <select
                    value={listingCategory}
                    onChange={(e) => setListingCategory(e.target.value as MarketplaceItem["category"])}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="furniture">Furniture</option>
                    <option value="electronics">Electronics</option>
                    <option value="appliances">Appliances</option>
                    <option value="books">Books</option>
                    <option value="vehicles">Vehicles / Cycles</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                    Condition
                  </label>
                  <select
                    value={listingCondition}
                    onChange={(e) => setListingCondition(e.target.value as MarketplaceItem["condition"])}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="like_new">Like New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Asking Price (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)}
                  placeholder="e.g. 2500"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Item Description
                </label>
                <textarea
                  rows={3}
                  value={listingDescription}
                  onChange={(e) => setListingDescription(e.target.value)}
                  placeholder="Provide details on dimensions, age, defects if any, and pickup availability..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Item Photo URL (Optional)
                </label>
                <input
                  type="url"
                  value={listingImageUrl}
                  onChange={(e) => setListingImageUrl(e.target.value)}
                  placeholder="https://... (or leave blank for No Photo state)"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowListingModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Publish Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Contact Seller Modal ─────────────────────────────────────────── */}
      {contactingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-base font-bold">Contact Seller</h3>
                <p className="text-xs text-muted-foreground">{contactingItem.title} · ₹{contactingItem.price.toLocaleString("en-IN")}</p>
              </div>
              <button
                onClick={() => setContactingItem(null)}
                className="rounded-md p-1 rx-transition hover:bg-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendContactMessage} className="p-5 space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">Direct Resident Listing · Verified Society Member</p>
                <p className="text-muted-foreground">Direct resident communication · Messages sent securely via ResolveX Chat</p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Your Message
                </label>
                <textarea
                  rows={3}
                  required
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setContactingItem(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Send Message
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Claim Lost Item Modal ────────────────────────────────────────── */}
      {claimingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-base font-bold">Claim {claimingItem.title}</h3>
                <p className="text-xs text-muted-foreground">Held at Security Gate 1</p>
              </div>
              <button
                onClick={() => setClaimingItem(null)}
                className="rounded-md p-1 rx-transition hover:bg-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleClaimItem} className="p-5 space-y-4">
              <div className="rounded-lg border bg-amber-500/10 text-amber-900 dark:text-amber-300 p-3 text-xs">
                To claim, describe distinguishing characteristics (e.g. keychain markings, lock screen wallpaper, serial numbers).
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Identifying Proof / Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={claimProofNote}
                  onChange={(e) => setClaimProofNote(e.target.value)}
                  placeholder="Describe details not mentioned in the public listing to verify ownership..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setClaimingItem(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Submit Ownership Verification
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
