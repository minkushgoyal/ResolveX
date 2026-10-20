# ResolveX

Smart Society & Community Management Platform

**Everything Your Community Needs. In One Place.**

ResolveX is a production-oriented monorepo for a resident mobile app and web admin dashboard covering complaints, households, visitors, bills, amenities, notices, community posts, services, notifications, emergency flows, and AI-ready complaint assistance.

## Structure

```text
apps/
  web/       Next.js, TypeScript, Tailwind, Framer Motion, Recharts
  mobile/    Expo React Native, TypeScript, Expo Router
packages/
  types/     Shared TypeScript domain interfaces
  utils/     Demo data, permissions, formatting, AI-ready helpers
  ui/        Shared UI helpers
firebase/
  functions/ Cloud Functions for notifications and escalation
  firestore.rules
  firestore.indexes.json
docs/
```

## Setup

```bash
npm install
npm run dev:web
```

Run the mobile app:

```bash
npm run dev:mobile
```

Preview the seed payload:

```bash
npm run seed:preview
```

## Firebase

1. Create a Firebase project.
2. Enable Authentication providers: email/password, phone OTP, and Google as needed.
3. Create a Firestore database.
4. Create a Storage bucket.
5. Copy `.env.example` to `.env.local` and fill Firebase client values.
6. Deploy rules and indexes from the `firebase` folder.
7. Deploy functions from `firebase/functions` when Firebase CLI is configured.

## Multiple Residents Per Flat

ResolveX uses this model:

`Society -> Tower -> Flat -> Household -> Multiple Resident Users`

The flat represents the physical unit. The household represents the membership and permission boundary. A single flat can have an owner, co-owner, spouse, children, parent, tenant, relative, or other resident, each with their own account and verification status.

Demo society: **Ajanta Gen-X**

Demo household: **Tower A / Flat A-1204**

- Rahul Sharma: Owner
- Priya Sharma: Family Member
- Aman Verma: Tenant
- Minkush Goyal: Pending family member request

## Current App Surfaces

- Resident home dashboard
- My Household
- Complaint creation with local AI-ready suggestions
- Complaint timeline and escalation history
- Admin dashboard with Recharts analytics
- Resident and household management
- Community feed and composer
- Services, amenities, emergency, bills, and mock payment surfaces
- Expo mobile app with Home, Society, Community, Services, and More tabs

## Environment Variables

See `.env.example` for Firebase, Expo, optional AI provider, and payment provider variables.
