# Pitch Deck — Design Bible

The product doctrine for how decks should look and read. This is the source of truth the
AI agents (`backend/app/ai/agents/*`) and slide templates (`frontend/src/components/slides/*`)
must follow. When you change agent prompts or templates, keep them consistent with this file.

> **North star:** the deck is a *mini movie trailer in slide format* — not a business PPT with
> film images. Every slide is a cinematic frame, still clean enough for a producer to read.

**Design rule:** *Visuals attract. Layout explains. Text convinces.*
Balance three things on every slide:
- **Cinema** — mood, emotion, frames, characters.
- **Clarity** — readable text, simple hierarchy, strong messaging.
- **Pitch value** — why this film, who it's for, why now.

A filmmaker may arrive with only a logline or a full script. The platform must extract the
story, understand the genre, build a visual identity, generate images, choose layouts, and
produce a deck that feels like a professional film pitch — and that makes a filmmaker feel
*"this looks like my film already exists,"* and a producer feel *"I understand the story, the
audience, the tone, and why this can work."*

---

## 1. No fixed template — a Visual Identity Pack per film

This is the most important rule. **Every film must NOT get the same design.** Before deck
generation, the AI decides a complete design system for that one film: color palette, font
style, image style, texture style, layout type, icon style, slide pacing.

Genre steers the register (a starting **prior, not a cage**):

| Film type | Visual style |
|---|---|
| Crime drama | Dark, gritty, textured, narrow typography, shadows |
| Romance | Warm, soft, emotional, airy layouts |
| Comedy | Bright, playful, expressive cards |
| Horror | Minimal, eerie, high contrast, negative space |
| Sports drama | Motion, energy, sweat, arena/court visuals |
| Mythology / fantasy | Grand, ornamental, rich textures |
| Thriller | Sharp layouts, suspenseful spacing, cold palette |

**Do not make everything black.** Use dark when the genre calls for it (crime, thriller,
horror), but give breathing space everywhere, and let warm/feel-good genres (romance, comedy,
sports, family) be warm and bright.

### The Visual Identity Pack (generated from the logline/script)

- **Film mood** — e.g. gritty, emotional, hopeful, chaotic.
- **Color palette** — 5 roles: background, primary text, secondary text, accent, highlight/CTA.
  Name them for the story (e.g. Charcoal Black, Warm White, Muted Grey, Burnt Orange, Dusty Gold).
- **Typography** — exactly 2 fonts: a genre-matched display/title font + a clean readable body.
  (Crime → condensed bold; romance → elegant/soft; comedy → rounded playful; horror → minimal
  sharp; mythology → premium serif / ornamental.)
- **Image style** — cinematic stills, realistic locations, shallow depth, natural light, etc.
- **Texture** — grain, dust, paper, film scratches, concrete (as fits the film).
- **Layout style** — e.g. image-heavy, minimal text, bold section titles.
- **Icon style** — thin-line film/business icons, one accent color, no colorful emojis.

This pack controls the entire deck. Without it, slides feel random.

---

## 2. Layout system — modular template families

Slides come from **template families**, not random designs.

- **Hero poster** (title / opening / closing) — full-screen cinematic image, big title, short
  tagline, minimal metadata, strong center/left alignment. Feels like a film poster.
- **Logline** — large logline text, one strong background image, small genre tags. Simple, powerful.
- **Genre blend** — 3–4 cards, each title + 2-line explanation + small icon, subtle texture.
  This is an *explanation* slide; don't over-visualize it.
- **Synopsis** — structured as a 3-act timeline (Act 1 / Act 2 / Act 3), story flow on the
  left, cinematic image on the right. Easier to read than a paragraph.
- **Story world** — full-image background, floating text panel, 3 keyword chips at the bottom
  (e.g. *Urban chaos · Lower-middle-class spaces · Crime underbelly*). Make the producer feel the world.
- **Character** — strong visual card per character: image, name, role, emotional wound,
  motivation, arc. Main characters get big portrait layouts; supporting get smaller grids.
- **Relationship map** — character cards connected by lines showing emotional/conflict
  relationships (*protects · awakens hope in · hunts · pushes*). Premium-feeling for producers
  and writers.
- **USP** — 5 numbered points, clean, strong contrast, small icons only. Be specific, not generic
  (*"a deaf child at the emotional center of a crime drama"* — not *"unique story"*).
- **Visual aesthetic** — a 6-image moodboard with small labels (Lighting, Camera, Color,
  Locations, Costumes, Texture). No long paragraphs. Where image generation shines.
- **Comparable films** — 3–5 reference cards with poster/image AND an explanation of why it's
  comparable and what we take from it. Never just film names.
- **Audience** — audience segments as cards (age group, platform behavior, emotional appeal).
- **Market / business** — clean, business-style, less cinematic, more clear. Budget range,
  production scale, OTT fit, theatrical possibility, marketing hooks, cast potential. Looks like
  a producer document, not a movie poster.
- **Director's vision** — one powerful image + a personal, human statement (not AI-generic).
- **Closing** — strong final image, film title, one emotional line, contact / next step. Ends
  like a trailer, not a PowerPoint.

---

## 3. Image design rules — generate from a visual bible, not "random cinematic images"

- **Character consistency** — the same character looks the same across slides (age, face,
  costume style, body language, emotional tone).
- **Location consistency** — the world feels connected; render the story's many locations
  (street, house, police station, court, hospital, tea stall, lanes, station, night roads) —
  do not repeat one street visual again and again.
- **Shot variety** — every deck uses different shot types: wide establishing, character close-up,
  over-the-shoulder, action moment, emotional silent moment, conflict scene, object/detail shot,
  final hopeful frame. This is what makes a deck feel like a film.
- **Image purpose** — every image answers *why is this image on this slide?* (logline → hero
  walking alone; character → portrait; crime → danger/location; redemption → emotional connection;
  market → minimal image, more clarity). Images are not decoration.

---

## 4. Icons, typography, color

- **Icons** — thin line, one accent color, no emojis, no SaaS-dashboard overuse. Only on genre
  cards, USP points, audience segments, budget/market, production status, platform fit.
- **Typography** — 2 fonts max; big titles; short paragraphs (3–5 lines per block); avoid tiny
  text; strong contrast; never place important text over a noisy image without an overlay/scrim.
- **Color** — 5 roles (background, primary text, secondary text, accent, highlight). Don't make
  everything black; use dark when needed but give breathing space.

---

## 5. Deck pacing — the slide order should build emotion

```
Title → Logline → Emotional hook → Genre → Synopsis → World → Main characters → Conflict → USP →
Visual aesthetic → Comparable films → Audience → Market potential → Production plan →
Director's vision → Closing ask.
```

This takes a producer from **What is this?** → **Why should I care?** → **Can this be made?** →
**Can this sell?**

---

## 6. Product flow — logline/script → deck

1. **User input** — logline, short idea, synopsis, full script PDF, or treatment.
2. **AI extracts** — title, logline, genre, tone, main & supporting characters, story world,
   synopsis, themes, USP, target audience, comparable films, visual style, market angle.
3. **Story Blueprint** — show a clean, editable summary before generating (AI may misread).
4. **Visual Identity Pack** — theme, colors, fonts, image style, layout style, icon style, moodboard.
5. **Slide outline** — slide names + what each says + what image each needs; user approves/edits.
6. **Generate** — content, layouts, images, icons, design, export.
7. **AI quality review** — text readable? images repeated? story clear? characters consistent?
   producer slides present? spelling? too generic? commercially convincing?
8. **Slide-by-slide regeneration** — *"make this more cinematic / more commercial / less dark /
   change image / improve text / add emotion / more Telugu commercial / more festival cinema."*

---

## 7. Engine model

```
Story Data (from logline/script)
  → Design System (colors, fonts, image style, icons, mood)
  → Slide Templates (prebuilt layouts)
  → Image Prompts (from the visual bible)
  → Renderer (PDF/PPTX)
  → Reviewer (quality check + fixes)
```

The system behaves as: **understand story → create design language → choose templates →
generate images → create slides → review quality → export** — never just *"generate a pitch deck."*

---

## 8. Final bar

Decks should feel **cinematic, readable, story-specific, emotionally strong, producer-friendly,
visually consistent** — not AI-generated, not Canva-like, not generic.
