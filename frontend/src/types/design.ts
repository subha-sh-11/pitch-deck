export interface ColorToken {
  name: string;
  hex: string;
  usage?: string;
}

export interface TypographyDirection {
  headings: string;
  body: string;
  accents: string;
  treatment: string;
}

export interface DesignDirection {
  mood: string;
  cinematicTone: string;
  palette: ColorToken[];
  typography: TypographyDirection;
  visualStyle: string[];
  backgroundStyle: string;
  imageStyle: string;
  layoutStyle: string;
  rationale: string;
}
