---
version: alpha
name: Blend
description: A calm, borderless design system for interfaces that feel blended into life—soft elevation, warm neutrals, and slow motion.
colors:
  canvas: "#fafaf9"
  canvas-dark: "#1c1917"
  surface: "#f5f5f4"
  surface-dark: "#292524"
  surface-raised: "#ffffff"
  surface-raised-dark: "#322f2c"
  surface-sunken: "#f0f0ef"
  surface-sunken-dark: "#1c1917"
  on-surface: "#292524"
  on-surface-dark: "#e7e5e4"
  on-surface-muted: "#78716c"
  on-surface-muted-dark: "#a8a29e"
  on-surface-subtle: "#a8a29e"
  on-surface-subtle-dark: "#78716c"
  accent: "#57534e"
  accent-dark: "#d6d3d1"
  accent-hover: "#44403c"
  accent-hover-dark: "#e7e5e4"
typography:
  headline-lg:
    fontFamily: Crimson Pro
    fontSize: 2.5rem
    fontWeight: 300
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Crimson Pro
    fontSize: 1.875rem
    fontWeight: 300
    lineHeight: 1.3
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Crimson Pro
    fontSize: 1.25rem
    fontWeight: 300
    lineHeight: 1.4
    letterSpacing: -0.02em
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: 300
    lineHeight: 1.7
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 300
    lineHeight: 1.6
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: 6px
  md: 8px
  lg: 12px
spacing:
  1: 0.25rem
  2: 0.5rem
  3: 0.75rem
  4: 1rem
  6: 1.5rem
  8: 2rem
  12: 3rem
  16: 4rem
  container-max: 900px
  container-padding-x: 1.5rem
  container-padding-y: 4rem
components:
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 12px
    typography: "{typography.label-md}"
  button-default-hover:
    backgroundColor: "{colors.surface-raised}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
    padding: 12px
    typography: "{typography.label-md}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.lg}"
    padding: 32px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 12px
    typography: "{typography.body-md}"
  input-hover:
    backgroundColor: "{colors.surface-raised}"
  input-focus:
    backgroundColor: "{colors.surface-raised}"
  badge:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-muted}"
    rounded: "{rounded.sm}"
    padding: 8px
    typography: "{typography.label-sm}"
---

# Blend

## Overview

Blend is a design system for products where technology is meant to **blend into life** rather than announce itself. The personality is quiet, warm, and confident: generous space, light typographic color, and motion that feels meditative rather than energetic.

The audience is people using thoughtful, text- and task-heavy interfaces who benefit from reduced visual noise—especially alongside AI-assisted flows where clarity and calm help build trust.

Emotionally, Blend should feel **soft, continuous, and breathable**. Prefer tonal layers and motion over chrome; let content and user intent lead.

Core principles:

- **Softness over hardness** — curves, gentle shadows, no harsh outlines as a default language.
- **Elevation over separation** — hierarchy comes from surface shifts and depth, not boxes drawn with borders.
- **Subtlety over boldness** — a restrained warm-neutral palette and barely-there shadows keep focus on meaning.

## Colors

The palette is built on **warm stone neutrals** (light) and **warm charcoal** (dark), with a single **accent** used for emphasis and primary actions—not for decoration everywhere.

Light mode anchors:

- **Canvas (#fafaf9):** Page backdrop; the quiet field everything sits on.
- **Surface (#f5f5f4):** Default elevated plane for controls and grouping.
- **Surface raised (#ffffff):** Cards, inputs at rest, and moments that need the clearest read against the canvas.
- **Surface sunken (#f0f0ef):** Recessed areas when you need a subtle “inset” read without a border.
- **On surface (#292524):** Primary text; **on surface muted (#78716c)** for secondary; **on surface subtle (#a8a29e)** for tertiary and placeholders.
- **Accent (#57534e):** Primary actions and strong emphasis; **accent hover (#44403c)** deepens on interaction.

Dark mode mirrors the same roles: **canvas-dark (#1c1917)**, **surface-dark (#292524)**, **surface raised dark (#322f2c)**, **on surface dark (#e7e5e4)** with muted and subtle steps inverted for contrast. **Accent dark (#d6d3d1)** and **accent hover dark (#e7e5e4)** stay soft—never neon.

Focus and “glow” treatments in implementation often use **low-alpha tints** of the accent over the raised surface (not all of those are expressible as single `#RRGGBB` swatches); keep them soft and large-radius so they read as atmosphere, not rings of chrome.

## Typography

Two families split roles: **Crimson Pro** for headings and narrative display, **IBM Plex Sans** for UI and body.

- **Headlines (Crimson Pro, light weight):** Editorial calm; use **headline-lg** for page titles, **headline-md** for section titles, **headline-sm** for card titles. Tighten tracking slightly (**-0.02em**) for large sizes.
- **Body (IBM Plex Sans, 300):** Default reading and descriptions at **body-md**; **body-sm** for captions and supporting lines.
- **Labels (IBM Plex Sans, 400):** Buttons, badges, and compact UI chrome at **label-md** or **label-sm**.

Avoid introducing extra weights on a single screen beyond this light / regular pairing unless there is a strong accessibility reason.

## Layout

Blend favors a **narrow, reading-width content column** with **generous vertical rhythm**. A typical documentation or product layout uses a **max width around 900px**, centered, with **horizontal padding** in the **6** spacing step and **vertical padding** in the **16** step so the canvas can breathe.

Spacing follows a **modular rem scale** (see tokens **1** through **16**): small increments for internal control padding, larger steps for section breaks and card gutters. When in doubt, add space—density should feel intentional, not accidental.

## Elevation & Depth

Depth is **tonal first**: canvas → surface → raised creates hierarchy without outlines. **Shadows stay extremely soft** in light mode (low-opacity black, small blur) so layers feel like paper lifting slightly, not Material-style spotlights. In dark mode, shadows become slightly more pronounced so separation remains perceptible against deep backgrounds.

**Dividers** should read as **gradual fades or background shifts**, not 1px rules. If a gradient divider is used, keep contrast in the **barely visible** range and reserve hard edges for rare structural needs.

## Shapes

Corners are **consistently rounded** at three levels: **sm (6px)** for pills and compact controls, **md (8px)** for buttons and inputs, **lg (12px)** for cards and panels. Do not mix sharp rectangular tiles with rounded cards in the same view unless the sharper element is a deliberate exception (for example, full-bleed media).

## Components

**Buttons:** Default buttons sit on **surface** with **sm** shadow; hover lifts slightly (**translateY(-1px)**) and moves to **surface raised** with a **md** shadow. Primary buttons use **accent** fill and **surface raised** text color; hover uses **accent hover** and a **lg** shadow. Focus uses a **soft outer glow** derived from the accent tint, not a harsh outline.

**Cards:** **Surface raised** background, **lg** radius, **md** shadow at rest; hover increases shadow and lift (**translateY(-2px)**) in line with the global transition timing.

**Inputs:** Start on **surface** with **sm** shadow; hover and focus move to **surface raised**; focus adds the same **accent-tint glow** as buttons. No border as the default affordance—depth and background carry the field.

**Badges:** Compact, **sm** radius, **accent subtle**-style background in implementation (often a low-opacity tint); text uses **on surface muted**.

**Icons (guidance):** Prefer **stroke** icons at light weights, **rounded** caps and joins, colored like **on surface muted** unless the icon is the primary action.

## Do's and Don'ts

- Do use **surface stacking** (canvas / surface / raised) before reaching for borders.
- Do keep shadows **low contrast** in light mode and adjust slightly upward in dark mode so layers remain visible.
- Do use **accent** for the single strongest call to action per region, not for every link.
- Do animate interactions with **slow, smooth easing** (for example ~0.4s cubic-bezier) so motion feels calm.
- Don't rely on **1px borders** as the default separator; they break the blended language.
- Don't combine **many font weights** on one screen; stay within the defined light / regular rhythm.
- Don't use **sharp corners** alongside the default **rounded** language without a clear reason.
- Don't exceed **WCAG AA** contrast for text without checking pairs—especially muted text on **surface** and **surface raised**.

---

This document follows the [DESIGN.md format](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md) (YAML design tokens plus structured sections). Token names in front matter are the normative values; prose explains how to apply them across light and dark themes.
