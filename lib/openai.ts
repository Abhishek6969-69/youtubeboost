import { z } from "zod";
import Groq from "groq-sdk";
import { setTimeout } from "timers/promises";

const TEMPLATE = `
INSTRUCTIONS: Based on the provided context, generate a YouTube video title, description, and hashtags.
Context: {context}
- Generate a catchy, SEO-friendly title (max 100 characters).
- Generate a description (max 500 characters) with keywords and a call-to-action.
- Generate 3-5 relevant hashtags.
Output format:
{
  "title": "<title>",
  "description": "<description>",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}
`;

const metadataSchema = z.object({
  title: z.string().max(100),
  description: z.string().max(500),
  hashtags: z.array(z.string()).min(3).max(5),
});

export async function generateMetadata(context: string) {
  try {
    // Initialize Groq API
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY!,
    });

    // Use a valid model (fallback to a known model if not specified)
    const model = process.env.GROQ_MODEL || "llama3-8b-8192";

    // Format prompt with context
    const prompt = TEMPLATE.replace("{context}", context);

    // Generate content with retry logic
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await groq.chat.completions.create({
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        });

        const responseText = result.choices[0].message.content;
        if (!responseText) {
          throw new Error("Groq response content is null or undefined");
        }

        // Log raw response for debugging
        console.log("Groq raw response:", responseText);

        // Extract JSON from response (handle extra text)
        let jsonString = responseText;
        // Remove markdown code fences
        jsonString = jsonString.replace(/```json\n|\n```/g, "").trim();
        // Extract JSON object between { and }
        const jsonMatch = jsonString.match(/{[\s\S]*}/);
        if (!jsonMatch) {
          throw new Error("No valid JSON object found in response");
        }
        jsonString = jsonMatch[0];

        // Parse JSON response
        let metadata;
        try {
          metadata = JSON.parse(jsonString);
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          throw new Error(`Failed to parse JSON: ${jsonString}`);
        }

        // Validate output structure
        return metadataSchema.parse(metadata);
      } catch (error: any) {
        console.warn(`Retry attempt ${attempt} failed: ${error.message}`);
        if (attempt === 3 || (error.status && error.status !== 429)) {
          throw error;
        }
        await setTimeout(1000 * attempt); // Exponential backoff
      }
    }

    throw new Error("Failed to generate metadata after retries");
  } catch (error: any) {
    console.error("Error generating metadata with Groq:", error);
    throw new Error(`Failed to generate metadata: ${error.message}`);
  }
}