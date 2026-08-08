/**
 * PH-B2/B3 demo deck — a self-contained, hand-authored question set that
 * exercises all three media kinds so the real `src/core` state machine
 * (deck bands, R-b, the decider, exhaustion) can be driven and observed
 * end to end in this worktree, ahead of WL-C's editor/pack pipeline being
 * wired in. 30 questions: green band at N=6 (needs ≥24) and N=10 (needs
 * ≥38 is NOT met — 30 lands in "warn", which is deliberately kept rather
 * than padded to green, so the deck-band warning copy is also exercised by
 * a real playthrough, not just a unit fixture) — disclosed in the worklog.
 */
import type { Question } from '../../contracts';
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
  { text: 'كم يبلغ عدد أيام السنة الميلادية الكبيسة؟', options: ['ثلاثمئة وأربعة وستون', 'ثلاثمئة وخمسة وستون', 'ثلاثمئة وستة وستون', 'ثلاثمئة وسبعة وستون'], correctIndex: 2 },
  { text: 'ما هي أكبر دولة من حيث المساحة؟', options: ['الصين', 'كندا', 'روسيا', 'الولايات المتحدة'], correctIndex: 2 },
  { text: 'ما اسم غاز التنفس الذي يحتاجه الإنسان؟', options: ['ثاني أكسيد الكربون', 'النيتروجين', 'الأكسجين', 'الهيدروجين'], correctIndex: 2 },
  { text: 'كم عدد أضلاع المربع؟', options: ['ثلاثة', 'أربعة', 'خمسة', 'ستة'], correctIndex: 1 },
  { text: 'ما اسم أول رائد فضاء وصل إلى القمر؟', options: ['يوري غاغارين', 'نيل أرمسترونغ', 'باز ألدرن', 'جون غلين'], correctIndex: 1 },
  { text: 'ما اللغة الرسمية في مصر؟', options: ['الإنجليزية', 'الفرنسية', 'العربية', 'التركية'], correctIndex: 2 },
  { text: 'كم عدد فصول السنة؟', options: ['اثنان', 'ثلاثة', 'أربعة', 'خمسة'], correctIndex: 2 },
  { text: 'ما هو الكوكب المعروف بالكوكب الأحمر؟', options: ['المشتري', 'زحل', 'المريخ', 'أورانوس'], correctIndex: 2 },
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
  { label: 'جمل', aspect: 'landscape', text: 'ما اسم الحيوان المعروف بسفينة الصحراء؟', options: ['حصان', 'جمل', 'ثور', 'غزال'], correctIndex: 1 },
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
  { freqHz: 262, seconds: 4, text: 'استمعوا للمقطع ثم أجيبوا', options: ['طويل', 'قصير جدًا', 'متوسط الطول', 'صامت'], correctIndex: 2 },
  { freqHz: 523, seconds: 2, text: 'استمعوا للمقطع القصير', options: ['نغمة حادة', 'صمت تام', 'ضجيج', 'صوت طبل'], correctIndex: 0 },
];

export function buildDemoDeck(): Question[] {
  const questions: Question[] = [];

  TEXT_FIXTURES.forEach((f, i) => {
    questions.push({
      id: `demo-text-${i + 1}`,
      text: f.text,
      options: f.options,
      correctIndex: f.correctIndex,
      media: { kind: 'none' },
    });
  });

  IMAGE_FIXTURES.forEach((f, i) => {
    questions.push({
      id: `demo-image-${i + 1}`,
      text: f.text,
      options: f.options,
      correctIndex: f.correctIndex,
      // sha256/ext are unused placeholders here — this worktree has no
      // content-addressed media store yet (WL-C/WL-D). The actual pixels
      // are resolved at render time via `resolveDemoMediaUrl` below.
      media: { kind: 'image', sha256: `demo-image-${i + 1}`, ext: 'png' },
    });
  });

  AUDIO_FIXTURES.forEach((f, i) => {
    questions.push({
      id: `demo-audio-${i + 1}`,
      text: f.text,
      options: f.options,
      correctIndex: f.correctIndex,
      media: { kind: 'audio', sha256: `demo-audio-${i + 1}`, ext: 'wav' },
    });
  });

  return questions;
}

/** Resolves a demo question's media id to a renderable URL, synthesizing it
 *  lazily (once) and caching — see placeholder-media.ts's header for why
 *  this exists instead of a real content-addressed lookup. */
const urlCache = new Map<string, string>();

export function resolveDemoMediaUrl(questionId: string): string {
  const cached = urlCache.get(questionId);
  if (cached) return cached;

  const imageIdx = IMAGE_FIXTURES.findIndex((_, i) => `demo-image-${i + 1}` === questionId);
  if (imageIdx !== -1) {
    const f = IMAGE_FIXTURES[imageIdx]!;
    const url = makePlaceholderImageDataUrl({ label: f.label, aspect: f.aspect, seed: imageIdx + 1 });
    urlCache.set(questionId, url);
    return url;
  }

  const audioIdx = AUDIO_FIXTURES.findIndex((_, i) => `demo-audio-${i + 1}` === questionId);
  if (audioIdx !== -1) {
    const f = AUDIO_FIXTURES[audioIdx]!;
    const url = makePlaceholderAudioDataUrl({ freqHz: f.freqHz, seconds: f.seconds });
    urlCache.set(questionId, url);
    return url;
  }

  throw new Error(`resolveDemoMediaUrl: unknown media question id ${questionId}`);
}
