---
name: Training tracker spec constraints
description: Non-negotiable product rules and phased delivery plan for the Distributed Training Tracker Expo app
---

Source spec: attached_assets/Pasted--Distributed-Training-Tracker-Build-Prompt-Version-V202_1787611977807.txt (V20260824E).

**Phased delivery (user-mandated):** Phase 1 = logging only (movements, set logging, today view, CSV export) — built. User wants to use it for a week before phase 2. Phase 2+ = local notifications (queue of one-off triggers, max 64, no repeating triggers, rebuild only on current-time log or app open — NOT on backdated edits), heavy-session toggle, benchmarks, the two targets, and the seven reports.

**Data rules (user's, not changeable):** set is the atomic unit (no sessions table; heavy sessions derived from runs of `heavy` sets within 90 min); full datetime on every set; RIR 0–4 required (4 = "4 or more"); flag timestamp-edited sets (notification logic depends on it); every movement has exactly one of six fixed patterns, each with a fixed color (constants/patterns.ts); compound movements only, variation lives in the movement name — no variation/depth/style field.

**Do not build:** streaks/XP/badges, exercise library, programs/coaching, isolation categories, general goal system, accounts/sync, start-stop workout as primary flow, repeating notification triggers.
