import { GoogleGenAI } from '@google/genai';
import { getConfig } from './config';
import {
  getCategories,
  getUncategorizedVideos,
  updateVideoCategory,
  VideoRecord,
  CategoryRecord,
} from './db';

export interface ClassificationResult {
  id: string;
  category_id: string;
}

export function buildPrompt(
  videos: { id: string; title: string; channel_title: string; description: string }[],
  categories: CategoryRecord[]
): string {
  const categoriesList = categories.map((c) => `- "${c.id}" (${c.name})`).join('\n');

  const videosList = videos.map((v, i) => {
    // Truncate description to 200 chars to save tokens
    const desc = v.description.replace(/\s+/g, ' ').slice(0, 200);
    return `[${i + 1}] ID: "${v.id}" | Channel: "${v.channel_title}" | Title: "${v.title}" | Desc: "${desc}"`;
  }).join('\n');

  return `You are a video classification assistant. Classify each YouTube video into exactly ONE of the following category IDs:
${categoriesList}

Rules:
1. You MUST pick an exact category ID from the list above.
2. If uncertain or none of the specific topics apply, choose "others".
3. Return ONLY a valid JSON array of objects with keys "id" and "category_id". No markdown formatting or code blocks.

Videos to classify:
${videosList}
`;
}

export async function classifyVideosWithGemini(
  videos: { id: string; title: string; channel_title: string; description: string }[],
  categories: CategoryRecord[]
): Promise<ClassificationResult[]> {
  const { geminiApiKey } = getConfig();
  if (!geminiApiKey) {
    console.warn('GEMINI_API_KEY is not set. Defaulting videos to "others".');
    return videos.map((v) => ({ id: v.id, category_id: 'others' }));
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const prompt = buildPrompt(videos, categories);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '[]';
    const parsed = JSON.parse(text) as { id: string; category_id: string }[];

    const validCategoryIds = new Set(categories.map((c) => c.id));

    return parsed.map((item) => ({
      id: item.id,
      category_id: validCategoryIds.has(item.category_id) ? item.category_id : 'others',
    }));
  } catch (err) {
    console.error('Gemini classification error:', err);
    // Graceful fallback to "others"
    return videos.map((v) => ({ id: v.id, category_id: 'others' }));
  }
}

export async function classifyBatchOfUncategorized(batchSize = 20): Promise<number> {
  const unclassified: VideoRecord[] = getUncategorizedVideos(batchSize);
  if (unclassified.length === 0) {
    return 0;
  }

  const categories = getCategories();
  const results = await classifyVideosWithGemini(
    unclassified.map((v) => ({
      id: v.id,
      title: v.title,
      channel_title: v.channel_title,
      description: v.description,
    })),
    categories
  );

  let updatedCount = 0;
  for (const item of results) {
    if (item.category_id) {
      updateVideoCategory(item.id, item.category_id, false);
      updatedCount++;
    }
  }

  return updatedCount;
}
