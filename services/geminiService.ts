import { GoogleGenAI, Type } from "@google/genai";
import { ThemeResponseSchema, ThemeResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateThemeFromImage = async (base64Image: string): Promise<ThemeResponse> => {
  try {
    // Strip header if present
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "Analyze this environment. I am projecting an Augmented Reality liquid layer over this camera feed. Create a physics theme that blends with this reality. If the room is dark/neon, maybe 'Cyber Punk Slime' (high shimmer). If it's a bright nature scene, 'Clear Spring Water'. \n\nOutput a JSON theme where 'baseColor' is a subtle tint for the liquid and 'highlightColor' is the specular reflection."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: ThemeResponseSchema,
        systemInstruction: "You are a VFX supervisor for an AR installation. You design sophisticated fluid simulations that distort and enhance reality.",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as ThemeResponse;
  } catch (error) {
    console.error("Gemini Theme Generation Error:", error);
    throw error;
  }
};