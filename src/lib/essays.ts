export interface Essay {
  title: string
  subtitle: string
  date: string
  slug: string
  link: string
}

// Master list of all essays, oldest first.
// To add a new essay: add an entry at the bottom with title, subtitle, date, slug, and link.
export const ALL_ESSAYS: Essay[] = [
  { title: 'Why Most Fields Don\'t Learn', subtitle: 'And two of the too-few that figured it out', slug: 'why-most-fields-dont-learn', date: '2026-01-05', link: 'https://shapetheoryesvn.substack.com/p/why-most-fields-dont-learn' },
  { title: 'What Does "Works" Even Mean?', subtitle: 'Also: Shapes don\'t fail; they move', slug: 'the-hidden-question-behind-every', date: '2026-01-06', link: 'https://shapetheoryesvn.substack.com/p/the-hidden-question-behind-every' },
  { title: 'Definitional Capture: Summary', subtitle: '', slug: 'definitional-capture-summary', date: '2026-01-11', link: 'https://shapetheoryesvn.substack.com/p/definitional-capture-summary' },
  { title: 'The Shape That Isn\'t One', subtitle: 'How "this isn\'t schizophrenia" became a billing code, became infrastructure, became identity, became a cage', slug: 'the-shape-that-isnt-one', date: '2026-01-11', link: 'https://shapetheoryesvn.substack.com/p/the-shape-that-isnt-one' },
  { title: 'The Law of Adaptive System Progress: Summary', subtitle: 'A simplified overview of the formal paper, with an extended example', slug: 'the-law-of-adaptive-system-progress', date: '2026-01-11', link: 'https://shapetheoryesvn.substack.com/p/the-law-of-adaptive-system-progress' },
  { title: 'Cookies for Things That Matter', subtitle: 'Who closes the loop, and what the cookie monsters have eaten', slug: 'cookies-for-things-that-matter', date: '2026-01-11', link: 'https://shapetheoryesvn.substack.com/p/cookies-for-things-that-matter' },
  { title: 'Cookies for Cancer', subtitle: 'What ad tech knows about you that oncology doesn\'t know about your tumor', slug: 'cookies-for-cancer', date: '2026-01-11', link: 'https://shapetheoryesvn.substack.com/p/cookies-for-cancer' },
  { title: 'The Cure is a Verb', subtitle: 'Are we in?', slug: 'the-cure-is-a-verb', date: '2026-01-12', link: 'https://shapetheoryesvn.substack.com/p/the-cure-is-a-verb' },
  { title: 'Shape Theory: Summary', subtitle: '', slug: 'shape-theory-summary', date: '2026-01-12', link: 'https://shapetheoryesvn.substack.com/p/shape-theory-summary' },
  { title: 'Do Your Own Research', subtitle: 'How Shape Theory makes that actually possible', slug: 'do-your-own-research', date: '2026-01-13', link: 'https://shapetheoryesvn.substack.com/p/do-your-own-research' },
  { title: 'What AI Is and Isn\'t', subtitle: 'A Framework for Evaluating AI Companies', slug: 'what-ai-is-and-isnt', date: '2026-01-13', link: 'https://shapetheoryesvn.substack.com/p/what-ai-is-and-isnt' },
  { title: 'Accumulated Wisdom', subtitle: 'The "A" in AI is Wrong', slug: 'accumulated-wisdom', date: '2026-01-14', link: 'https://shapetheoryesvn.substack.com/p/accumulated-wisdom' },
  { title: 'The Rosetta Stone for Behavioral Health', subtitle: 'Why therapy research shows modest effects, and what to do about it', slug: 'the-rosetta-stone-for-behavioral', date: '2026-01-14', link: 'https://shapetheoryesvn.substack.com/p/the-rosetta-stone-for-behavioral' },
  { title: 'Closing the Loop for Everything', subtitle: 'The TCP/IP for Human Development', slug: 'closing-the-loop-for-everything', date: '2026-01-15', link: 'https://shapetheoryesvn.substack.com/p/closing-the-loop-for-everything' },
  { title: 'The Three Hidden Disagreements', subtitle: 'Why every argument about "what something is" is actually three arguments pretending to be one', slug: 'the-three-hidden-disagreements', date: '2026-01-15', link: 'https://shapetheoryesvn.substack.com/p/the-three-hidden-disagreements' },
  { title: 'The Cost of ShapeFit', subtitle: 'Shape Theory and the Energy of Activation', slug: 'the-cost-of-shapefit', date: '2026-01-15', link: 'https://shapetheoryesvn.substack.com/p/the-cost-of-shapefit' },
  { title: 'There Are No Bad Decisions', subtitle: '', slug: 'there-are-no-bad-decisions', date: '2026-01-16', link: 'https://shapetheoryesvn.substack.com/p/there-are-no-bad-decisions' },
  { title: 'I Wish I Was Crazy, But Unfortunately I Am Not', subtitle: 'My inbox is open', slug: 'i-wish-i-was-crazy-but-unfortunately', date: '2026-01-16', link: 'https://shapetheoryesvn.substack.com/p/i-wish-i-was-crazy-but-unfortunately' },
  { title: 'First, Do Harm', subtitle: 'Your oncologist should be a serial killer', slug: 'first-do-harm', date: '2026-01-17', link: 'https://shapetheoryesvn.substack.com/p/first-do-harm' },
  { title: 'The Balance', subtitle: 'What accumulated wisdom looks like at civilizational scale', slug: 'the-balance', date: '2026-01-17', link: 'https://shapetheoryesvn.substack.com/p/the-balance' },
  { title: 'The Universal Balance Initiative (UBI)', subtitle: 'A tribute to the heroes of the citizen scientist era', slug: 'the-universal-balance-initiative', date: '2026-01-17', link: 'https://shapetheoryesvn.substack.com/p/the-universal-balance-initiative' },
  { title: 'The Engine Has a Name', subtitle: 'She opens', slug: 'the-engine-has-a-name', date: '2026-01-17', link: 'https://shapetheoryesvn.substack.com/p/the-engine-has-a-name' },
  { title: 'The Religion of The Balance', subtitle: 'For everyone who left faith but kept the longing', slug: 'the-religion-of-the-balance', date: '2026-01-17', link: 'https://shapetheoryesvn.substack.com/p/the-religion-of-the-balance' },
  { title: 'The Shape of Entertainment', subtitle: 'Why you hate country music (and why you\'re wrong)', slug: 'the-shape-of-entertainment', date: '2026-01-18', link: 'https://shapetheoryesvn.substack.com/p/the-shape-of-entertainment' },
  { title: 'The Human-in-the-Loop Singularity', subtitle: 'The singularity isn\'t coming. Not the one they promised and/or feared.', slug: 'the-human-in-the-loop-singularity', date: '2026-01-19', link: 'https://shapetheoryesvn.substack.com/p/the-human-in-the-loop-singularity' },
  { title: 'Trust Me, Bro', subtitle: 'On the delegation of priors, the obligation to surface them, and why institutions that demand trust without transparency are running a con', slug: 'trust-me-bro', date: '2026-01-22', link: 'https://shapetheoryesvn.substack.com/p/trust-me-bro' },
  { title: 'The Empty Chair', subtitle: 'Why It Is Nobody\'s Job to Cure You', slug: 'the-empty-chair', date: '2026-01-22', link: 'https://shapetheoryesvn.substack.com/p/the-empty-chair' },
  { title: 'Real-World Learning', subtitle: 'Allowing Healthcare to tell us what it needs', slug: 'real-world-learning', date: '2026-01-24', link: 'https://shapetheoryesvn.substack.com/p/real-world-learning' },
  { title: 'The Given', subtitle: 'The Tradeoff Without a Name', slug: 'the-given', date: '2026-01-24', link: 'https://shapetheoryesvn.substack.com/p/the-given' },
  { title: 'A Given', subtitle: 'A conversation about a word that could not survive', slug: 'a-given', date: '2026-01-25', link: 'https://shapetheoryesvn.substack.com/p/a-given' },
  { title: 'Your Actual Health Record', subtitle: 'The One You Own', slug: 'your-actual-health-record', date: '2026-01-25', link: 'https://shapetheoryesvn.substack.com/p/your-actual-health-record' },
  { title: 'Ballad of the Cure', subtitle: 'How she opens and loops close', slug: 'ballad-of-the-cure', date: '2026-01-25', link: 'https://shapetheoryesvn.substack.com/p/ballad-of-the-cure' },
  { title: 'Sell Your Data', subtitle: 'The job you already have, the wages you\'re not getting, and how to fix it', slug: 'sell-your-data', date: '2026-01-27', link: 'https://shapetheoryesvn.substack.com/p/sell-your-data' },
  { title: 'The Unifying Theory', subtitle: 'What capitalism and socialism both got wrong, and how to fix it', slug: 'the-unifying-theory', date: '2026-01-27', link: 'https://shapetheoryesvn.substack.com/p/the-unifying-theory' },
  { title: 'The Flex', subtitle: 'What your shape can become, at what cost, and why it matters', slug: 'the-flex', date: '2026-01-29', link: 'https://shapetheoryesvn.substack.com/p/the-flex' },
  { title: 'The Shape of Intelligence', subtitle: 'Why we can\'t define it, why we\'re afraid to measure it, and why that has to change', slug: 'the-shape-of-intelligence', date: '2026-01-30', link: 'https://shapetheoryesvn.substack.com/p/the-shape-of-intelligence' },
  { title: 'The Algorithm', subtitle: 'Why we instinctively fear it, why the free market defense fails, and why closing loops on well-being is now urgent', slug: 'the-algorithm', date: '2026-01-30', link: 'https://shapetheoryesvn.substack.com/p/the-algorithm' },
  { title: 'The Wrong Question', subtitle: 'A Shape Theory analysis of a debate that shouldn\'t exist', slug: 'the-wrong-question', date: '2026-01-31', link: 'https://shapetheoryesvn.substack.com/p/the-wrong-question' },
  { title: 'What Is Love?', subtitle: 'Baby don\'t hurt me, don\'t hurt me, no more', slug: 'what-is-love', date: '2026-02-02', link: 'https://shapetheoryesvn.substack.com/p/what-is-love' },
  { title: 'The Zealots', subtitle: 'How to save civilization', slug: 'the-zealots', date: '2026-02-03', link: 'https://shapetheoryesvn.substack.com/p/the-zealots' },
  { title: 'New Fences', subtitle: 'What we protect instead of the patient', slug: 'the-new-fences', date: '2026-02-05', link: 'https://shapetheoryesvn.substack.com/p/the-new-fences' },
  { title: 'THE Fence', subtitle: 'The most load-bearing structure no one is measuring', slug: 'the-fence', date: '2026-02-05', link: 'https://shapetheoryesvn.substack.com/p/the-fence' },
  { title: 'The Desk', subtitle: 'The fence we strap our children to', slug: 'the-desk', date: '2026-02-05', link: 'https://shapetheoryesvn.substack.com/p/the-desk' },
  { title: 'The Tap', subtitle: 'A fossil of a decision', slug: 'the-tap', date: '2026-02-05', link: 'https://shapetheoryesvn.substack.com/p/the-tap' },
  { title: 'The Odds', subtitle: 'New lessons from the scoreboards', slug: 'the-odds', date: '2026-02-07', link: 'https://shapetheoryesvn.substack.com/p/the-odds' },
  { title: 'The 144,000', subtitle: 'On salvation', slug: 'the-144000', date: '2026-02-07', link: 'https://shapetheoryesvn.substack.com/p/the-144000' },
  { title: 'The Camera', subtitle: 'On seeing America clearly', slug: 'the-camera', date: '2026-02-07', link: 'https://shapetheoryesvn.substack.com/p/the-camera' },
  { title: 'The Shape of Loneliness', subtitle: 'The epidemic without a diagnosis', slug: 'the-shape-of-loneliness', date: '2026-02-07', link: 'https://shapetheoryesvn.substack.com/p/the-shape-of-loneliness' },
  { title: 'Firmware and Software', subtitle: 'Why we sort each other wrong, and what it would take to stop', slug: 'firmware-and-software', date: '2026-02-07', link: 'https://shapetheoryesvn.substack.com/p/firmware-and-software' },
  { title: 'Uninstalled', subtitle: 'We removed the software. The firmware is still running.', slug: 'uninstalled', date: '2026-02-08', link: 'https://shapetheoryesvn.substack.com/p/uninstalled' },
  { title: 'Cousins', subtitle: 'Linnaeus built the fence in 1735. We still can\'t move it.', slug: 'cousins', date: '2026-02-08', link: 'https://shapetheoryesvn.substack.com/p/cousins' },
  { title: 'The Landfill', subtitle: 'What 181 zettabytes can\'t teach you and 10 petabytes could', slug: 'the-landfill', date: '2026-02-09', link: 'https://shapetheoryesvn.substack.com/p/the-landfill' },
  { title: 'The Pipeline', subtitle: 'What we don\'t count, who pays, and the only intervention that will work', slug: 'the-pipeline', date: '2026-02-10', link: 'https://shapetheoryesvn.substack.com/p/the-pipeline' },
  { title: 'No, You Don\'t Have ADHD', subtitle: 'You just see clearly', slug: 'no-you-dont-have-adhd', date: '2026-02-10', link: 'https://shapetheoryesvn.substack.com/p/no-you-dont-have-adhd' },
  { title: 'Food Groups Aren\'t Real', subtitle: 'It\'s an embarrassment', slug: 'food-groups-arent-real', date: '2026-02-10', link: 'https://shapetheoryesvn.substack.com/p/food-groups-arent-real' },
  { title: 'Rethinking Provenance', subtitle: 'Who deserves credit for what you know', slug: 'rethinking-provenance', date: '2026-02-10', link: 'https://shapetheoryesvn.substack.com/p/rethinking-provenance' },
  { title: 'amirite?', subtitle: 'What humanity owes each other', slug: 'amirite', date: '2026-02-13', link: 'https://shapetheoryesvn.substack.com/p/amirite' },
  { title: 'The Acorn', subtitle: 'Once again, three debates pretending to be one', slug: 'the-acorn', date: '2026-02-13', link: 'https://shapetheoryesvn.substack.com/p/the-acorn' },
  { title: 'Nemesis', subtitle: 'What the Greeks knew about certainty that we keep forgetting', slug: 'nemesis', date: '2026-02-14', link: 'https://shapetheoryesvn.substack.com/p/nemesis' },
  { title: 'The Given', subtitle: 'A tale', slug: 'the-given-eb5', date: '2026-02-14', link: 'https://shapetheoryesvn.substack.com/p/the-given-eb5' },
  { title: 'The Steaks', subtitle: 'We can\'t learn about food when we\'re too busy being right about it', slug: 'the-steaks', date: '2026-02-16', link: 'https://shapetheoryesvn.substack.com/p/the-steaks' },
  { title: 'Radical', subtitle: 'Dude, like totally', slug: 'radical', date: '2026-02-21', link: 'https://shapetheoryesvn.substack.com/p/radical' },
  { title: 'The Case for a Lie', subtitle: 'In defense of not showing a whole shape all the time', slug: 'the-case-for-a-lie', date: '2026-02-23', link: 'https://shapetheoryesvn.substack.com/p/the-case-for-a-lie' },
  { title: 'Imagine', subtitle: 'No countries? Measure first.', slug: 'imagine', date: '2026-02-24', link: 'https://shapetheoryesvn.substack.com/p/imagine' },
  { title: 'FAFO', subtitle: 'iykyk', slug: 'fafo', date: '2026-02-24', link: 'https://shapetheoryesvn.substack.com/p/fafo' },
]

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function getEssays(): (Essay & { formattedDate: string })[] {
  return ALL_ESSAYS.map(essay => ({
    ...essay,
    formattedDate: formatDate(essay.date),
  }))
}
