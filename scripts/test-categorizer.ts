import { buildPrompt, classifyVideosWithGemini, classifyBatchOfUncategorized } from '../src/lib/categorizer';
import {
  getDatabase,
  getCategories,
  upsertVideo,
  updateVideoCategory,
  getVideos,
} from '../src/lib/db';

async function testCategorizer() {
  console.log('Testing Categorizer...');

  const categories = getCategories();
  const sampleVideos = [
    {
      id: 'v1',
      title: 'Interview with Sam Altman on AGI',
      channel_title: 'Lex Fridman',
      description: 'Sam Altman discusses OpenAI, GPT-5, and intelligence.',
    },
    {
      id: 'v2',
      title: 'Coding an Agent in Python',
      channel_title: 'AI Coder',
      description: 'Step by step building an autonomous coding bot.',
    },
  ];

  // 1. Verify prompt builder
  const prompt = buildPrompt(sampleVideos, categories);
  if (!prompt.includes('Interview') || !prompt.includes('AI-Coding') || !prompt.includes('Sam Altman')) {
    throw new Error('Prompt builder failed to include categories or video details');
  }
  console.log('✓ Prompt builder correctly structured active categories and videos');

  // 2. Verify classification fallback when no API key is provided
  delete process.env.GEMINI_API_KEY;
  const results = await classifyVideosWithGemini(sampleVideos, categories);
  if (results.length !== 2 || results[0].category_id !== 'others') {
    throw new Error('Fallback classification should assign "others" safely');
  }
  console.log('✓ Fallback classification assigned "others" gracefully without crashing');

  // 3. Verify batch unclassified videos in DB
  upsertVideo({
    id: 'batch-v1',
    title: 'Unclassified video 1',
    channel_title: 'Channel',
    description: 'A video',
    thumbnail_url: 'https://example.com/t1.jpg',
    published_at: new Date().toISOString(),
    feed_type: 'likes',
  });

  const classifiedCount = await classifyBatchOfUncategorized(10);
  if (classifiedCount < 1) {
    throw new Error('classifyBatchOfUncategorized did not update uncategorized videos');
  }
  console.log('✓ Batch classification updated uncategorized videos in DB');

  // 4. Verify manual override persistence through upsert
  updateVideoCategory('batch-v1', 'entrepreneurship', true);
  const beforeUpsert = getVideos({ categoryId: 'entrepreneurship' });
  if (beforeUpsert.total !== 1 || beforeUpsert.videos[0].is_manual_override !== 1) {
    throw new Error('Manual override not recorded');
  }

  // Simulate an incoming sync upsert for the same video with a different category
  upsertVideo({
    id: 'batch-v1',
    title: 'Unclassified video 1',
    channel_title: 'Channel',
    description: 'A video',
    thumbnail_url: 'https://example.com/t1.jpg',
    published_at: new Date().toISOString(),
    feed_type: 'likes',
    category_id: 'others', // Should NOT overwrite manual override
  });

  const afterUpsert = getVideos({ categoryId: 'entrepreneurship' });
  if (afterUpsert.total !== 1 || afterUpsert.videos[0].is_manual_override !== 1) {
    throw new Error('Manual category override was overwritten by upsert!');
  }
  console.log('✓ Manual category override successfully persisted across sync upsert');

  console.log('ALL CATEGORIZER TESTS PASSED!');
}

testCategorizer().catch((err) => {
  console.error(err);
  process.exit(1);
});
