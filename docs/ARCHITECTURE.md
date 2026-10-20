# ResolveX Architecture

ResolveX is organized as a monorepo with app-specific frontends and shared packages for domain contracts, design helpers, demo data, permission helpers, and AI-ready utilities.

## Core Household Model

The most important relationship is:

`Society -> Tower -> Flat -> Household -> ResidentUser[]`

A flat is the physical unit. A household is the social and permission boundary attached to that flat. Multiple users can belong to the same household with different household roles:

- Owner
- Co-owner
- Family Member
- Tenant
- Relative
- Other Resident

The demo seed shows `Tower A / Flat A-1204` with Rahul Sharma as owner, Priya Sharma as a family member, and Aman Verma as tenant. Minkush Goyal is modeled as a pending family member request for the same household.

## Apps

- `apps/web`: Next.js admin and resident web experience.
- `apps/mobile`: Expo Router resident app with Home, Society, Community, Services, and More tabs.

## Shared Packages

- `packages/types`: strict TypeScript interfaces for every major entity.
- `packages/utils`: demo data, permissions, formatting, and complaint suggestion logic.
- `packages/ui`: shared class merging utility prepared for shadcn-style components.

## Firebase

- Firebase Authentication provides account identity.
- Cloud Firestore stores societies, towers, flats, households, users, complaints, visitors, bills, amenities, notices, posts, documents, services, notifications, and payments.
- Cloud Storage stores complaint proof, documents, avatars, and marketplace images.
- Cloud Functions handle complaint notifications, timeline updates, and scheduled escalations.

## AI-Ready Layer

The local complaint suggestion utility classifies basic complaint text without a paid key. A future provider can swap in an AI-backed implementation when `OPENAI_API_KEY` or another provider key exists.
