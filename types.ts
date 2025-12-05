import { Type } from "@google/genai";

export interface RippleConfig {
  damping: number;
  shimmer: number;
  baseColor: string;
  highlightColor: string;
  backgroundType: 'solid' | 'gradient';
  label: string;
}

export const DEFAULT_CONFIG: RippleConfig = {
  damping: 0.96,
  shimmer: 5,
  baseColor: '#000000',
  highlightColor: '#00d2ff',
  backgroundType: 'solid',
  label: 'Deep Water'
};

// Schema for Gemini JSON response
export const ThemeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING, description: "A creative name for the fluid theme (e.g., Molten Lava, Ectoplasm)." },
    baseColor: { type: Type.STRING, description: "Hex color code for the deep fluid color." },
    highlightColor: { type: Type.STRING, description: "Hex color code for the light reflection/highlight." },
    damping: { type: Type.NUMBER, description: "Fluid viscosity/damping factor between 0.85 (thick) and 0.99 (very thin)." },
    shimmer: { type: Type.NUMBER, description: "Refraction intensity between 1 and 20." },
    description: { type: Type.STRING, description: "Short description of why this theme matches the image." },
  },
  required: ["label", "baseColor", "highlightColor", "damping", "shimmer", "description"],
};

export interface ThemeResponse {
  label: string;
  baseColor: string;
  highlightColor: string;
  damping: number;
  shimmer: number;
  description: string;
}
