/**
 * A self-contained, hand-authored question set for `tests/stage/**`'s
 * manual verification drivers — exercises all three media kinds so the
 * screen components (`renderQuestionScreen` and friends) can be driven and
 * observed directly, WITHOUT a real author's IndexedDB draft. **Test-only.**
 *
 * Relocated here from `src/stage/session/demo-deck.ts` (deleted, D-25 /
 * worklog-B5.md, 2026-08-08) — the product no longer ships or plays a
 * bundled demo deck; `src/stage/app.ts` now builds its deck exclusively
 * from the author's own `DraftStore` (see `seed-fixture-draft.ts` in this
 * same directory for the equivalent fixture, seeded through THAT real path,
 * for scripts that drive the live app end to end rather than calling a
 * screen-render function directly).
 *
 * 24 questions: `deckBand(24, N)` is green at N=6 (needs >=23.7 -> 24), warn
 * at N=10 (needs >=37.4) — kept deliberately in "warn" at the default N=10
 * preset so the deck-band warning copy is exercised by scripts that reach
 * team-setup, not just a unit fixture (same rationale the original demo
 * deck documented).
 */
import type { Question } from '../../../src/contracts';
import { makePlaceholderAudioDataUrl, makePlaceholderImageDataUrl } from './placeholder-media';

interface TextFixture {
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

const TEXT_FIXTURES: TextFixture[] = [
  { text: 'ما عاصمة المملكة العربية السعودية؟', options: ['جدة', 'الرياض', 'الدمام', 'أبها'], correctIndex: 1 },
  { text: 'كم عدد أيام الأسبوع؟', options: ['خمسة', 'ستة', 'سبعة', 'ثمانية'], correctIndex: 2 },
  { text: 'ما أكبر محيط في العالم؟', options: ['الأطلسي', 'الهندي', 'الهادئ', 'المتجمد الشمالي'], correctIndex: 2 },
  { text: 'كم عدد أركان الإسلام؟', options: ['ثلاثة', 'أربعة', 'خمسة', 'ستة'], correctIndex: 2 },
  { text: 'ما هو أطول نهر في العالم؟', options: ['النيل', 'الأمازون', 'الفرات', 'دجلة'], correctIndex: 0 },
  { text: 'كم عدد لاعبي فريق كرة القدم في الملعب؟', options: ['تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر'], correctIndex: 2 },
  { text: 'ما اسم أصغر كوكب في المجموعة الشمسية؟', options: ['المريخ', 'عطارد', 'الزهرة', 'زحل'], correctIndex: 1 },
  { text: 'كم عدد حروف اللغة العربية؟', options: ['ستة وعشرون', 'ثمانية وعشرون', 'ثلاثون', 'اثنان وثلاثون'], correctIndex: 1 },
  { text: 'ما ناتج جمع سبعة وخمسة؟', options: ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر'], correctIndex: 2 },
  { text: 'في أي قارة تقع مصر؟', options: ['آسيا', 'أفريقيا', 'أوروبا', 'أمريكا الجنوبية'], correctIndex: 1 },
  { text: 'ما هو أسرع حيوان بري؟', options: ['الأسد', 'الفهد', 'النمر', 'الحصان'], correctIndex: 1 },
  { text: 'كم عدد أشهر السنة الهجرية؟', options: ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر'], correctIndex: 2 },
  { text: 'ما اللون الناتج عن مزج الأزرق والأصفر؟', options: ['الأخضر', 'البنفسجي', 'البرتقالي', 'الرمادي'], correctIndex: 0 },
  { text: 'ما هي عملة المملكة العربية السعودية؟', options: ['الدرهم', 'الدينار', 'الريال', 'الجنيه'], correctIndex: 2 },
  { text: 'كم عدد قارات العالم؟', options: ['خمسة', 'ستة', 'سبعة', 'ثمانية'], correctIndex: 2 },
  { text: 'ما اسم أعلى جبل في العالم؟', options: ['كليمنجارو', 'إفرست', 'إلبروس', 'فوجي'], correctIndex: 1 },
  { text: 'ما هي أكبر دولة من حيث المساحة؟', options: ['الصين', 'كندا', 'روسيا', 'الولايات المتحدة'], correctIndex: 2 },
  { text: 'ما اسم غاز التنفس الذي يحتاجه الإنسان؟', options: ['ثاني أكسيد الكربون', 'النيتروجين', 'الأكسجين', 'الهيدروجين'], correctIndex: 2 },
  { text: 'كم عدد أضلاع المربع؟', options: ['ثلاثة', 'أربعة', 'خمسة', 'ستة'], correctIndex: 1 },
  { text: 'ما اللغة الرسمية في مصر؟', options: ['الإنجليزية', 'الفرنسية', 'العربية', 'التركية'], correctIndex: 2 },
];

interface ImageFixture {
  label: string;
  aspect: 'landscape' | 'portrait' | 'square';
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

const IMAGE_FIXTURES: ImageFixture[] = [
  { label: 'أسد', aspect: 'landscape', text: 'ما اسم الحيوان في الصورة؟', options: ['نمر', 'أسد', 'ذئب', 'دب'], correctIndex: 1 },
  { label: 'برج', aspect: 'portrait', text: 'ما نوع المبنى الظاهر في الصورة؟', options: ['برج', 'جسر', 'كوخ', 'سد'], correctIndex: 0 },
  { label: 'تفاحة', aspect: 'square', text: 'ما اسم الفاكهة في الصورة؟', options: ['موزة', 'تفاحة', 'برتقالة', 'عنبة'], correctIndex: 1 },
];

interface AudioFixture {
  freqHz: number;
  seconds: number;
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

const AUDIO_FIXTURES: AudioFixture[] = [
  { freqHz: 440, seconds: 3, text: 'استمعوا للمقطع — كم نغمة سمعتم؟', options: ['نغمة واحدة', 'نغمتان', 'ثلاث نغمات', 'أربع نغمات'], correctIndex: 0 },
];

export function buildFixtureDeck(): Question[] {
  const questions: Question[] = [];

  TEXT_FIXTURES.forEach((f, i) => {
    questions.push({
      id: `fixture-text-${i + 1}`,
      text: f.text,
      options: f.options,
      correctIndex: f.correctIndex,
      media: { kind: 'none' },
    });
  });

  IMAGE_FIXTURES.forEach((f, i) => {
    questions.push({
      id: `fixture-image-${i + 1}`,
      text: f.text,
      options: f.options,
      correctIndex: f.correctIndex,
      // sha256/ext are unused placeholders — this fixture has no real
      // content-addressed media store behind it. Pixels are resolved at
      // render time via `resolveFixtureMediaUrl` below.
      media: { kind: 'image', sha256: `fixture-image-${i + 1}`, ext: 'png' },
    });
  });

  AUDIO_FIXTURES.forEach((f, i) => {
    questions.push({
      id: `fixture-audio-${i + 1}`,
      text: f.text,
      options: f.options,
      correctIndex: f.correctIndex,
      media: { kind: 'audio', sha256: `fixture-audio-${i + 1}`, ext: 'wav' },
    });
  });

  return questions;
}

/** Resolves a fixture question's media id to a renderable URL, synthesizing
 *  it lazily (once) and caching — see placeholder-media.ts's header. */
const urlCache = new Map<string, string>();

export function resolveFixtureMediaUrlById(questionId: string): string {
  const cached = urlCache.get(questionId);
  if (cached) return cached;

  const imageIdx = IMAGE_FIXTURES.findIndex((_, i) => `fixture-image-${i + 1}` === questionId);
  if (imageIdx !== -1) {
    const f = IMAGE_FIXTURES[imageIdx]!;
    const url = makePlaceholderImageDataUrl({ label: f.label, aspect: f.aspect, seed: imageIdx + 1 });
    urlCache.set(questionId, url);
    return url;
  }

  const audioIdx = AUDIO_FIXTURES.findIndex((_, i) => `fixture-audio-${i + 1}` === questionId);
  if (audioIdx !== -1) {
    const f = AUDIO_FIXTURES[audioIdx]!;
    const url = makePlaceholderAudioDataUrl({ freqHz: f.freqHz, seconds: f.seconds });
    urlCache.set(questionId, url);
    return url;
  }

  throw new Error(`resolveFixtureMediaUrlById: unknown media question id ${questionId}`);
}

/** Matches the real `resolveMediaUrl` seam's shape (`(question) => string |
 *  null`) directly, for scripts calling `renderQuestionScreen` themselves. */
export function resolveFixtureMediaUrl(question: Question): string | null {
  if (question.media.kind === 'none') return null;
  try {
    return resolveFixtureMediaUrlById(question.id);
  } catch {
    return null;
  }
}
