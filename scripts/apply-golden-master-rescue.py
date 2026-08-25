from pathlib import Path

PATH = Path("app/api/generate-voiceover/route.ts")
text = PATH.read_text()

text = text.replace(
    'const MAX_BACKGROUND_CORRECTIONS = 3;',
    'const MAX_BACKGROUND_CORRECTIONS = 5;',
    1,
)

provider_anchor = '''function providerError(data: OpenAIResponseData, fallback: string) {\n  return data.error?.message || data.incomplete_details?.reason || fallback;\n}\n'''
repair_function = r'''

function goldenMasterRepairInstructions(goldenMaster: ReturnType<typeof scoreLepersGoldenMaster> | null) {
  if (!goldenMaster) return "No Golden Master repair map is required for this tone.";
  const d = goldenMaster.dimensions;
  const repairs: string[] = [];
  if (d.structure < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.structure) {
    repairs.push("STRUCTURE: restore every required section in exact order and all five canonical table schemas; do not rename headings or columns.");
  }
  if (d.depth < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.depth) {
    repairs.push("DEPTH: reach the reference-level deterministic target with about 1400+ analytical words outside VO MASTER, at least 10 edit rows, and at least 4 risk rows. Add only source-grounded analysis; never invent facts.");
  }
  if (d.voAmount < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.voAmount) {
    repairs.push("VO AMOUNT: keep only GALA VO TEKSTS spoken words inside the locked 16.17%–17.17% runtime band without recap or padding.");
  }
  if (d.humourAndPov < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.humourAndPov) {
    repairs.push("HUMOUR + POV: strengthen Fifth Dinner Guest opinion, contradiction, internal dialogue, viewer-thought questions and callbacks in legitimate VO beats; remove passive reactions and generic description.");
  }
  if (d.pace < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.pace) {
    repairs.push("PACE: keep VO cues concise, preferably 8–45 words, average roughly 12–35 words, and never exceed 55 words per cue.");
  }
  if (d.productionUsefulness < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.productionUsefulness) {
    repairs.push("PRODUCTION USEFULNESS: restore explicit KEEP, TIGHTEN, REMOVE and VERIFY decisions plus concrete Montāžas ritms, Skaņas un mūzikas akcenti, Grafikas and B-roll guidance where supported.");
  }
  if (d.promo < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.promo) {
    repairs.push("PROMO: provide 5 teaser beats, a 30 sekunžu promo VO, a 15 sekunžu promo VO, and 4 social hooks, all grounded in the current episode.");
  }
  if (d.characterInsight < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.characterInsight) {
    repairs.push("CHARACTER: restore EP LĒMUMS, Epizodes caurviju motīvs, Raksturu funkcijas montāžā, Kas strādā and Kas bremzē with specific source-grounded judgement.");
  }
  if (d.formatting < LEPERS_GOLDEN_MASTER_FINGERPRINT.weights.formatting) {
    repairs.push("FORMATTING: restore exact Golden Master headings, canonical table columns and Galīgā producenta rekomendācija formatting.");
  }
  return repairs.length ? repairs.join("\n") : "All deterministic Golden Master dimensions are already at target; preserve them exactly.";
}
'''
if 'function goldenMasterRepairInstructions' not in text:
    if provider_anchor not in text:
        raise SystemExit('providerError anchor not found')
    text = text.replace(provider_anchor, provider_anchor + repair_function, 1)

background_anchor = '''async function createLegacyResponse({\n'''
correction_helper = r'''
async function createCorrectionResponse({
  apiKey,
  system,
  user,
  metadata,
  previousResponseId,
}: {
  apiKey: string;
  system: string;
  user: string;
  metadata: Record<string, string>;
  previousResponseId: string;
}) {
  const configuredCorrectionModel = process.env.OPENAI_VOICEOVER_MODEL || PRIMARY_VOICEOVER_MODEL;
  let model = configuredCorrectionModel;
  let created = await createBackgroundResponse({
    apiKey,
    model,
    system,
    user,
    metadata,
    previousResponseId,
  });
  if (!created.response.ok && modelUnavailable(created.response, created.data) && model !== FALLBACK_VOICEOVER_MODEL) {
    model = FALLBACK_VOICEOVER_MODEL;
    created = await createBackgroundResponse({
      apiKey,
      model,
      system,
      user,
      metadata,
      previousResponseId,
    });
  }
  return { ...created, model };
}

'''
if 'async function createCorrectionResponse' not in text:
    if background_anchor not in text:
        raise SystemExit('createLegacyResponse anchor not found')
    text = text.replace(background_anchor, correction_helper + background_anchor, 1)

old_user_fragment = '''GOLDEN MASTER CONFORMANCE: current score ${goldenMaster?.score ?? 0}/100. Fix these measurable deficiencies without changing verified facts or losing the original Editorial brief: ${(goldenMaster?.deficiencies || []).join(" ")}\\n\\nCURRENT PACKAGE'''
new_user_fragment = '''GOLDEN MASTER CONFORMANCE: current score ${goldenMaster?.score ?? 0}/100. Current dimension scores: ${JSON.stringify(goldenMaster?.dimensions || {})}. Fix these measurable deficiencies without changing verified facts or losing the original Editorial brief: ${(goldenMaster?.deficiencies || []).join(" ")}\\n\\nPRECISION REPAIR MAP — repair deficient dimensions first and preserve dimensions already at full score:\\n${goldenMasterRepairInstructions(goldenMaster)}\\n\\nCURRENT PACKAGE'''
if old_user_fragment not in text:
    raise SystemExit('correction user fragment not found')
text = text.replace(old_user_fragment, new_user_fragment, 1)

old_correction = '''      const correction = await createBackgroundResponse({\n        apiKey,\n        model: FALLBACK_VOICEOVER_MODEL,\n        system: correctionSystem,\n        user: correctionUser,\n        metadata: metadataFor(finalRuntimeSeconds, correctionTone, "correction", correctionAttempt + 1),\n        previousResponseId: responseId,\n      });'''
new_correction = '''      const correction = await createCorrectionResponse({\n        apiKey,\n        system: correctionSystem,\n        user: correctionUser,\n        metadata: metadataFor(finalRuntimeSeconds, correctionTone, "correction", correctionAttempt + 1),\n        previousResponseId: responseId,\n      });'''
if old_correction not in text:
    raise SystemExit('hardcoded correction call not found')
text = text.replace(old_correction, new_correction, 1)

old_model = '''          model: correction.data.model || FALLBACK_VOICEOVER_MODEL,'''
new_model = '''          model: correction.data.model || correction.model,'''
if old_model not in text:
    raise SystemExit('correction model response anchor not found')
text = text.replace(old_model, new_model, 1)

PATH.write_text(text)
