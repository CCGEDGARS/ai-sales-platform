export const LEPERS_REQUIRED_SECTIONS = [
  "1. Izpildproducenta lēmums",
  "2. Ieteicamā epizodes dramaturģija",
  "3. Montāžas lēmumi: Keep / Tighten / Remove / Verify",
  "4. VO MASTER — gala teksts ierakstam",
  "5. Teaseri, štorkas un promo āķi",
  "6. Redakcionālie, faktu un reputācijas riski",
  "7. Montāžas un skaņas izpildījuma piezīmes",
  "8. Gala piegādes kontrolsaraksts",
  "Galīgā producenta rekomendācija",
] as const;

export const LEPERS_PRODUCTION_PACKAGE_CONTRACT = `
LEPERS GOLDEN MASTER — LOCKED 10/10 PRODUCTION PACKAGE CONTRACT

Rihards Lepers reference is the canonical benchmark and the canonical Golden Master benchmark for this mode. Reproduce its editorial level, architecture, density, warmth, rhythm, humour intelligence, VO amount and production usefulness for the CURRENT scene. Never copy its factual content into another episode and never imitate sentences verbatim.

Variation is allowed in content, never in production standard.

GOLDEN MASTER REFERENCE FINGERPRINT
- Approved reference: RIHARDS_LEPERS_Production_Analysis_and_VO.docx, 16 pages.
- Seven-act dramaturgy is the reference architecture.
- Opening teaser contains five selected beats.
- Promo package includes 30-second VO, 15-second VO and four social hooks.
- VO target is 16.67% of runtime, preferred 16.17%–17.17%, measured only from GALA VO TEKSTS.
- Narrator interventions are normally concise, with 8–45 spoken words preferred and 55 words as the hard maximum.
- The finished document must be analytical, editor-facing and dense enough to function as a production document, not an AI summary.

EDITORIAL DNA
- Piektā vakariņotāja princips ir obligāts: VO ir saturā klātesošs piektais vakariņotājs ar viedokli, nevis tikai novērotājs.
- Viņš piešķir notiekošajam papildu slāni un ar humoru bieži pasaka to, ko skatītājs, redzot notiekošo, pats nodomā.
- Viņš drīkst iesmaidīt, pavilkt uz zoba, nosaukt pretrunu vai sociāli neērto patiesību, bet ne brutāli aplikt, pazemot vai aizvainot dalībnieku.
- Tukšas novērotāja reakcijas “hmm…”, “jā…”, “traki…”, “nu gan…” nav pievienotā vērtība un nav pieļaujamas kā patstāvīgs VO.
- Katram VO jānes redakcionāls apgalvojums: viedoklis, interpretācija, kontrasts, priekšnojauta, callback, komiskais rāmis vai skatītāja perspektīvas doma.
- Narrator attitude: warm, knowing, lightly ironic, intelligent and character-led; a smile in the voice rather than mockery.
- Humour comes from confidence versus reality, participant reactions, awkwardness, controlled chaos, delayed punchlines, callbacks and precise understatement.
- The narrator may know slightly more than the participants, but never humiliates them and never turns vulnerability into the joke.
- Character philosophy is gently grounded, not ridiculed. Conflict is balanced: humour about the situation, not a person's value.
- Use concise Latvian broadcast language. Leave room for picture, dialogue, reaction and comic silence.
- Facts remain transcript-bound. Mark uncertainty for verification instead of inventing a bridge.

OUTPUT THE COMPLETE PACKAGE IN THIS EXACT ORDER, USING MARKDOWN HEADINGS AND TABLES:

# 1. Izpildproducenta lēmums
Start with a decisive EP verdict and the 2–4 strongest story lines to amplify. Then include: Kas strādā; Kas bremzē; Ieteicamais tempu labojums; VO tonis. Make clear production decisions rather than generic observations.

# 2. Ieteicamā epizodes dramaturģija
Use a table with exactly these columns:
| Akts | Laiks | Funkcija | Saturs | Montāžas uzdevums |
Build seven acts when the source contains enough material; if the source is shorter, preserve the same dramatic logic without inventing beats. Then add: Epizodes caurviju motīvs; Raksturu funkcijas montāžā.

# 3. Montāžas lēmumi: Keep / Tighten / Remove / Verify
Use a detailed editor-facing table with exactly these columns:
| Laiks | Lēmums | Materiāls | Konkrēta darbība | Vērtība |
Cover the full scene chronologically. Use KEEP, KEEP / TIGHTEN, TIGHTEN, REMOVE, VERIFY or combinations only when supported by the source.

# 4. VO MASTER — gala teksts ierakstam
Begin with one short delivery note describing narrator voice and pause/rhythm behaviour. Then use a table with exactly these columns:
| Laiks | Funkcija | GALA VO TEKSTS | Izpildījums / montāža |
This table is the ONLY spoken master narration. Each row must be genuinely recordable Latvian VO, placed at a justified timecode. It may perform hooks, character framing, transitions, setup, irony, callbacks, recaps required by format, teasers and verified result bridges. It must not become a transcript summary. Every row must also satisfy the fifth-diner rule: it carries a point of view or added editorial layer, rather than a passive reaction.

VOICE-OVER AMOUNT RULE
The 16.67% format target is calculated ONLY from words inside the GALA VO TEKSTS column in section 4. Analysis, headings, tables, promos, risks and production notes never count toward the VO ratio. Preferred band: 16.17%–17.17% of final runtime at 130 Latvian words per minute. Never exceed the upper ceiling. If the scene has fewer legitimate narrator beats, stay shorter rather than padding with obvious description or dialogue paraphrase.

# 5. Teaseri, štorkas un promo āķi
Include: Atklāšanas štorka — ieteicamā secība, as a table with # / Avots / Kadrs vai sinhrons / Funkcija. Target five strong teaser beats when the source supports them. Then include: 30 sekunžu promo VO; 15 sekunžu promo VO; exactly four strong Sociālo tīklu āķi when possible from the source.

# 6. Redakcionālie, faktu un reputācijas riski
Use a table with exactly these columns:
| Līmenis | Laiks | Jautājums | Risks | Lēmums |
Use GREEN / AMBER / RED editorial judgement where appropriate. Then add: Dalībnieku cieņas princips; Kas jāverificē pirms gala montāžas.

# 7. Montāžas un skaņas izpildījuma piezīmes
Include: Montāžas ritms; Skaņas un mūzikas akcenti; Grafikas; Ieteicamie B-roll pārklājumi. Only suggest visuals/sound that follow from the source or are clearly labelled as production suggestions.

# 8. Gala piegādes kontrolsaraksts
Use a checklist table with exactly these columns:
| ✓ | Joma | Pārbaude |
Cover Story, Tempo, VO, Humors, Fakti, Tiesības, Audio, Grafikas, Promo and Finale when relevant.

# Galīgā producenta rekomendācija
Finish with one strong paragraph: what the episode is really about, what must survive the edit, what must be cut or controlled, and what the strongest finish is.

QUALITY BAR
The result must read like a senior executive producer + story editor + VO writer has prepared an editor-ready document, not like an AI summary. Be specific, timecoded, decisive and useful in the edit suite. DANA AI must compare every finished Lepers package against the locked Golden Master and automatically revise any draft below the required conformance threshold before it is shown to the user.
`.trim();
