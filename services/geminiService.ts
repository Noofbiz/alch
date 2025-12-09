import { GoogleGenAI, Type } from "@google/genai";
import { AlchemyElement } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function combineElementsWithGemini(
  elementA: AlchemyElement,
  elementB: AlchemyElement
): Promise<AlchemyElement | null> {
  try {
    const prompt = `Combine these two elements into a new single concrete object, concept, or phenomenon: "${elementA.name}" and "${elementB.name}". 
    
    Rules:
    1. Result must be a noun.
    2. Result must be distinct from the inputs if possible, but logical.
    3. If they don't strictly combine physically, use metaphorical or conceptual association.
    4. Provide a relevant emoji.
    5. Keep the name short (1-3 words).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The name of the resulting element (e.g., 'Steam', 'Mud', 'Robot').",
            },
            emoji: {
              type: Type.STRING,
              description: "A single emoji representing the result.",
            },
          },
          required: ["name", "emoji"],
        },
      },
    });

    if (response.text) {
      const result = JSON.parse(response.text) as AlchemyElement;
      // Capitalize first letter of name just in case
      result.name = result.name.charAt(0).toUpperCase() + result.name.slice(1);
      return result;
    }
    
    return null;
  } catch (error) {
    console.error("Error combining elements:", error);
    return null;
  }
}
