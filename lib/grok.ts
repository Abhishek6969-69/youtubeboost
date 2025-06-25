// app/lib/grok.ts
import { z } from "zod";
import Groq from "groq-sdk";
import { setTimeout } from "timers/promises";

const TEMPLATE = `
INSTRUCTIONS: Based on the provided context, generate a YouTube video title, description, and hashtags.
Context: {context}
- Generate a catchy, SEO-friendly title (max 100 characters).
- Generate a description (max 500 characters) with keywords and a call-to-action.
- Generate 3-5 relevant hashtags.
- - "category": One word or phrase indicating the video category (e.g. "Travel", "Technology", "Education")
Output format:
{
  "title": "<title>",
  "description": "<description>",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "category":"<category>"
}
`;

const metadataSchema = z.object({
  title: z.string().max(100),
  description: z.string().max(500),
  hashtags: z.array(z.string()).min(3).max(5),
  category:z.string().max(50).optional()
});

export async function createChatCompletion({
  model,
  messages,
  temperature = 0.7,
  max_tokens = 4000,
}: {
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
  max_tokens?: number;
}) {
  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY!,
    });

    const result = await groq.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
    });

    return result;
  } catch (error: any) {
    console.error("Error in createChatCompletion:", error);
    throw new Error(`Failed to create chat completion: ${error.message}`);
  }
}

export async function generateMetadata(context: string) {
  try {
    const model = process.env.GROQ_MODEL || "llama3-8b-8192";
    const prompt = TEMPLATE.replace("{context}", context);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await createChatCompletion({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 4000,
        });

        const responseText = result.choices[0].message.content;
        if (!responseText) {
          throw new Error("Groq response content is null or undefined");
        }

        console.log("Groq raw response:", responseText);

        let jsonString = responseText.replace(/```json\n|\n```/g, "").trim();
        const jsonMatch = jsonString.match(/{[\s\S]*}/);
        if (!jsonMatch) {
          throw new Error("No valid JSON object found in response");
        }
        jsonString = jsonMatch[0];

        let metadata;
        try {
          metadata = JSON.parse(jsonString);
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          throw new Error(`Failed to parse JSON: ${jsonString}`);
        }

        return metadataSchema.parse(metadata);
      } catch (error: any) {
        console.warn(`Retry attempt ${attempt} failed: ${error.message}`);
        if (attempt === 3 || (error.status && error.status !== 429)) {
          throw error;
        }
        await setTimeout(1000 * attempt);
      }
    }

    throw new Error("Failed to generate metadata after retries");
  } catch (error: any) {
    console.error("Error generating metadata with Groq:", error);
    throw new Error(`Failed to generate metadata: ${error.message}`);
  }
}