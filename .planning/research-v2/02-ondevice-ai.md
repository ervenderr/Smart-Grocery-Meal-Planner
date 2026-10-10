# On-device AI for Kitcha on iPhone (research, 2026-10-10)

Scope: research only; repo untouched. Confidence tags: [H] primary source read, [M] secondary/consistent, [L] estimate or single anecdotal source.

## 1. Bottom line

1. Do NOT make an LLM the foundation of offline. Most of Kitcha's "AI" (pantry-match recipe ranking, substitutions from a table, expiry-first planning, shopping list merge) can be deterministic and run offline today with zero model download.
2. For true on-device generation, the cheapest realistic path is Apple Foundation Models (FM) framework: zero download, zero binary growth, native @Generable constrained decoding, free. Its limits: needs Apple Intelligence-capable iPhone (15 Pro or newer) with Apple Intelligence enabled and a supported device language, and a SMALL context (4,096 tokens documented; see 2.1 for the iOS 27 ambiguity). Fits single-recipe suggestions and substitutions, NOT a full 7-day meal plan in one call (needs chunking per day).
3. A bundled/downloaded open model (llama.cpp via llama.rn or Capacitor plugin; or MLX Swift; or LiteRT-LM) is the "works on more phones / bigger context" option. Cost: 1-2.5 GB download, memory/thermal management, quality of 1-4B models for JSON meal plans is mediocre but acceptable with grammar-constrained decoding.
4. Recommended architecture: capability router: rules engine (always) -> Foundation Models (if available) -> server Gemini/Groq (if online and user opted in) -> downloaded GGUF model (Phase 3, optional, only if data shows many users on non-AI iPhones and wanting offline).

## 2. Option-by-option

### 2.1 Apple Foundation Models framework (iOS 26+ / 27)
- Availability [H/M]: Apple Intelligence-eligible hardware. iPhone 15 Pro/Pro Max and all iPhone 16/17/Air/18-gen (non-Pro iPhone 15 and earlier excluded). Needs Apple Intelligence enabled in Settings; `SystemLanguageModel.default.availability` returns unavailable reasons (device not eligible / not enabled / model not ready). Sources: https://capacitorjs.com/docs/apis/local-llm (iPhone 15 Pro+), https://www.macobserver.com/tips/round-ups/apple-intelligence-managed-environment-what-apple-published/ (device list, 16 languages).
- Languages [M]: Apple Intelligence now ~16 languages (English, Danish, Dutch, French, German, Italian, Norwegian, Portuguese, Spanish, Swedish, Turkish, Chinese S/T, Japanese, Korean, Vietnamese) per https://www.macobserver.com/news/apple-intelligence-english-only-features-16-languages/ . Known gotcha: if device language is unsupported, framework is entirely unavailable and there's no per-app override: https://developer.apple.com/forums/thread/805378 . Not offered in mainland China; EU has had feature gaps (Siri AI) but the FM framework itself is available in EU as far as sources show [L - verify].
- Context [H]: Apple TN3193 states 4,096 tokens per session, shared across instructions, prompts, tool schemas, @Generable schemas, and outputs: https://developer.apple.com/tutorials/data/documentation/technotes/tn3193-managing-the-on-device-foundation-model-s-context-window.md . iOS 26.4 added `SystemLanguageModel.contextSize` and `tokenCount(for:)`: https://developer.apple.com/documentation/updates/foundationmodels.md . WWDC26 session 241 (https://developer.apple.com/videos/play/wwdc2026/241/) shows `contextSize` printing 8192 in a code sample, while a WWDC26 Q&A summary says on-device is 4096 and PCC is 32K. CONFLICT: treat as 4K-8K, read `contextSize` at runtime, never hard-code. [M-L]
- iOS 27 (June 2026 updates) [H]: rebuilt on-device model (better instruction following/tool calling; model changes with OS update so prompts need retesting), image input, `LanguageModel` protocol to plug ANY model (server or on-device) into the FM API, `PrivateCloudComputeLanguageModel` (32K context, reasoning levels, no API keys; free for apps under 2M first-time downloads, user daily quota, higher with iCloud+; requires entitlement), and open-source bridges `MLXLanguageModel` (https://github.com/ml-explore/mlx-swift-lm, needs iOS 27 SDK, supports @Generable via MLXGuidedGeneration) and `CoreAILanguageModel` (https://github.com/apple/coreai-models, Core AI `.aimodel`, iOS 27+).
  - Big implication: one Swift API (`LanguageModelSession` + @Generable) can sit over Apple's on-device model, Apple's PCC model, or a downloaded MLX model. This is the cleanest native architecture if Kitcha goes iOS 27+ minimum. PCC may even replace Gemini/Groq on iPhone for free (verify entitlement and quota; not usable from Android/web, so server fallback stays for the web/PWA).
- Guided generation [H]: @Generable macro -> JSON schema -> constrained decoding; always structurally valid output. @Guide(.maximumCount) etc. Schemas cost context tokens. Dev reports: large/nested/recursive @Generable structs stall or fail, recursion unsupported; workaround is chaining smaller generations (https://developer.apple.com/forums/thread/843310, https://developer.apple.com/forums/thread/787753) [M-L, anecdotal, beta-era].
- Tool calling [H]: supported; 3-5 tools recommended; tool schemas consume context. Not needed for Kitcha (pass pantry in prompt).
- App Store [H/M]: no special rule; it's a system API. No binary size, no download. Nothing to disclose beyond normal privacy. Free.
- Speed/battery [L]: Apple does not publish tok/s; community reports ~tens of tok/s on A17/A18 Pro. Short outputs (<500 tokens) are fine. Thermal impact small for short bursts.
- Quality for recipes [L]: Apple's model is ~3B-class, strong at short structured tasks, weak on long, numerically consistent plans. Good for: "3 recipe ideas from these 12 ingredients" (title, 6-10 ingredients, 5 short steps), substitution phrasing, rewriting. Weak for: 7-day x 3 meals with nutrition and no repeats in a single call (context overflow). Do per-day calls with a rolling "already used" list.
- Capacitor/RN bridge: 
  - Official Ionic `@capacitor/local-llm` (https://capacitorjs.com/docs/apis/local-llm; repo ionic-team/capacitor-local-llm v1.0.0 2026-05, 24 stars) - labelled experimental/unsupported, plain-text `prompt()` only, no @Generable. [H]
  - `@capgo/capacitor-llm` (Cap-go, v8.1.9 released 2026-10-09, 44 stars) - active but small community. Docs inconsistent about iOS version. [M]
  - Capawesome Insiders paid plugin (https://capawesome.io/docs/sdks/capacitor/llm/). [M]
  - None expose @Generable/guided generation. Plan on a ~150-line custom Swift Capacitor plugin: `generateRecipes(pantryJson) -> JSON` with Swift @Generable structs mirroring the existing zod schemas. That is small and gives true constrained decoding.
  - React Native: no mainstream maintained FM wrapper confirmed; also write a small native module [L].

### 2.2 MLX Swift (mlx-swift-lm / mlx-swift-examples)
- Repos: ml-explore/mlx-swift-lm v3.32.3 (2026-09-30, 832 stars, MIT); mlx-swift-examples older (last release 2025-10) -> LLM code moved to mlx-swift-lm. [H]
- Runs quantized MLX models (Gemma 3 1B QAT 4-bit, Qwen3 0.6-4B, Llama 3.2 1-3B, Phi) on Metal. iOS 27 bridge exposes them behind FM `LanguageModelSession` with @Generable constrained decoding. [H]
- Memory [M-L]: iPhone per-app ceiling observed ~6 GB on 8 GB phones even with increased-memory-limit entitlement (https://developer.apple.com/forums/thread/834805); a 4B 4-bit model (~2.3-2.5 GB) + KV cache fits; 7-8B does not safely. Entitlements `increased-memory-limit` + extended virtual addressing recommended.
- Speed: no authoritative iPhone MLX numbers found. LiteRT-LM claims comparison vs MLX on iPhone 17 Pro but gave no figures in text. Assume 1B ~40-70 tok/s, 3-4B ~12-25 tok/s on A18 Pro [L].
- Bridge: Swift only. Capacitor: write custom plugin (no maintained Capacitor-MLX plugin found; Capgo claim of MLX unverified). RN: none.
- Verdict: best-in-class native perf and the future-proof path on iOS 27, but locks to iOS (fine: iPhone only) and Swift work.

### 2.3 llama.cpp (+ bindings)
- Core: ggml-org/llama.cpp, 130k stars, very active. Metal backend on iPhone. GBNF grammar and JSON-schema -> grammar constrained sampling. [H]
- Benchmarks (https://github.com/ggml-org/llama.cpp/discussions/4508, Metal, tg = decode tok/s) [H]:
  - A17 Pro (iPhone 15 Pro): TinyLlama 1.1B Q4_0 57 tg; Phi-2 2.8B Q4_0 24.7 tg, 157 pp; Mistral 7B Q4_0 9 tg.
  - A18 Pro (16 Pro): TinyLlama Q4_0 70 tg; Mistral 7B Q4_0 11.6 tg.
  - A19 Pro (iPhone Air): TinyLlama Q4_0 87 tg; Phi-2 Q4_0 36 tg; Mistral 7B 12.7 tg.
  - Interpolate: 1.7B Q4 ~35-50 tg, 3-4B Q4 ~15-25 tg on 15 Pro-17 Pro. A 600-token recipe JSON takes 15-40 s on 3-4B; prompt processing for a 1.5K-token prompt 5-10 s. [L-M]
- llama.rn (mybigday/llama.rn): v0.12.9 (2026-08-04), ~1.06k stars, MIT, pushed today; requires RN New Architecture (>=0.10); Metal on iOS (needs Apple7 GPU+, not in simulator); GBNF + JSON schema grammar; tool calling via Jinja; multimodal. Prebuilt binaries downloaded at postinstall. [H] Healthy. Usable from Capacitor? No; it's an RN module. If Kitcha stays Capacitor/Next, use a Capacitor llama.cpp plugin instead (below).
- Capacitor llama.cpp plugins: `llama-cpp-capacitor` (npm 0.1.5) and arusatech/llama-cpp (repo URL now redirects/moved) - small, low-star, uncertain maintenance [L]. Safer: vendor llama.cpp via its official Swift package/xcframework and write own thin Capacitor plugin (same effort class as FM plugin).
- Cactus (cactus-compute/cactus): v2.2.2 (2026-09-26), 6.1k stars, RN/Flutter/Kotlin/Swift SDKs, GGUF models, optional cloud fallback built in, YC-backed. Fast-moving, newer ecosystem; docs versions churn. [M] Credible alternative to llama.rn if choosing RN/Flutter.
- Quality: Qwen3-4B / Gemma-class 3-4B at Q4_K_M with a JSON-schema grammar gives valid JSON ~100% (syntax), semantic quality "decent": reasonable recipes, occasional weird quantities/steps; poor at multi-day planning consistency. 1-1.7B: usable for substitutions and short recipe ideas only. [M-L, general knowledge; no Kitcha-specific eval]
- Download sizes (GGUF Q4_K_M, approx) [L-M]: Qwen3-1.7B ~1.1 GB; Llama 3.2 3B ~2.0 GB; Phi-3.5/4-mini 3.8B ~2.3-2.5 GB; Qwen3-4B ~2.5 GB; Gemma 3 1B ~0.8 GB; Gemma 3 4B ~2.5 GB.
- Min device: 6 GB RAM for 1-2B (iPhone 15/14 Pro-class and up), 8 GB (15 Pro+, all 16+) for 3-4B comfortably. 6 GB phones (iPhone 14 Pro, 15, 16e) have ~3 GB app limit in practice -> only <=1.7B. [M-L]

### 2.4 Core ML / ExecuTorch / Core AI
- ExecuTorch via software-mansion/react-native-executorch: v0.10.5 (2026-10-06), 1.76k stars, active; iOS 17+, New Arch required; Llama 3.2 1B/3B, Qwen 3 0.6/1.7/4B, tool calling docs; no confirmed JSON-schema constrained decoding API (docs mention tool calling/structured only loosely) [M]. Best if app becomes React Native. Slower than llama.cpp/MLX on iOS typically (XNNPACK CPU; Core ML/MPS backend experimental) [L].
- Core ML classic LLM: painful (stateful KV cache, conversion), superseded by Core AI in iOS 27 (https://github.com/apple/coreai-models; `.aimodel`; export recipes; needs Xcode 27). Early; no model list read, no Capacitor/RN bindings. Watch, don't build on in 2026. [M]

### 2.5 MediaPipe LLM Inference -> LiteRT-LM
- MediaPipe LLM Inference iOS guide lists Gemma 2B-era models only; effectively legacy [M]. Successor: google-ai-edge/LiteRT-LM v0.18.0 (2026-10-06, 6.6k stars): fully open-source Swift API with Metal; Gemma 4 E2B ~56 tok/s decode on iPhone 17 Pro GPU (25 CPU), model file ~2.58 GB, ~607 MB physical footprint on CPU path (https://developers.googleblog.com/blazing-fast-on-device-genai-with-litert-lm/ , https://developers.google.com/edge/litert-lm/models/gemma-4). Gemma 3n E2B has no published iPhone numbers. [M] Pre-1.0 (0.x), constrained decoding support unverified. Good Gemma-branded option, but bridging = custom plugin again. Capgo capacitor-llm falls back to MediaPipe on older iOS (experimental).

### 2.6 WebLLM / WebGPU (Safari, WKWebView)
- WebGPU shipped in Safari 26 / iOS 26 and enabled by default in WKWebView there [M]. But: per-buffer limits (WebLLM had to cut to 256 MB buffers), GPU process jetsam kills, llama.cpp WebGPU demo in Safari crashed on rising memory (https://bugs.webkit.org/show_bug.cgi?id=311598, 303203) [M]. Practical ceiling ~1B 4-bit models. web-llm v0.2.85 (2026-09) active. Pros: works in the existing Next.js PWA with no native code, and Android/desktop too. Cons: flaky memory, models cached in browser storage (eviction risk), no grammar parity (xgrammar in WebLLM does support JSON schema [M]). Verdict: curiosity / PWA-only tier, not a primary iPhone path; native is strictly better in an App Store app.

### 2.7 Small model shortlist for JSON recipe tasks
- Qwen3 (1.7B/4B): best instruction+JSON quality per GB at this size; Apache-2.0. Has "thinking" mode - disable (/no_think) to save tokens.
- Gemma 3 (1B/4B QAT) and Gemma 3n/4 E2B: good quality, but Gemma license terms (use restrictions) - read before shipping; Gemma 4 licence unverified.
- Llama 3.2 1B/3B: fine, Llama community license (attribution, 700M MAU clause irrelevant).
- Phi-4-mini 3.8B: strong reasoning, MIT, 2.3-2.5 GB.
- Recommendation if building the download tier: Qwen3-4B Q4_K_M (8 GB phones) and Qwen3-1.7B (6 GB phones), both behind JSON-schema grammar.

## 3. App Store / platform implications
- Guideline 2.5.2 (https://developer.apple.com/app-store/review/guidelines/): apps may not download code that changes features. Model weights are data, not code, and many shipping apps (e.g. local-LLM apps) download GGUF/MLX weights; low risk but not zero. Keep inference engine in the binary, download weights only. [M]
- 4.2.3(ii): if the app needs a download to function at first launch, disclose size and prompt. Make the model download optional ("Enable offline AI, 2.5 GB, Wi-Fi only").
- 5.1.2(i): disclose and get consent when sending personal data to third-party AI (relevant to the server fallback: Gemini/Groq). Pantry data is low-sensitivity but disclose anyway. On-device path improves the privacy story.
- Binary size: bundling a 2.5 GB model in the IPA is possible (limit 4 GB thinned on iOS 18+, per https://developer.apple.com/help/app-store-connect/reference/on-demand-resources-size-limits/ [conflicting pages]) but bad for installs; download on first use. On-Demand Resources is DEPRECATED as of iOS 27; use Apple-hosted Background Assets (asset packs; up to 8 GB per pack on iOS 18+ per same page) or own CDN (Cloudflare R2/Hugging Face URL). [M]
- Memory: jetsam ~6 GB observed ceiling on 8 GB phones; use `os_proc_available_memory()` gating; add `com.apple.developer.kernel.increased-memory-limit` and `extended-virtual-addressing` entitlements; unload the model on `didReceiveMemoryWarning`/background; no GPU work in the background (iOS kills Metal in background).
- Battery/thermal [L]: sustained LLM decoding on iPhone heats and throttles after ~1-3 minutes of continuous generation; a recipe generation (20-40 s) is fine, a full week plan on 4B model (several minutes) is not pleasant. Prefer per-day chunks with user-visible progress and `ProcessInfo.thermalState` checks; skip offline LLM in Low Power Mode.
- Review risk for FM: none specific. Add a fallback UI when Apple Intelligence is off so reviewers on non-AI test devices still see a functioning app (App Review commonly tests on devices that may lack Apple Intelligence).

## 4. Bridging from the current stack
- Kitcha frontend is Next.js PWA; "App Store app" implies Capacitor wrapper (lowest effort; reuses the web UI; Serwist PWA plan in CLAUDE.md still applies for web). RN would be a rewrite - avoid.
- Pattern: Capacitor plugin `KitchaAI` with methods `availability()`, `suggestRecipes({pantry, diet, count})`, `substitute({ingredient, context})`, `planDay({...})`, returning JSON that is validated by the SAME zod schemas used server-side (move schemas to a shared package). Web/PWA build: plugin absent -> falls back to server.
- Native implementations behind one interface: (a) FoundationModels (@Generable mirrors zod), (b) later `MLXLanguageModel`/llama.cpp for downloaded model. With iOS 27 `LanguageModel` protocol both can share one Swift code path.
- Constrained decoding: FM (@Generable) and MLX bridge (MLXGuidedGeneration) and llama.cpp (GBNF from zod->JSON schema->grammar via the same `z.toJSONSchema()` already planned) all give syntactically valid JSON; still run zod and discard/repair semantic violations (quantity 0, unknown units, banned allergens).

## 5. What needs NO LLM (do this first; works offline)
1. Pantry-match recipe ranking: score = weighted overlap of recipe ingredients vs pantry (normalize names via a synonyms/alias table, ignore staples like salt/oil/water), boost expiring items, penalize missing count; show "missing 2 items". Pure SQL/JS. Needs recipes stored locally (user recipes + a bundled seed set of 300-1000 recipes, public domain/CC0 or self-authored; TheMealDB terms need checking per CLAUDE.md).
2. Rule-based substitutions: curated table (buttermilk -> milk + lemon, honey -> maple, etc.) with ratio, diet tags, notes; ~300 entries cover most real use. Optionally use Open Food Facts/USDA categories for fallback matching.
3. Meal-plan auto-fill: constraint heuristic (no repeats within N days, rotate cuisines, prioritize expiring pantry items, budget cap, per-day calories), greedy/beam search over local recipe set. Often better than a 3B LLM for consistency.
4. Shopping list from plan minus pantry, unit conversion, aisle grouping.
5. Expiry alerts (local notifications), barcode scan cache (Open Food Facts cached rows), nutrition lookup from bundled USDA subset.
6. Text embedding for fuzzy ingredient matching: Apple NaturalLanguage `NLEmbedding` (built-in, offline, no download) as an optional upgrade for name matching.
The LLM then only adds: free-form "invent something creative from these 6 things", natural-language rewriting, and flexible substitution explanations.

## 6. Hybrid architecture
```
Request (suggest | plan | substitute)
 1. Rules engine (local, always)  -> if confident (>= N matches or table hit): return immediately
 2. Router.capabilities():
      FM available (Apple Intelligence on, language ok)  -> on-device FM (chunked, @Generable)
      else downloaded model installed and memory ok       -> llama.cpp/MLX
      else online + user consent                          -> existing server (Gemini -> Groq failover, quota guard, AiCache)
      else                                                -> rules-only result with "AI unavailable offline" note
 3. Validate with shared zod schema; on failure retry once, then fall back one tier down.
 4. Cache result by sha256(normalized pantry+diet+kind) in local SQLite (same key scheme as server AiCache).
```
- Policy knob: "Prefer on-device" default ON when available (privacy, free, no server quota), server for plan generation (long context) unless offline.
- Optional on iOS 27: try `PrivateCloudComputeLanguageModel` as free tier before Gemini (check entitlement, quota, whether user data policy suits). Treat as to-verify.
- Local data: needs an on-device store (SQLite via Capacitor SQLite or IndexedDB) with sync to Postgres; offline-first sync is itself a large project (conflict handling). The PWA plan scopes offline narrowly; on-device AI only makes sense if pantry/recipes are available offline too.

## 7. Phased plan
- Phase 0 (1-2 wks, no native): Extract zod schemas into shared package; build rules engine (ranking, substitution table, plan heuristic); add local cache. Ship in PWA and wrapper. Measure how often rules suffice.
- Phase 1 (1-2 wks): Capacitor wrapper + custom `KitchaAI` plugin on Foundation Models (@Generable), availability gating, per-day plan chunking, tests with a real iPhone 15 Pro and a non-AI iPhone. Fallback to server. Evaluate 30 fixed pantry prompts vs Gemini output (schema pass rate, allergen violations, duplicate rate, human rating).
- Phase 2 (decision gate): if FM quality or availability (non-AI iPhones, unsupported languages) is a real problem, add iOS 27 `LanguageModel` abstraction + `MLXLanguageModel` or llama.cpp plugin with an opt-in Wi-Fi-only Qwen3 download (Background Assets or R2/HF). Entitlements, memory gating, thermal guard.
- Phase 3 (optional): PCC model integration, vision (photo of fridge -> ingredients using iOS 27 image input / Vision OCR + BarcodeReaderTool), embeddings.
- Skip: WebLLM in WKWebView, Core AI/ExecuTorch, RN rewrite.

## 8. Risk / quality assessment
| Item | Assessment |
|---|---|
| FM structural validity | High (constrained). Semantic quality medium: ingredient quantities/steps plausible but generic; occasional hallucinated ingredients not in pantry - validate against pantry list |
| FM coverage | Only ~Apple-Intelligence iPhones (15 Pro+, ~roughly the last 3 model years) with AI enabled and supported language; expect 30-60% of general iPhone users, personal-app owner probably covered [L] |
| FM context | 4K (maybe 8K on iOS 27) -> plan per day; prompts < 1.5K tokens |
| Moving target | On-device model changes with each iOS release; prompts need regression tests; iOS 27 beta forum reports of guided-generation slowdowns (macOS 27 betas) - recheck on release builds |
| Downloaded 3-4B model | Valid JSON via grammar; mediocre-to-good recipes; 15-40 s per recipe set; heat/battery; 2.5 GB download; jetsam risk on 6 GB phones. Not worth it before Phase 0-1 data |
| Plugins | Official Capacitor LLM plugin experimental/unsupported, no structured output; community ones small. Own plugin is low-risk, small code |
| Compliance | Low. Disclose downloads (4.2.3), third-party AI data sharing (5.1.2), keep weights as data (2.5.2) |
| Cost | On-device: $0 marginal. Apple Developer $99/yr needed anyway |

## 9. Gaps / things to verify before committing
- iOS 27 on-device context size (4096 vs 8192) - run `SystemLanguageModel().contextSize` on a 15 Pro and a 17 Pro.
- PCC entitlement terms and daily quota for a small indie app.
- Real tok/s of FM and of Qwen3-4B on target devices; no authoritative published numbers found.
- Gemma 4 / Gemma 3n license terms; Qwen3 licence (Apache-2.0) [M].
- Whether Apple Intelligence regional limits (EU, China) affect the target audience (PHP pricing in CLAUDE.md suggests Philippines: English supported, fine).
- Offline data sync scope.

## Sources
- https://developer.apple.com/tutorials/data/documentation/technotes/tn3193-managing-the-on-device-foundation-model-s-context-window.md
- https://developer.apple.com/documentation/updates/foundationmodels.md
- https://developer.apple.com/videos/play/wwdc2026/241/
- https://developer.apple.com/forums/thread/805378 , /843310 , /787753 , /834805
- https://github.com/ml-explore/mlx-swift-lm , https://github.com/apple/coreai-models
- https://capacitorjs.com/docs/apis/local-llm , https://github.com/Cap-go/capacitor-llm , https://capawesome.io/docs/sdks/capacitor/llm/
- https://github.com/mybigday/llama.rn , https://github.com/ggml-org/llama.cpp/discussions/4508
- https://github.com/cactus-compute/cactus , https://github.com/software-mansion/react-native-executorch
- https://developers.googleblog.com/blazing-fast-on-device-genai-with-litert-lm/ , https://developers.google.com/edge/litert-lm/models/gemma-4
- https://bugs.webkit.org/show_bug.cgi?id=311598 , https://github.com/mlc-ai/web-llm
- https://developer.apple.com/app-store/review/guidelines/ , https://developer.apple.com/help/app-store-connect/reference/on-demand-resources-size-limits/
- https://www.macobserver.com/news/apple-intelligence-english-only-features-16-languages/
GitHub stats pulled via API 2026-10-10.
