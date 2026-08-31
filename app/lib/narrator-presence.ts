export const NARRATOR_PRESENCE_THRESHOLD = 80;

const WORD_RE = /[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]+(?:[-'][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]+)*/g;

function words(text: string) {
  return String(text || "").match(WORD_RE)?.length || 0;
}

function cleanCue(text: string) {
  return String(text || "")
    .replace(/^\s*\[\d{1,2}:\d{2}:\d{2}\]\s+VO:\s*/i, "")
    .trim();
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export type NarratorPresenceMetrics = {
  score: number;
  threshold: number;
  passes: boolean;
  cueCount: number;
  activePovCues: number;
  conversationalCues: number;
  memoryCallbackCues: number;
  conciseReactiveCues: number;
  presenceCoverage: number;
  activePovShare: number;
  conversationalShare: number;
  deficiencies: string[];
};

export function narratorPresenceMetrics(rawCues: string[]): NarratorPresenceMetrics {
  const cues = (rawCues || []).map(cleanCue).filter(Boolean);
  const cueCount = cues.length;
  if (!cueCount) {
    return {
      score: 0,
      threshold: NARRATOR_PRESENCE_THRESHOLD,
      passes: false,
      cueCount: 0,
      activePovCues: 0,
      conversationalCues: 0,
      memoryCallbackCues: 0,
      conciseReactiveCues: 0,
      presenceCoverage: 0,
      activePovShare: 0,
      conversationalShare: 0,
      deficiencies: ["No narrator cues were available for presence scoring."],
    };
  }

  const lower = cues.map((cue) => cue.toLocaleLowerCase("lv-LV"));
  const conversationalFlags = lower.map((cue) =>
    /\b(tu|tev|tevi|tavs|tava|jūs|jums|jūsu|pagaidi|uzmanīgi|kāpēc|tiešām|vai tad|nu ko|redzēsim)\b/i.test(cue) ||
    /\?/.test(cue) ||
    /^[^.!?]{0,45}[—-]\s*/.test(cue),
  );
  const memoryFlags = lower.map((cue) =>
    /\b(atcerēsimies|atceramies|atgriežamies|atgriezīsimies|solīj|teici|teica|pirms brīža|iepriekš|kā jau|vēlāk redzēsim|prognoz|callback|running gag)\w*/i.test(cue),
  );
  const conciseFlags = cues.map((cue) => words(cue) <= 24);
  const genericDescriptiveFlags = lower.map((cue) =>
    /^(?:tagad\s+)?(?:saimnieks|saimniece|viņš|viņa|viesi|dalībnieki)\s+(?:turpina|gatavo|liek|dodas|ierodas|sāk|pasniedz|ņem|atgriežas|gaida|klāj|ēd|runā|stāsta|izvēlas|pārrunā|novērtē)\b/i.test(cue) ||
    /^(?:tagad|tikmēr|tālāk|pēc tam|vakars|vakara noslēgumā)\s+(?:notiek|sākas|turpinās|redzam|seko|tiek|visi|ar)\b/i.test(cue),
  );
  const activePovFlags = lower.map((cue, index) =>
    !genericDescriptiveFlags[index] &&
    (conversationalFlags[index] ||
      memoryFlags[index] ||
      /\b(bet|tomēr|toties|tiesa|šķiet|izskatās|laikam|acīmredzot|protams|lieliski|par laimi|par nelaimi|pagaidām|gan|tikko|teorija|iebildum|joks)\w*/i.test(cue) ||
      /[?!]/.test(cue) ||
      conciseFlags[index]),
  );
  const presenceFlags = cues.map(
    (_cue, index) => activePovFlags[index] && (conversationalFlags[index] || memoryFlags[index] || conciseFlags[index]),
  );

  const activePovCues = activePovFlags.filter(Boolean).length;
  const conversationalCues = conversationalFlags.filter(Boolean).length;
  const memoryCallbackCues = memoryFlags.filter(Boolean).length;
  const conciseReactiveCues = conciseFlags.filter(Boolean).length;

  const coveredThirds = new Set<number>();
  presenceFlags.forEach((present, index) => {
    if (!present) return;
    coveredThirds.add(Math.min(2, Math.floor((index * 3) / Math.max(1, cueCount))));
  });
  const presenceCoverage = coveredThirds.size;

  const activePovShare = activePovCues / cueCount;
  const conversationalShare = conversationalCues / cueCount;
  const conciseShare = conciseReactiveCues / cueCount;
  const conversationalTarget = Math.max(1, Math.ceil(cueCount * 0.22));
  const memoryScore = memoryCallbackCues > 0 ? 1 : conversationalCues >= Math.max(2, conversationalTarget) ? 0.65 : 0;

  const score = Math.round(
    40 * clamp01(activePovShare / 0.75) +
      25 * clamp01(conversationalCues / conversationalTarget) +
      15 * memoryScore +
      10 * clamp01(presenceCoverage / 3) +
      10 * clamp01(conciseShare / 0.6),
  );

  const requiredCoverage = cueCount >= 6 ? 2 : 1;
  const deficiencies: string[] = [];
  if (activePovShare < 0.65) deficiencies.push("Too much VO remains observational or explanatory instead of carrying an active point of view.");
  if (conversationalCues < conversationalTarget) deficiencies.push("The narrator is not conversationally present often enough: add direct reactions, questions, challenges or participant-facing remarks where the source supports them.");
  if (presenceCoverage < requiredCoverage) deficiencies.push("Narrator presence is clustered in one part of the scene; distribute active fifth-diner behaviour across the opening, middle and closing development where legitimate beats exist.");
  if (memoryCallbackCues === 0 && cueCount >= 6) deficiencies.push("No memory/callback behaviour was detected. When the source supplies a promise, boast, contradiction or prediction, remember it and return to it later.");
  if (conciseShare < 0.45) deficiencies.push("Too many cues are polished explanatory sentences. Increase short, reactive, conversational interventions.");

  const passes =
    score >= NARRATOR_PRESENCE_THRESHOLD &&
    activePovShare >= 0.65 &&
    conversationalCues >= conversationalTarget &&
    presenceCoverage >= requiredCoverage;

  return {
    score,
    threshold: NARRATOR_PRESENCE_THRESHOLD,
    passes,
    cueCount,
    activePovCues,
    conversationalCues,
    memoryCallbackCues,
    conciseReactiveCues,
    presenceCoverage,
    activePovShare: Number(activePovShare.toFixed(3)),
    conversationalShare: Number(conversationalShare.toFixed(3)),
    deficiencies,
  };
}
