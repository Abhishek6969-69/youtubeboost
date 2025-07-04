'use server';

import { pipeline } from '@xenova/transformers';

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const result = await embedder(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(result.data);
    return embedding;
  } catch (error: any) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}