import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export async function initPineconeIndex() {
  const indexName = "video-metadata";
  const index = pinecone.Index(indexName);
  return index;
}