import type { Deck, DeckOutlineItem } from "@/types/deck";
import type { DesignDirection } from "@/types/design";
import type { Slide } from "@/types/slide";
import type {
  IntakeAnalysis,
  IntakeFormData,
  QualityReview,
  StoryAnalysis,
} from "@/types/workflow";
import { MOCK_PROJECT_ID } from "./mock-projects";

export const mockIntakeDefaults: IntakeFormData = {
  title: "The Tank",
  tagline: "A Devil On The Roof",
  logline:
    "When three mischievous kids are accidentally trapped inside a rooftop water tank that begins filling, their parents search the entire city except the danger directly above them.",
  genreBlend: "Survival Thriller + Suspense Drama + Childhood Comedy",
  tone: "Dark, emotional, claustrophobic, urgent",
  synopsis:
    "Three childhood friends sneak onto a Hyderabad apartment rooftop to play. A prank goes wrong and they become sealed inside the building's water tank as it slowly fills. While the city searches below, the parents confront guilt, fear, and the emotional distance that made them miss what was right above them.",
  storyWorld:
    "A middle-class gated apartment community in Hyderabad where childhood mischief, parental fear, and urban isolation collide.",
  mainCharacters:
    "Potti — fearless leader — Drives the group's courage until survival strips away bravado. Bakki — anxious planner — His caution becomes the group's only logic inside the tank. Laddu — empathetic mediator — Holds the emotional center when fear threatens to split the trio.",
  characterDynamics:
    "Friendship tested under survival pressure while parents mirror the children's fear through control and denial.",
  usp: "Low-budget high-impact contained survival thriller with child protagonists and strong family emotion.",
  showCross: "Fall × Helen × Manjummel Boys, but rooted in a Hyderabad apartment world.",
  targetAudience:
    "18–40 urban Telugu OTT viewers; horror-drama crossover with family appeal.",
  releaseFit: "OTT-first with festival potential; contained single-location production.",
  visualAesthetic:
    "Dark concrete, water reflections, moss green, rust stains, thin beams of light, claustrophobic framing.",
  colorPalette: "Deep black, concrete grey, moss green, rust brown, pale water blue, ice highlight",
  textureStyle: "Textured concrete, water stains, dark gradients, subtle film grain",
  designDirection:
    "Premium survival thriller deck with full-bleed imagery, dark textured backgrounds, minimal typography, and high tension.",
  themes: "Survival, family guilt, friendship, parental fear",
  keyScenes:
    "Rooftop mischief · Tank sealed · Parents search the city · Emotional reunion",
  visualMood: "Dark concrete, water reflections, claustrophobic framing, urgent tone",
};

export const mockIntakeAnalysis: IntakeAnalysis = {
  completenessScore: 72,
  detectedSignals: [
    { label: "Project Type", value: "Feature Film" },
    { label: "Pitch Purpose", value: "Investor Pitch" },
    { label: "Story Stage", value: "Synopsis Ready" },
    {
      label: "Genre DNA",
      value: "Survival Thriller, Suspense Drama, Childhood Comedy",
    },
    { label: "Tone", value: "Dark, emotional, claustrophobic, urgent" },
  ],
  missingDetails: [
    "Budget range",
    "Director's personal vision",
    "Production status",
    "Visual references",
    "Target release format",
  ],
  followUpQuestions: [
    {
      question:
        "What is the strongest emotional promise of this story?",
      placeholder:
        "Survival tension that resolves into family reconciliation...",
    },
    {
      question:
        "Should the deck reveal the climax or preserve it as a mystery?",
      placeholder: "Preserve mystery until the final slides...",
    },
    {
      question:
        "What budget range should the deck position this project within?",
      placeholder: "₹8–15 crore contained thriller range...",
    },
    {
      question:
        "What visual references should influence the deck's tone?",
      placeholder: "Fall, Helen, Manjummel Boys, rooftop isolation...",
    },
    {
      question:
        "What is the primary pitch goal: investor confidence, OTT interest, or producer attachment?",
      placeholder: "Investor confidence with OTT upside...",
    },
  ],
};

export const mockStoryAnalysis: StoryAnalysis = {
  coreTheme:
    "Friendship, fear, parental guilt, survival, and emotional reconciliation.",
  emotionalCore:
    "Children fighting for survival while parents confront the consequences of fear, control, and emotional distance.",
  genreDna: [
    "Survival Thriller",
    "Suspense Drama",
    "Childhood Comedy",
    "Family Emotion",
  ],
  storyWorld:
    "A Hyderabad gated apartment community where the rooftop water tank becomes a silent villain.",
  commercialAngle:
    "A contained, low-budget, high-impact thriller with strong emotional payoff and OTT-friendly tension.",
  audiencePromise:
    "A tense survival experience that begins with childhood mischief and ends with a deeply emotional family payoff.",
  visualWorld:
    "Concrete textures, rust, water stains, darkness, moss green, rooftop isolation, and narrow beams of light.",
  pitchPositioning:
    "Fall meets Helen with the emotional friendship and survival intensity of Manjummel Boys, rooted in a Telugu urban family world.",
};

export const mockOutline: DeckOutlineItem[] = [
  { slideNumber: 1, title: "Cover", purpose: "Establish title, tone, and first cinematic impression.", required: true, slideType: "cover" },
  { slideNumber: 2, title: "Logline", purpose: "Communicate the story hook in one powerful sentence.", required: true, slideType: "logline" },
  { slideNumber: 3, title: "Genre Blend", purpose: "Position the film's tonal and commercial identity.", required: true, slideType: "genre_blend" },
  { slideNumber: 4, title: "Synopsis", purpose: "Present the story journey clearly and emotionally.", required: true, slideType: "synopsis" },
  { slideNumber: 5, title: "Story World", purpose: "Build the setting, atmosphere, and narrative environment.", required: true, slideType: "story_world" },
  { slideNumber: 6, title: "Main Characters", purpose: "Introduce the key emotional drivers of the story.", required: true, slideType: "character" },
  { slideNumber: 7, title: "Supporting Characters", purpose: "Show the wider human world of the film.", required: false, slideType: "supporting_characters" },
  { slideNumber: 8, title: "Unique Selling Points", purpose: "Explain why the project is fresh, urgent, and producible.", required: true, slideType: "usp" },
  { slideNumber: 9, title: "Show Cross", purpose: "Position the project using comparable films and series.", required: true, slideType: "show_cross" },
  { slideNumber: 10, title: "Visual Aesthetic", purpose: "Define mood, color, texture, and cinematic language.", required: true, slideType: "visual_aesthetic" },
  { slideNumber: 11, title: "Target Audience", purpose: "Show who the project is built for and why they will connect.", required: true, slideType: "target_audience" },
  { slideNumber: 12, title: "Budget & Production Scale", purpose: "Communicate feasibility and production logic.", required: true, slideType: "budget" },
  { slideNumber: 13, title: "Market Potential", purpose: "Explain OTT, theatrical, regional, or wider commercial potential.", required: true, slideType: "market_potential" },
  { slideNumber: 14, title: "Director's Vision", purpose: "Present the filmmaker's emotional and creative intent.", required: true, slideType: "directors_vision" },
  { slideNumber: 15, title: "Team & Production Status", purpose: "Show attached talent, stage, and current readiness.", required: false, slideType: "team" },
  { slideNumber: 16, title: "Contact", purpose: "End with clear next-step communication.", required: true, slideType: "contact" },
];

export const mockDesignDirection: DesignDirection = {
  mood: "Dark survival thriller",
  cinematicTone: "Claustrophobic, emotional, urgent, grounded, tense",
  palette: [
    { name: "Deep Black", hex: "#050505" },
    { name: "Concrete Grey", hex: "#2A2A2A" },
    { name: "Moss Green", hex: "#3F5F4A" },
    { name: "Rust Brown", hex: "#8A4B2A" },
    { name: "Pale Water Blue", hex: "#A9C6C7" },
    { name: "Ice Highlight", hex: "#67e8f9" },
  ],
  typography: {
    headings: "Condensed bold cinematic headings",
    body: "Clean readable body text",
    accents: "Minimal uppercase section titles",
    treatment: "High contrast title treatment",
  },
  visualStyle: [
    "Rooftop isolation",
    "Concrete tank textures",
    "Rust marks",
    "Water reflections",
    "Claustrophobic cropping",
    "Thin beams of light",
    "Dark negative space",
  ],
  backgroundStyle:
    "Textured concrete, water stains, dark gradients, subtle film grain",
  imageStyle:
    "Cinematic full-bleed frames, realistic lighting, high tension, minimal clutter",
  layoutStyle:
    "Poster-like cover slides, split image/text story slides, grid-based USP slides, character cards, moodboard-heavy visual slides",
  rationale:
    "The deck should make the water tank feel like a silent villain. The visual system uses concrete, darkness, water, and restricted light to create urgency while preserving emotional warmth for family-driven slides.",
};

const TANK_IMAGE_PROMPT =
  "A dark cinematic rooftop water tank, concrete texture, moss green stains, rust edges, water reflection, thin beam of light, survival thriller mood.";

export const mockSlides: Slide[] = [
  {
    id: "slide-cover",
    slideNumber: 1,
    slideType: "cover",
    title: "Cover",
    purpose: "Establish title, tone, and first cinematic impression.",
    content: {
      heading: "THE TANK",
      subheading: "A Devil On The Roof",
      body: "A contained Telugu survival thriller about childhood friendship, parental fear, and a rooftop danger hiding in plain sight.",
      footer: "Written & Directed by Ashok Ram",
    },
    layout: { template: "cover", layoutType: "cinematic_cover" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
    aiRationale: "Strong cinematic title treatment with immediate genre signal.",
  },
  {
    id: "slide-logline",
    slideNumber: 2,
    slideType: "logline",
    title: "Logline",
    purpose: "Communicate the story hook in one powerful sentence.",
    content: {
      heading: "Logline",
      body: "Three mischievous kids are accidentally sealed inside a rooftop water tank that begins filling with water, while their desperate parents search the entire city except the danger directly above them.",
    },
    layout: { template: "logline", layoutType: "centered_statement" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
    aiRationale: "Hook is visual, urgent, and immediately producible.",
  },
  {
    id: "slide-3",
    slideNumber: 3,
    slideType: "genre_blend",
    title: "Genre Blend",
    purpose: "Position tonal and commercial identity.",
    content: {
      heading: "Genre Blend",
      items: [
        { title: "Survival Thriller", description: "A race against rising water and disappearing air." },
        { title: "Suspense Drama", description: "Parents search helplessly while the truth stays above them." },
        { title: "Childhood Comedy", description: "Mischief, friendship, and innocence make the danger hit harder." },
      ],
    },
    layout: { template: "genre_blend", layoutType: "three_column" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
  },
  {
    id: "slide-synopsis",
    slideNumber: 4,
    slideType: "synopsis",
    title: "Synopsis",
    purpose: "Present the story journey clearly and emotionally.",
    content: {
      heading: "Synopsis",
      body: "Three childhood friends sneak onto a Hyderabad apartment rooftop to play. A prank goes wrong and they become sealed inside the building's water tank as it slowly fills.\n\nWhile the city searches below, the parents confront guilt, fear, and the emotional distance that made them miss what was right above them.\n\nThe tank becomes a silent villain — and survival becomes the language of reconciliation.",
    },
    layout: { template: "synopsis", layoutType: "split_image_text" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
    aiRationale: "Consider tightening Act 2 for pitch readability.",
  },
  {
    id: "slide-story-world",
    slideNumber: 5,
    slideType: "story_world",
    title: "Story World",
    purpose: "Build setting and atmosphere.",
    content: {
      heading: "Story World",
      body: "A middle-class gated apartment community in Hyderabad — childhood mischief, parental fear, and urban isolation collide.",
      items: [
        { title: "Rooftop Water Tank", description: "The silent villain above the city" },
        { title: "Apartment Corridors", description: "Claustrophobic urban maze" },
        { title: "Family Homes", description: "Emotional anchor and guilt" },
        { title: "City Search", description: "Desperate scale, wrong direction" },
      ],
    },
    layout: { template: "story_world", layoutType: "location_grid" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
  },
  {
    id: "slide-characters",
    slideNumber: 6,
    slideType: "character",
    title: "Main Characters",
    purpose: "Introduce key emotional drivers.",
    content: {
      heading: "Main Characters",
      characters: [
        { name: "Potti", role: "Fearless Leader", description: "Drives the group's courage until survival strips away bravado.", wound: "Cannot admit fear" },
        { name: "Bakki", role: "Anxious Planner", description: "His caution becomes the group's only logic inside the tank.", wound: "Paralyzed by what-ifs" },
        { name: "Laddu", role: "Empathetic Mediator", description: "Holds the emotional center when fear threatens to split the trio.", wound: "Carries everyone's pain" },
      ],
    },
    layout: { template: "character", layoutType: "character_cards" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
  },
  {
    id: "slide-7",
    slideNumber: 7,
    slideType: "supporting_characters",
    title: "Supporting Characters",
    purpose: "Show the wider human world.",
    content: {
      heading: "Supporting Characters",
      characters: [
        { name: "Parents", role: "Emotional Anchor", description: "Their search mirrors the children's survival — guilt and love in parallel." },
        { name: "Building Security", role: "Obstacle", description: "Represents systemic blindness to danger in plain sight." },
      ],
    },
    layout: { template: "character", layoutType: "character_cards" },
    status: "draft",
  },
  {
    id: "slide-8",
    slideNumber: 8,
    slideType: "usp",
    title: "Unique Selling Points",
    purpose: "Explain freshness and producibility.",
    content: {
      heading: "USP",
      bullets: [
        "Simple universal emotional hook",
        "Low-budget high-impact contained thriller",
        "Child heroes with immediate audience empathy",
        "Strong family emotional payoff",
        "OTT-friendly survival tension",
      ],
    },
    layout: { template: "usp", layoutType: "grid" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
  },
  {
    id: "slide-show-cross",
    slideNumber: 9,
    slideType: "show_cross",
    title: "Show Cross",
    purpose: "Position with comparable films.",
    content: {
      heading: "Show Cross",
      body: "Fall meets Helen with the emotional survival intensity of Manjummel Boys.",
      comps: [
        { title: "Fall", note: "Vertigo dread and contained height tension." },
        { title: "Helen", note: "Parental search drama with ticking urgency." },
        { title: "Manjummel Boys", note: "Friendship under survival pressure." },
      ],
    },
    layout: { template: "show_cross", layoutType: "comp_cards" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
  },
  {
    id: "slide-visual",
    slideNumber: 10,
    slideType: "visual_aesthetic",
    title: "Visual Aesthetic",
    purpose: "Define mood and cinematic language.",
    content: {
      heading: "Visual Aesthetic",
      body: "Dark concrete, water reflections, moss green, rust stains, thin beams of light, claustrophobic framing.",
      moodBlocks: [
        { label: "Concrete", color: "#2A2A2A" },
        { label: "Water", color: "#A9C6C7" },
        { label: "Rust", color: "#8A4B2A" },
        { label: "Moss Green", color: "#3F5F4A" },
        { label: "Narrow Light", color: "#67e8f9" },
        { label: "Rooftop Isolation", color: "#1a1a1f" },
      ],
    },
    layout: { template: "visual_aesthetic", layoutType: "moodboard" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
  },
  {
    id: "slide-audience",
    slideNumber: 11,
    slideType: "target_audience",
    title: "Target Audience",
    purpose: "Show who will connect.",
    content: {
      heading: "Target Audience",
      items: [
        { title: "Family Audience", description: "Emotional payoff with universal parental stakes" },
        { title: "Thriller Viewers", description: "Contained survival tension with escalating dread" },
        { title: "Telugu Urban Viewers", description: "Hyderabad apartment world with regional authenticity" },
        { title: "OTT Survival Drama", description: "Bingeable tension with strong emotional resolution" },
      ],
    },
    layout: { template: "target_audience", layoutType: "segments" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
  },
  {
    id: "slide-12",
    slideNumber: 12,
    slideType: "budget",
    title: "Budget & Production Scale",
    purpose: "Communicate feasibility.",
    content: {
      heading: "Budget & Production Scale",
      body: "Estimated range: ₹8–15 crore. Single primary location (apartment + rooftop tank). 45–55 shooting days. Contained cast with child leads and strong VFX for water sequences.",
      bullets: ["Single-location production", "Limited night exteriors", "Modular tank set build"],
    },
    layout: { template: "generic", layoutType: "text_led" },
    status: "needs_review",
    aiRationale: "Add approximate production range and feasibility points.",
  },
  {
    id: "slide-13",
    slideNumber: 13,
    slideType: "market_potential",
    title: "Market Potential",
    purpose: "Explain commercial upside.",
    content: {
      heading: "Market Potential",
      items: [
        { title: "Contained production scale", description: "Single-location build with strong ROI positioning" },
        { title: "OTT-friendly tension", description: "Bingeable survival arc with emotional climax" },
        { title: "Strong emotional payoff", description: "Family reconciliation drives word-of-mouth" },
        { title: "Regional authenticity", description: "Telugu urban world with pan-India subtitle appeal" },
      ],
    },
    layout: { template: "market_potential", layoutType: "investor_cards" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
  },
  {
    id: "slide-14",
    slideNumber: 14,
    slideType: "directors_vision",
    title: "Director's Vision",
    purpose: "Present creative intent.",
    content: {
      heading: "Director's Vision",
      body: "The tank is not just a location — it is the film's silent antagonist. Every frame should make the audience feel water rising and time running out, while never losing the warmth of childhood friendship.",
    },
    layout: { template: "generic", layoutType: "quote" },
    status: "approved",
  },
  {
    id: "slide-15",
    slideNumber: 15,
    slideType: "team",
    title: "Team & Production Status",
    purpose: "Show readiness.",
    content: {
      heading: "Team & Production Status",
      body: "Development stage. Director attached. Screenplay draft complete. Seeking producing partner and lead cast attachments.",
    },
    layout: { template: "generic", layoutType: "text_led" },
    status: "draft",
  },
  {
    id: "slide-16",
    slideNumber: 16,
    slideType: "contact",
    title: "Contact",
    purpose: "Clear next steps.",
    content: {
      heading: "Let's Talk",
      subheading: "The Tank — Feature Film Pitch Deck",
      body: "director@thetankfilm.com · +91 98765 43210",
      footer: "Let's bring this story to screen.",
    },
    layout: { template: "contact", layoutType: "minimal" },
    status: "design_generated",
    imagePrompt: TANK_IMAGE_PROMPT,
  },
];

export const mockQualityReview: QualityReview = {
  overallReadiness: 86,
  contentClarity: 88,
  visualConsistency: 91,
  investorReadiness: 78,
  exportReadiness: 84,
  findings: [
    { slideTitle: "Logline", status: "strong", suggestion: "The hook is clear and immediately visual." },
    { slideTitle: "Synopsis", status: "needs_work", suggestion: "Reduce text density for better pitch readability." },
    { slideTitle: "USP", status: "strong", suggestion: "Low-budget high-impact angle is clear." },
    { slideTitle: "Budget", status: "needs_detail", suggestion: "Add approximate production range and feasibility points." },
    { slideTitle: "Visual Aesthetic", status: "strong", suggestion: "The concrete/water design system is consistent." },
  ],
};

export const mockDeck: Deck = {
  id: "deck-mock",
  projectId: MOCK_PROJECT_ID,
  slideCount: 16,
  status: "ready",
  slides: mockSlides,
  designDirection: mockDesignDirection,
};

export const mockExportHistory = [
  "The_Tank_Pitch_Deck_v1.pdf",
  "The_Tank_Pitch_Deck_v1.pptx",
];
