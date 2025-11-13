# Gemini 2.5 Flash Setup - Quick Start Guide

Your complete implementation guide has been updated to use **Google's Gemini 2.5 Flash** instead of OpenAI. Here's what changed and how to get started.

## Key Changes from Original Guide

### 1. **AI Service Implementation**
- Changed from `openai` package to `@google/generative-ai`
- Model name: `gemini-2.5-flash` (instead of `gpt-3.5-turbo`)
- API calls use `.generateContent()` instead of `.chat.completions.create()`

### 2. **Environment Setup**
```bash
# Instead of:
OPENAI_API_KEY=sk-...

# Use:
GEMINI_API_KEY=AIzaSy...
```

### 3. **JSON Response Handling**
- Gemini sometimes wraps JSON responses in markdown code blocks
- The guide includes code to automatically clean responses:
```typescript
const cleanedContent = content
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim();
```

## Getting Started with Gemini API

### Step 1: Get Your API Key (Free)

1. Visit https://ai.google.dev
2. Click **"Get API Key"**
3. Select or create a Google Cloud project
4. Generate API key (no credit card required)
5. Copy the key to your `.env` file

### Step 2: Install Dependencies

```bash
npm install @google/generative-ai
```

### Step 3: Basic Implementation Example

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function generateRecipes(ingredients: string[]) {
  const prompt = `Given these ingredients: ${ingredients.join(', ')}, suggest 3 recipes`;
  
  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  // Clean JSON if wrapped in markdown
  const cleaned = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  return JSON.parse(cleaned);
}
```

## Free Tier Limits (Plenty for Your App)

| Limit | Value |
|-------|-------|
| **Input Tokens/Month** | 2M |
| **Requests/Day** | 32K |
| **Requests/Minute** | 10 |
| **Credit Card Required** | No |

**Monthly Cost Estimation:**
- Recipe suggestions (3x per user/week): ~$0.001 per user/month
- Meal planning (1x per user/week): ~$0.0006 per user/month  
- Shopping optimization (1x per user/week): ~$0.0006 per user/month
- **Total:** ~$0.002 per user/month (if exceeding free tier)

## What's Different from OpenAI?

### Response Format
```typescript
// OpenAI:
const response = await this.openai.chat.completions.create({...});
const text = response.choices[0].message.content;

// Gemini:
const result = await this.model.generateContent(prompt);
const text = result.response.text();
```

### Rate Limiting
```typescript
// Gemini errors when rate limited (429 or quota errors)
// The guide includes retry logic with exponential backoff
if (error.status === 429 || error.message?.includes('quota')) {
  // Automatically retry with exponential backoff
}
```

### Configuration
```typescript
// No need for complex config like OpenAI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
// That's it! No organization ID, API version, etc.
```

## Key Sections in Updated Guide

The complete guide has been updated with:

1. **Architecture Overview** (Section 1)
   - Updated to show Gemini in business logic layer

2. **AI Integration Strategy** (Section 5)
   - Comprehensive Gemini API setup guide
   - Complete `ai.service.ts` using Gemini
   - Three main features: recipe suggestions, meal planning, shopping optimization
   - Retry logic with rate limit handling
   - Cost breakdown and free tier info

3. **Backend Structure** (referenced in Section 4)
   - `gemini.config.ts` instead of `openai.config.ts`
   - `ai.service.ts` with Gemini implementation

4. **Best Practices** (Section 8)
   - Updated rate limiting strategy for Gemini
   - JSON response validation patterns

5. **Deployment** (end of guide)
   - Environment variables updated with `GEMINI_API_KEY`

## Migrating Code from OpenAI?

If you have existing OpenAI code, here's the conversion pattern:

```typescript
// BEFORE (OpenAI)
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: prompt }],
});
const text = response.choices[0].message.content;

// AFTER (Gemini)
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
const result = await model.generateContent(prompt);
const text = result.response.text();

// Clean if response is JSON wrapped in markdown
const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
```

## Common Issues & Solutions

### Issue: "API key invalid"
- Make sure you copied the entire key from https://ai.google.dev
- Verify it's in your `.env` file as `GEMINI_API_KEY`
- Restart your server after updating `.env`

### Issue: "Quota exceeded"
- You've hit the free tier limit (2M tokens/month)
- Consider adding a paid plan or waiting until next month
- For production, calculate token usage and plan accordingly

### Issue: "JSON parsing error"
- Gemini wrapped response in markdown code blocks
- Use the cleaning code from the guide:
```typescript
content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
```

### Issue: "Rate limit (429) error"
- Free tier has 10 requests per minute limit
- The guide's retry logic handles this automatically
- For production, queue requests or use caching

## Testing Your Setup

Here's a simple test to verify everything works:

```typescript
// test.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const result = await model.generateContent("What are 3 recipes with chicken and rice?");
    console.log(result.response.text());
    console.log('✅ Gemini API is working!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testGemini();
```

Run with:
```bash
npx ts-node test.ts
```

## Next Steps

1. **Get API key:** https://ai.google.dev
2. **Add to `.env`:** `GEMINI_API_KEY=your_key_here`
3. **Install package:** `npm install @google/generative-ai`
4. **Follow the implementation guide:** Start with Phase 1 (database + auth)
5. **Reference AI examples:** Check Section 5 of the guide when implementing AI features

## Helpful Resources

- **Gemini API Documentation:** https://ai.google.dev/docs
- **Gemini API Pricing:** https://ai.google.dev/pricing
- **Code Examples:** https://github.com/google/generative-ai-js
- **Community & Support:** https://www.googlecloudcommunity.com/gc/AI-ML/ct-p/ai-ml

---

**Good to know:** Your complete implementation guide in `Smart_Grocery_Meal_Planner_Guide.md` is fully updated and ready to use with Gemini 2.5 Flash. This is a lightweight companion guide for quick reference during setup.
