
import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { SafetyTip } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // A simple check, though the environment should have it.
  console.error("Gemini API key is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const getSafetyTips = async (): Promise<SafetyTip[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Generate a list of 5 concise safety tips for women. Include self-defense, legal rights, and general awareness.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "The title of the safety tip." },
              content: { type: Type.STRING, description: "The detailed content of the safety tip." },
              category: { type: Type.STRING, description: "Category like 'Self-Defense', 'Legal Rights', 'Awareness'." },
            },
            required: ["title", "content", "category"],
          },
        },
      },
    });

    const jsonString = response.text.trim();
    return JSON.parse(jsonString) as SafetyTip[];
  } catch (error) {
    console.error("Error fetching safety tips:", error);
    return [
      {
        title: "Error",
        content: "Could not fetch safety tips. Please check your connection or API key.",
        category: "System"
      }
    ];
  }
};

export const analyzeSafetyOfArea = async (lat: number, lon: number): Promise<string> => {
    try {
        const prompt = `Based on general safety knowledge, analyze the potential risk of the area at latitude ${lat} and longitude ${lon} at the current time (${new Date().toLocaleTimeString()}). Is this generally considered a safe or potentially unsafe area? Provide a brief, one-sentence explanation. Example: 'This area appears to be a commercial district, which is generally safe during the day but be cautious at night.'`;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing area safety:", error);
        return "Could not analyze area safety at the moment.";
    }
};

export const createChat = (): Chat => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: 'You are "Suraksha Saathi", a friendly and empathetic AI assistant for the Apni Suraksha women safety app. Your role is to provide safety guidance, emotional support, and helpful information like police contact details. Keep your responses concise, clear, and supportive. Prioritize user safety in all interactions.',
        },
    });
};

export const sendMessageToChatbot = async (chat: Chat, message: string): Promise<string> => {
    try {
        const response: GenerateContentResponse = await chat.sendMessage({ message });
        return response.text;
    } catch (error) {
        console.error("Error sending message to chatbot:", error);
        return "I'm sorry, I'm having trouble connecting right now. Please try again later.";
    }
};
