// National core build-out (October 2026): English, science, social studies, computing
// and enrichment skills that close gaps in the coverage report.
//
// Authored banks are original questions written for Red Teddy Tutor: three difficulty
// tiers, one correct answer each, a hint that teaches without giving the answer away.
// Computed items (wave speed, bits and bytes, loops, compound interest, note values,
// equation balancing) are re-solved in scripts/core.test.mjs. Nothing is copied from
// textbooks or commercial curricula.
import { int, pick, choice, input } from './kit.js';

// [question, answer, [wrong...], hint, misconception-for-first-wrong?]
function fromBank(rand, items) {
  const [prompt, answer, wrong, hint, mc] = pick(rand, items);
  return choice(rand, {
    prompt, answer, size: Math.min(4, wrong.length + 1),
    wrong: wrong.map((value, i) => ({ value, ...(i === 0 && mc ? { misconception: mc } : {}) })),
    hints: [hint, 'Rule out the answers you are sure are wrong, then compare what is left.'],
  });
}
const bank = (b) => (d, rand) => fromBank(rand, b[d - 1]);

// ======================= English language arts =======================
const DIGRAPHS = [
  [
    ['Which word begins with the sound “sh”?', 'ship', ['sip', 'chip'], 'Say each word slowly. Listen to the very first sound.', 'sound-order'],
    ['Which word begins with the sound “ch”?', 'chin', ['shin', 'thin'], '“ch” is the sound at the start of “cheese”.'],
    ['Which word begins with the sound “th”?', 'thumb', ['tub', 'some'], 'Put your tongue between your teeth for “th”.'],
    ['Which word ends with the sound “sh”?', 'fish', ['fit', 'fill'], 'Say each word and listen to the last sound.'],
  ],
  [
    ['Which letters complete the word: ___ip (a boat)?', 'sh', ['ch', 'th'], 'Say “ship” slowly. What sound do you hear first?'],
    ['Which letters complete the word: du___ (a bird that quacks)?', 'ck', ['sh', 'th'], 'After a short vowel, the /k/ sound at the end is often spelled “ck”.'],
    ['Which letters complete the word: ___ale (a very large sea animal)?', 'wh', ['ch', 'sh'], 'Question words like “what” and “when” start the same way.'],
    ['Which letters complete the word: ba___ (time to get clean)?', 'th', ['sh', 'ch'], 'Say “bath”. Is your tongue between your teeth at the end?'],
  ],
  [
    ['How many sounds are in the word “chop”?', '3', ['4', '2'], 'The two letters “ch” make one sound: ch-o-p.', 'sound-order'],
    ['How many sounds are in the word “shell”?', '3', ['5', '4'], '“sh” is one sound and “ll” is one sound: sh-e-ll.'],
    ['Which word has the same ending sound as “wish”?', 'dash', ['dot', 'much'], 'Listen to the very last sound of each word.'],
    ['Which word has a digraph (two letters, one sound)?', 'thick', ['trip', 'stop'], 'Look for two letters that make one new sound together.'],
  ],
];

const VOWEL_PATTERNS = [
  [
    ['Add a silent e to “cap”. What word do you make?', 'cape', ['cap', 'cop'], 'A silent e at the end makes the vowel say its name.'],
    ['Which word has a long a sound?', 'cake', ['cat', 'can'], 'Long a says its name, “ay”.'],
    ['Which word has a long i sound?', 'kite', ['kit', 'kick'], 'Long i sounds like the word “eye”.'],
    ['Add a silent e to “hop”. What word do you make?', 'hope', ['hoop', 'hip'], 'The e is silent but makes the o say its name.'],
  ],
  [
    ['Which word has the vowel team “ai” making a long a sound?', 'rain', ['ran', 'ring'], '“When two vowels go walking…” often the first one says its name.'],
    ['Which word has the vowel team “ee”?', 'tree', ['ten', 'tie'], 'Look for two e’s together.'],
    ['Which word rhymes with “boat” and has the same vowel team?', 'coat', ['cot', 'cute'], 'Find the word spelled with “oa”.'],
    ['Which spelling is right for a word that means a path for cars?', 'road', ['rode', 'rod'], 'Think of the vowel team “oa”.'],
  ],
  [
    ['Which word has an r-controlled vowel?', 'farm', ['fan', 'fame'], 'When r follows a vowel, the vowel makes a new sound, like “ar” in car.'],
    ['Which word has the same vowel sound as “night”?', 'pie', ['pin', 'pig'], '“igh”, “ie” and i_e can all make the long i sound.'],
    ['Which word has the same vowel sound as “boy”?', 'coin', ['corn', 'cone'], '“oy” and “oi” make the same sound.'],
    ['Which word has the same vowel sound as “cow”?', 'loud', ['load', 'low'], '“ow” in cow and “ou” in out make the same sound.'],
  ],
];

const SYLLABLES = [
  [
    ['How many syllables are in “sunset”?', '2', ['1', '3'], 'Clap as you say it: sun-set.'],
    ['How many syllables are in “dog”?', '1', ['2', '3'], 'Put your hand under your chin. How many times does it drop?'],
    ['How many syllables are in “rabbit”?', '2', ['1', '3'], 'Clap: rab-bit.'],
    ['How many syllables are in “cupcake”?', '2', ['1', '3'], 'It is two small words joined together.'],
  ],
  [
    ['How many syllables are in “banana”?', '3', ['2', '4'], 'Clap: ba-na-na.'],
    ['How many syllables are in “elephant”?', '3', ['2', '4'], 'Clap: el-e-phant.'],
    ['Which word has three syllables?', 'butterfly', ['button', 'bus'], 'Clap each word.'],
    ['How many syllables are in “basket”?', '2', ['3', '1'], 'Every syllable has one vowel sound.'],
  ],
  [
    ['How many syllables are in “caterpillar”?', '4', ['3', '5'], 'Clap: cat-er-pil-lar.'],
    ['How should “napkin” be split into syllables?', 'nap-kin', ['na-pkin', 'napk-in'], 'Between two consonants, split the word: VC/CV.'],
    ['How should “robot” be split into syllables?', 'ro-bot', ['rob-ot', 'r-obot'], 'The first vowel is long (it says its name), so the syllable ends after it.'],
    ['Which word has an open first syllable (ending in a long vowel)?', 'tiger', ['tipped', 'timber'], 'An open syllable ends in a vowel that says its name: ti-ger.'],
  ],
];

const PARTS_OF_SPEECH = [
  [
    ['Which word is a noun: “The happy dog ran fast.”?', 'dog', ['happy', 'ran'], 'A noun names a person, place, thing or animal.'],
    ['Which word is a verb: “Sam kicked the red ball.”?', 'kicked', ['red', 'ball'], 'A verb shows an action.'],
    ['Which word is an adjective: “We saw a tall tree.”?', 'tall', ['saw', 'tree'], 'An adjective describes a noun.'],
    ['Which word is a noun: “My sister sings loudly.”?', 'sister', ['sings', 'loudly'], 'Which word names a person?'],
  ],
  [
    ['Which word is an adverb: “The turtle moved slowly.”?', 'slowly', ['turtle', 'moved'], 'An adverb tells how, when or where an action happens.'],
    ['Which word is a pronoun: “Maria said she would help.”?', 'she', ['Maria', 'help'], 'A pronoun takes the place of a noun.'],
    ['What is the plural of “child”?', 'children', ['childs', 'childes'], 'Some plurals are irregular and do not add -s.'],
    ['Which word is a conjunction: “I wanted to swim, but it rained.”?', 'but', ['wanted', 'rained'], 'A conjunction joins words or ideas.'],
  ],
  [
    ['Which word is a preposition: “The cat hid under the bed.”?', 'under', ['hid', 'bed'], 'A preposition shows where something is in relation to something else.'],
    ['In “Running is good exercise,” what part of speech is “Running”?', 'Noun (a gerund)', ['Verb', 'Adjective'], 'What is the subject of the sentence? Here the -ing word names an activity.'],
    ['Which word is an abstract noun?', 'courage', ['castle', 'captain'], 'An abstract noun names an idea or feeling you cannot touch.'],
    ['Which word is an interjection?', 'Wow', ['Quickly', 'Above'], 'An interjection shows sudden feeling.'],
  ],
];

const VERB_TENSES = [
  [
    ['Which verb is in the past tense: “Yesterday I ___ to the park.”?', 'walked', ['walk', 'will walk'], '“Yesterday” tells you it already happened.'],
    ['Which verb shows the future: “Tomorrow we ___ a cake.”?', 'will bake', ['baked', 'bakes'], '“Tomorrow” has not happened yet.'],
    ['What is the past tense of “jump”?', 'jumped', ['jumpt', 'jumping'], 'Most verbs add -ed for the past.'],
    ['What is the past tense of “go”?', 'went', ['goed', 'gone'], '“Go” is irregular.'],
  ],
  [
    ['What is the past tense of “bring”?', 'brought', ['bringed', 'brang'], '“Bring” is an irregular verb.'],
    ['Which sentence keeps the same tense?', 'She opened the door and walked in.', ['She opened the door and walks in.', 'She opens the door and walked in.'], 'Both actions happened at the same time, so use the same tense.'],
    ['Which sentence uses the progressive tense?', 'The birds are singing.', ['The birds sang.', 'The birds sing.'], 'The progressive uses a form of “be” with an -ing verb.'],
    ['What is the past tense of “write”?', 'wrote', ['writed', 'written'], '“Written” needs a helper, like “has written”.'],
  ],
  [
    ['Which sentence uses the perfect tense?', 'I have finished my homework.', ['I finish my homework.', 'I am finishing my homework.'], 'The perfect tense uses has, have or had with a past participle.'],
    ['Choose the correct verb: “By the time we arrived, the movie ___.”', 'had started', ['has started', 'starts'], 'One past event happened before another past event.'],
    ['Which sentence has an inappropriate shift in tense?', 'He runs to the store and bought milk.', ['He ran to the store and bought milk.', 'He runs to the store and buys milk.'], 'Look for a sentence where the time changes for no reason.'],
    ['Choose the correct verb: “If I ___ you, I would study.”', 'were', ['was', 'am'], 'Wishes and impossible conditions use the subjunctive “were”.'],
  ],
];

const SENTENCES = [
  [
    ['Which is a complete sentence?', 'The bird flew away.', ['The bird.', 'Flew away quickly.'], 'A sentence needs a subject (who) and a verb (did what).'],
    ['What kind of sentence is “Close the door.”?', 'A command', ['A question', 'An exclamation'], 'It tells someone to do something.'],
    ['Which is a question?', 'Where is my hat?', ['My hat is red.', 'Find my hat.'], 'A question asks something and ends with a question mark.'],
    ['Which is a sentence fragment?', 'After the game.', ['We won the game.', 'The game ended late.'], 'A fragment is missing a subject or a verb, or does not finish its thought.'],
  ],
  [
    ['Which is a run-on sentence?', 'I like pizza it is my favorite.', ['I like pizza. It is my favorite.', 'I like pizza because it is my favorite.'], 'Two complete thoughts need a period, or a comma with a joining word.'],
    ['Which is a compound sentence?', 'It was cold, so we wore coats.', ['It was cold.', 'Cold and windy days.'], 'A compound sentence joins two complete sentences with a conjunction.'],
    ['How can you fix “The dog barked the cat ran”?', 'The dog barked, and the cat ran.', ['The dog barked the cat, ran.', 'The dog, barked the cat ran.'], 'Join the two sentences with a comma and a conjunction.'],
    ['Which word best joins: “I was tired, ___ I kept going.”', 'but', ['so', 'because'], 'The second idea is a surprise after the first.'],
  ],
  [
    ['Which is a complex sentence?', 'Because it rained, the game was canceled.', ['It rained, and the game was canceled.', 'The game was canceled.'], 'A complex sentence has a dependent clause that cannot stand alone.'],
    ['Which revision fixes the misplaced modifier: “Covered in mud, Mom washed the dog.”?', 'Mom washed the dog, which was covered in mud.', ['Mom, covered in mud, washed the dog.', 'Covered in mud, the dog Mom washed.'], 'A describing phrase should sit next to the thing it describes.'],
    ['Which sentence uses parallel structure?', 'She likes hiking, swimming and biking.', ['She likes hiking, swimming and to bike.', 'She likes to hike, swimming and biking.'], 'Items in a list should have the same form.'],
    ['Which sentence is written in the active voice?', 'The chef cooked the meal.', ['The meal was cooked by the chef.', 'The meal was cooked.'], 'In the active voice the subject does the action.'],
  ],
];

const THEME = [
  [
    ['A fox cannot reach some grapes, so it says they are probably sour anyway. What lesson does the story teach?', 'People sometimes pretend they did not want what they cannot have.', ['Grapes grow on vines.', 'Foxes are fast runners.'], 'A lesson is a message about life, not a fact from the story.'],
    ['Lin practices piano every day and finally plays the song perfectly at the concert. What is the theme?', 'Hard work pays off.', ['Concerts are loud.', 'Pianos have keys.'], 'What does the main character learn or show?'],
    ['A boy tells lies so often that no one believes him when he tells the truth. What is the lesson?', 'If you lie, people may not trust you even when you tell the truth.', ['Boys like to tell stories.', 'Telling the truth is boring.'], 'Think about what happened because of the boy’s choices.'],
  ],
  [
    ['Two friends argue over a game, then realize the friendship matters more than winning. Which is the best theme statement?', 'Friendship is more important than winning.', ['Friendship.', 'Two friends play a game.'], 'A theme statement is a full sentence about life, not one word or a summary.'],
    ['A girl is scared to try out for the team, tries anyway and makes it. Which detail best supports the theme “courage means acting despite fear”?', 'Her hands shook as she stepped onto the field.', ['The field was green.', 'Practice was on Tuesdays.'], 'Which detail shows both fear and action?'],
    ['A new student is lonely until one classmate invites her to lunch. What theme does the story develop?', 'Small acts of kindness can make a big difference.', ['Lunch is at noon.', 'New schools are big.'], 'What changed, and why did it matter?'],
  ],
  [
    ['How is a theme different from a topic?', 'A topic is a subject; a theme is the message the text gives about it.', ['They mean the same thing.', 'A theme is always one word.'], 'Compare “loyalty” with “loyalty can be tested by hard choices”.'],
    ['A character gains wealth but loses every friend, and ends the story alone. Which theme is best supported?', 'Chasing money at any cost can leave a person empty.', ['Money is useful.', 'Everyone wants to be rich.'], 'Look at how the story ends for the character.'],
    ['Which is the best evidence that a story’s theme is “pride comes before a fall”?', 'The champion skips training, sure no one can beat him, and loses the final.', ['The champion has won many races.', 'The race is held in summer.'], 'The evidence must link the pride to the downfall.'],
  ],
];

const AUTHOR_PURPOSE = [
  [
    ['An article explains how bees make honey. What is the author’s main purpose?', 'To inform', ['To persuade', 'To entertain'], 'Is the author teaching, convincing or telling a story for fun?'],
    ['A poster says, “Vote for Ava. She will make recess longer!” What is its purpose?', 'To persuade', ['To inform', 'To entertain'], 'Is it trying to get you to do something?'],
    ['A funny story about a pig who wants to fly. What is the author’s purpose?', 'To entertain', ['To persuade', 'To inform'], 'Why would someone write a silly story?'],
    ['A story says, “I walked to the river.” Who is telling the story?', 'A character in the story (first person)', ['A narrator outside the story (third person)', 'The reader'], 'The words “I” and “we” point to first person.'],
  ],
  [
    ['Which sentence is from a third-person narrator?', 'Jack opened the box and gasped.', ['I opened the box and gasped.', 'We opened the box and gasped.'], 'Third person uses he, she, they or names.'],
    ['A writer lists facts about recycling and ends, “So start recycling today!” What are the two purposes?', 'To inform and to persuade', ['To entertain only', 'To inform only'], 'Look at both the facts and the last sentence.'],
    ['An author of a book about sharks only describes shark attacks. What might the author want readers to feel?', 'Fear of sharks', ['Love of sharks', 'Boredom'], 'What the author chooses to include shows their point of view.'],
    ['In a story told by a dog, how might events seem different?', 'Events are seen through the dog’s senses and feelings.', ['Nothing changes.', 'The story has no narrator.'], 'Point of view shapes what we learn.'],
  ],
  [
    ['A company that sells sugary drinks publishes a report saying sugar is harmless. Why should a reader be careful?', 'The author may be biased because they profit from the claim.', ['Reports are always false.', 'Sugar is not a real topic.'], 'Ask who wrote it and what they gain.'],
    ['How does an omniscient narrator differ from a limited one?', 'An omniscient narrator knows every character’s thoughts.', ['An omniscient narrator is always a character.', 'There is no difference.'], '“Omni” means all.'],
    ['An author writes, “Some say homework helps; others disagree. Here is what research shows.” What is the author doing?', 'Acknowledging other viewpoints before presenting evidence', ['Ignoring opposing views', 'Telling a fictional story'], 'Notice how the author treats opinions that differ.'],
    ['Why might an author use dramatic irony?', 'To build tension because the reader knows something a character does not', ['To confuse the reader on purpose', 'To list facts'], 'Think about the gap between what the reader and the character know.'],
  ],
];

const RESEARCH = [
  [
    ['You want facts about frogs for a report. Which source is best?', 'A science book about frogs', ['A cartoon about a talking frog', 'A friend’s guess'], 'Facts come from sources written to inform.'],
    ['What is a fact?', 'Something that can be proven true', ['Something someone feels', 'A story that is made up'], 'Can you check it?'],
    ['Which is an opinion?', 'Frogs are the cutest animals.', ['Frogs are amphibians.', 'Frogs lay eggs.'], 'An opinion is what someone thinks or feels.'],
    ['Where in a book can you find which page tells about a topic?', 'The index', ['The cover', 'The title'], 'It is an alphabetical list at the back.'],
  ],
  [
    ['Which website is most likely to give reliable health facts?', 'A government health agency site (.gov)', ['An anonymous blog selling vitamins', 'A meme on social media'], 'Ask who made it and whether they want to sell you something.'],
    ['Why should you write down the sources you use?', 'So readers can check your information and you give credit', ['To make the report longer', 'Because teachers like lists'], 'Using someone’s ideas without credit is plagiarism.'],
    ['What is paraphrasing?', 'Putting someone’s ideas into your own words and citing them', ['Copying a paragraph word for word', 'Making up a quote'], 'You still credit the source when you paraphrase.'],
    ['A photo online shows a shark swimming down a flooded highway. What should you do first?', 'Check whether trusted news sources report it', ['Share it right away', 'Assume it is real because it looks real'], 'Images can be edited or shared out of context.'],
  ],
  [
    ['Which is a primary source about a 1960s protest?', 'A diary written by a marcher at the protest', ['A 2020 textbook chapter about it', 'An encyclopedia summary'], 'A primary source was created at the time by someone involved.'],
    ['An article has no author, no date and many spelling errors. What does that suggest?', 'It may not be reliable; look for a better source.', ['It is very reliable.', 'It must be new.'], 'Use authority, accuracy and currency to judge a source.'],
    ['A headline reads “Scientists SHOCKED by miracle food!” What technique is it using?', 'Sensational language to get clicks', ['Neutral reporting', 'Citing evidence'], 'Strong emotional words can be a warning sign.'],
    ['Two sources disagree about a statistic. What is the best next step?', 'Check the original data and a third reliable source', ['Pick the one you like better', 'Leave the statistic out without checking'], 'Trace claims to where they came from.'],
  ],
];

const REVISION = [
  [
    ['Which word best connects the steps: “First, mix the flour. ___, add the eggs.”', 'Next', ['Because', 'However'], 'Which word tells order?'],
    ['Which is the best opening sentence for a report about dolphins?', 'Dolphins are clever ocean mammals that live in groups called pods.', ['I like stuff.', 'This is about something.'], 'A good opening tells the topic clearly.'],
    ['Which sentence adds a detail to “We went to the beach.”?', 'We went to the sunny beach and built a sandcastle.', ['We went.', 'Beach.'], 'Details tell more about who, what, where or how.'],
    ['Which is the best ending for a story about finding a lost puppy?', 'Max hugged the puppy and promised to keep the gate closed.', ['The end.', 'Puppies have four legs.'], 'A good ending wraps up the problem.'],
  ],
  [
    ['Which transition shows contrast?', 'On the other hand', ['In addition', 'For example'], 'Contrast shows a difference.'],
    ['Which revision is more precise than “The food was good”?', 'The soup was rich, creamy and full of garlic.', ['The food was really good.', 'The food was nice.'], 'Precise words paint a clear picture.'],
    ['Which sentence does NOT belong in a paragraph about how plants grow?', 'My uncle has a red truck.', ['Plants need sunlight.', 'Roots take in water.'], 'Every sentence should support the main idea.'],
    ['Which is the strongest claim for an argument essay?', 'Schools should start later because teenagers need more sleep.', ['School is a place.', 'Some people like school.'], 'A claim takes a position someone could disagree with, and gives a reason.'],
  ],
  [
    ['Which sentence best introduces a counterclaim?', 'Some argue that later start times would disrupt after-school jobs.', ['Later start times are obviously best.', 'In conclusion, start later.'], 'A counterclaim states the opposing view fairly.'],
    ['Which revision removes wordiness from “Due to the fact that it was raining, we stayed inside”?', 'Because it was raining, we stayed inside.', ['Due to the fact that it rained, we stayed inside.', 'It was raining due to the fact we stayed inside.'], 'Replace a long phrase with one word that means the same.'],
    ['Which conclusion is strongest for an essay on recycling?', 'If each family recycles, our town could cut landfill waste dramatically.', ['That is all I have to say.', 'Recycling exists.'], 'A strong conclusion restates the claim and shows why it matters.'],
    ['Which revision maintains a formal style?', 'The results suggest the method is effective.', ['The results are, like, super good.', 'The method is totally awesome.'], 'Formal writing avoids slang.'],
  ],
];

// ======================= Science =======================
const PUSH_PULL = [
  [
    ['You open a drawer toward you. Is that a push or a pull?', 'A pull', ['A push', 'Neither'], 'Which way does the drawer move: toward you or away from you?'],
    ['You kick a ball. Is that a push or a pull?', 'A push', ['A pull', 'Neither'], 'Does your foot send the ball away from you or bring it closer?'],
    ['What happens if you push a toy car harder?', 'It goes faster or farther.', ['It goes slower.', 'Nothing changes.'], 'Bigger pushes make bigger changes in motion.'],
  ],
  [
    ['A ball rolling across the floor slowly stops. Why?', 'Friction from the floor slows it down.', ['It gets tired.', 'Gravity pushes it sideways.'], 'Something rubbing against the ball works against its motion.'],
    ['What can a push or pull do to an object?', 'Start it, stop it or change its direction', ['Only make it bigger', 'Only change its color'], 'Forces change how things move.'],
    ['Two children pull a rope equally hard in opposite directions. What happens?', 'The rope does not move.', ['The rope moves left.', 'The rope breaks at once.'], 'Equal and opposite forces are balanced.'],
  ],
  [
    ['A magnet pulls a paper clip without touching it. What kind of force is this?', 'A non-contact force', ['A contact force', 'Friction'], 'Some forces act at a distance.'],
    ['Why does a ball thrown up come back down?', 'Gravity pulls it toward Earth.', ['Air pushes it down.', 'It runs out of color.'], 'Which force pulls everything toward Earth’s center?'],
    ['A box does not move when you push it gently. Which is true?', 'Friction balances your push.', ['There are no forces on the box.', 'Gravity is pushing it up.'], 'If nothing changes, the forces are balanced.'],
  ],
];

const LIVING_NEEDS = [
  [
    ['What do all animals need to live?', 'Food, water and air', ['Toys, books and games', 'Only sunshine'], 'Think about what your pet needs every day.'],
    ['What do plants need to grow?', 'Sunlight, water and air', ['Darkness and sugar', 'Only soil and rocks'], 'Plants make their own food using light.'],
    ['Why do squirrels bury nuts?', 'To have food later', ['To grow trees on purpose', 'To hide from people'], 'Living things act to meet their needs.'],
  ],
  [
    ['A plant is kept in a dark closet. What will most likely happen?', 'It will become weak and pale.', ['It will grow faster.', 'It will turn bright green.'], 'What does a plant use light for?'],
    ['Which is a living thing?', 'A mushroom', ['A rock', 'A cloud'], 'Living things grow, need food and reproduce.'],
    ['Why do roots grow down into the soil?', 'To take in water and nutrients and hold the plant in place', ['To catch sunlight', 'To make seeds'], 'Think about what is in the soil.'],
  ],
  [
    ['How do giraffes’ long necks help them survive?', 'They can reach leaves high in trees.', ['They can swim faster.', 'They can see in the dark.'], 'Structures help living things meet their needs.'],
    ['Beavers build dams that flood land. What does this show?', 'Animals can change their environment to meet their needs.', ['Animals never affect their environment.', 'Beavers need to live in deserts.'], 'How does the dam help the beaver?'],
    ['Which is an internal structure that helps an animal survive?', 'A heart that pumps blood', ['A shell', 'Fur'], 'Internal means inside the body.'],
  ],
];

const WEATHER = [
  [
    ['What tool measures temperature?', 'A thermometer', ['A ruler', 'A scale'], '“Thermo” means heat.'],
    ['What should you wear on a rainy day?', 'A raincoat', ['A swimsuit', 'Sunglasses only'], 'Weather tells us how to dress.'],
    ['Which season is usually the coldest in most of the United States?', 'Winter', ['Summer', 'Spring'], 'Think about when snow falls.'],
  ],
  [
    ['What does a rain gauge measure?', 'How much rain has fallen', ['How fast the wind blows', 'How hot it is'], 'A gauge measures an amount.'],
    ['Which weather is most dangerous during a thunderstorm?', 'Lightning', ['Fog', 'Light breeze'], 'Thunderstorms bring electrical flashes.'],
    ['Meteorologists predict a hurricane. Why does this help people?', 'They can prepare or move to safety.', ['It stops the hurricane.', 'It makes the storm smaller.'], 'Forecasts help reduce the impact of severe weather.'],
  ],
  [
    ['What is the difference between weather and climate?', 'Weather is day-to-day; climate is the usual pattern over many years.', ['They are the same.', 'Climate changes every hour.'], 'Think about short time versus long time.'],
    ['A table shows a town gets most of its rain from June to August. What can you predict?', 'Summers are usually the rainiest season there.', ['It never rains in winter anywhere.', 'It will rain every day next June.'], 'Patterns in data help predict typical weather, not exact days.'],
    ['Why do clouds form when warm, moist air rises?', 'The air cools and water vapor condenses into droplets.', ['The air heats up and evaporates.', 'Wind blows dust together.'], 'Cooling turns water vapor into liquid.'],
  ],
];

const LIGHT_SOUND = [
  [
    ['What makes sound?', 'Vibrations', ['Light', 'Colors'], 'Touch your throat while you hum.'],
    ['Why can we see things in a lit room?', 'Light bounces off objects into our eyes.', ['Our eyes shine light.', 'Objects are always glowing.'], 'Can you see in total darkness?'],
    ['Which material lets light pass through?', 'Clear glass', ['Wood', 'A brick'], 'Transparent materials let light through.'],
  ],
  [
    ['What is a shadow?', 'A dark area where an object blocks light', ['Light reflecting off water', 'A kind of sound'], 'Shadows form when light cannot get through.'],
    ['What does a mirror do to light?', 'It reflects it.', ['It absorbs all of it.', 'It makes sound.'], 'You see yourself because light bounces back.'],
    ['A drum is hit harder. What happens to the sound?', 'It gets louder.', ['It gets quieter.', 'It disappears.'], 'Bigger vibrations make louder sounds.'],
  ],
  [
    ['Which material would make the best shadow?', 'Cardboard (opaque)', ['Clear plastic (transparent)', 'Wax paper (translucent)'], 'Opaque materials block light completely.'],
    ['How could you send a message using light without talking?', 'Flash a flashlight in a pattern', ['Whisper loudly', 'Write it on water'], 'Light can carry signals over distances.'],
    ['Why do you see lightning before you hear thunder?', 'Light travels much faster than sound.', ['Sound travels faster than light.', 'Thunder happens first.'], 'Compare the speeds of light and sound.'],
  ],
];

const TRAITS = [
  [
    ['Why do baby animals look like their parents?', 'They inherit traits from their parents.', ['They copy their parents.', 'They eat the same food.'], 'Traits are passed from parents to offspring.'],
    ['Which trait is inherited?', 'Eye color', ['Speaking Spanish', 'A scar from a fall'], 'Inherited traits come from parents; others are learned or caused by the environment.'],
    ['Puppies from the same litter look different. Why?', 'Each inherits a different mix of traits from the parents.', ['They choose how to look.', 'They are from different species.'], 'Offspring are similar but not identical.'],
  ],
  [
    ['A plant grown in poor soil is shorter than its parent. What caused the difference?', 'The environment', ['Inheritance only', 'The plant’s choice'], 'Traits can be influenced by environment.'],
    ['Which is a learned behavior?', 'A dog fetching a ball on command', ['A spider spinning a web', 'A baby bird opening its mouth for food'], 'Learned behaviors come from experience or training.'],
    ['A cat has a litter of kittens with different fur colors. What does this show?', 'Variation in inherited traits', ['That cats are plants', 'That fur color is learned'], 'Members of the same species vary.'],
  ],
  [
    ['Two parent plants are tall, but one offspring is short. What explains this?', 'Both parents carried a hidden version of the gene for shortness.', ['The offspring decided to be short.', 'Tall plants always have short babies.'], 'Some traits can skip a generation.'],
    ['Which is an example of a trait influenced by both genes and environment?', 'A person’s height', ['Blood type', 'Number of fingers at birth'], 'Nutrition can change how tall you grow.'],
    ['Why do offspring from sexual reproduction vary more than from asexual reproduction?', 'They get genes from two parents.', ['They have no genes.', 'They get genes from many species.'], 'Asexual reproduction makes near copies of one parent.'],
  ],
];

const EROSION = [
  [
    ['What is erosion?', 'Moving rock and soil from one place to another', ['Making new rock in a volcano', 'Planting trees'], 'Water and wind carry things away.'],
    ['What can slowly wear down a big rock?', 'Water, wind and ice', ['Sunlight alone', 'Shadows'], 'Think about what moves across rocks.'],
    ['How do plants help stop erosion?', 'Their roots hold soil in place.', ['They make the soil wetter.', 'They break rocks apart.'], 'Roots grip the soil.'],
  ],
  [
    ['A canyon formed over millions of years. What most likely carved it?', 'A river', ['An earthquake in one day', 'Wind from a fan'], 'Running water cuts slowly into rock.'],
    ['What is weathering?', 'Breaking rock into smaller pieces', ['Moving rock to a new place', 'Melting rock'], 'Weathering breaks; erosion moves.'],
    ['Where does sediment usually settle out of a river?', 'Where the water slows down, like at the mouth', ['At the fastest part of the river', 'At the top of a waterfall'], 'Slow water cannot carry as much.'],
  ],
  [
    ['Rock layers show a fossil fish high on a mountain. What does this suggest?', 'The area was once under water.', ['Fish climbed the mountain.', 'Mountains make fish.'], 'Fossils show past environments.'],
    ['Engineers want to protect a beach house from erosion. Which solution best addresses the cause?', 'Build a barrier or plant dune grass to slow waves and wind', ['Paint the house', 'Add more windows'], 'What moves the sand away?'],
    ['Why do rock layers lower down tend to be older?', 'Layers are deposited on top of older ones.', ['Rocks sink as they age.', 'New rocks form underground first.'], 'Think about stacking newspapers day by day.'],
  ],
];

const NATURAL_SELECTION = [
  [
    ['What is an adaptation?', 'A trait that helps a living thing survive in its environment', ['A change in the weather', 'A kind of rock'], 'Think of a polar bear’s thick fur.'],
    ['How does camouflage help an animal?', 'It helps it hide from predators or prey.', ['It keeps it warm.', 'It helps it fly.'], 'Blending in is useful.'],
    ['What is a fossil?', 'Remains or traces of a living thing from long ago', ['A new kind of plant', 'A type of cloud'], 'Fossils are found in rock.'],
  ],
  [
    ['In a forest with dark tree trunks, dark moths survive better than light moths. Why?', 'Birds find light moths more easily on dark bark.', ['Dark moths are stronger.', 'Light moths choose to leave.'], 'Which moths are easier for predators to see?'],
    ['What does natural selection act on?', 'Variation in inherited traits', ['Traits learned during life', 'The color of rocks'], 'Only traits that can be passed on change a population.'],
    ['Bacteria are exposed to an antibiotic, and a few survive. What happens next?', 'Resistant bacteria multiply, so the population becomes more resistant.', ['All bacteria die forever.', 'The bacteria become a plant.'], 'Survivors pass on their traits.'],
  ],
  [
    ['Why can’t one individual animal evolve during its lifetime?', 'Evolution is a change in a population’s traits over generations.', ['Animals do not have traits.', 'Evolution only happens to plants.'], 'Think about who changes: one animal or a group over time.'],
    ['Similar bones in a whale flipper and a human arm are evidence of what?', 'A common ancestor', ['No relationship at all', 'That whales walk on land today'], 'Shared structures suggest shared ancestry.'],
    ['Which condition is NOT needed for natural selection?', 'Individuals choosing to change their traits', ['Variation in traits', 'More offspring than can survive'], 'Natural selection does not depend on wanting to change.'],
  ],
];

const HUMAN_IMPACT = [
  [
    ['Which action helps reduce waste?', 'Recycling bottles', ['Throwing trash on the ground', 'Using more plastic bags'], 'Reduce, reuse, recycle.'],
    ['Why is litter bad for animals?', 'Animals can eat it or get trapped in it.', ['It feeds them well.', 'It keeps them warm.'], 'Think about a turtle and a plastic bag.'],
    ['Which is a way to save water?', 'Turning off the tap while brushing teeth', ['Leaving the hose running', 'Taking very long showers'], 'Saving means using less.'],
  ],
  [
    ['How does cutting down forests affect animals?', 'Many lose their habitat.', ['They get more homes.', 'Nothing changes.'], 'Where do forest animals live?'],
    ['Which energy source is renewable?', 'Solar power', ['Coal', 'Oil'], 'Renewable sources are not used up.'],
    ['Fertilizer runs off farms into a lake. What can happen?', 'Algae grow quickly and use up oxygen, harming fish.', ['Fish grow larger.', 'The lake becomes cleaner.'], 'Extra nutrients feed algae.'],
  ],
  [
    ['Why does burning fossil fuels contribute to climate change?', 'It releases carbon dioxide, which traps heat in the atmosphere.', ['It cools the planet.', 'It removes gases from the air.'], 'Carbon dioxide is a greenhouse gas.'],
    ['A town’s population doubles. What is most likely to increase?', 'Demand for water, land and energy', ['The number of glaciers', 'Rainfall'], 'More people use more resources.'],
    ['Which solution best reduces a city’s air pollution while meeting transport needs?', 'Expanding public transit and bike lanes', ['Banning all travel', 'Building more coal plants'], 'A good solution meets the need and reduces the harm.'],
  ],
];

const ENGINEERING = [
  [
    ['What is the first step in solving a problem like an engineer?', 'Ask questions to understand the problem', ['Build the first idea right away', 'Give up'], 'You need to know what problem you are solving.'],
    ['You want to keep an ice cube from melting. What could you test?', 'Different wrappers to see which keeps it cold longest', ['Different colored ice cubes', 'The time of day'], 'Test possible solutions.'],
    ['Why do engineers draw sketches?', 'To share and plan ideas', ['To decorate the room', 'To skip testing'], 'Sketches show how something might work.'],
  ],
  [
    ['A bridge must hold 5 kg and use only 20 craft sticks. What are these?', 'Criteria and constraints', ['Conclusions', 'Hypotheses'], 'Criteria are what success looks like; constraints are limits.'],
    ['Two designs both work. How should you choose?', 'Compare them against the criteria and constraints', ['Pick the prettier one', 'Flip a coin'], 'Use evidence from testing.'],
    ['A model car keeps tipping over in tests. What should the engineer do next?', 'Change one part and test again', ['Stop testing', 'Change everything at once'], 'Improve, then test the change.'],
  ],
  [
    ['Why test only one change at a time when improving a design?', 'So you know which change caused the result', ['It is faster to change many things', 'Tests do not matter'], 'Think about fair tests.'],
    ['A water filter design is cheap but slow. Another is fast but costly. What is this?', 'A trade-off', ['A failure', 'A constraint'], 'Improving one feature can worsen another.'],
    ['What is a prototype?', 'An early model used to test a design', ['The final product sold in stores', 'A drawing of the problem'], 'Engineers build these to learn what works.'],
  ],
];

const EXPERIMENTS = [
  [
    ['What is a prediction in science?', 'A guess about what will happen, based on what you know', ['The result of the test', 'A wild guess with no reason'], 'You make it before testing.'],
    ['Why do scientists repeat tests?', 'To check that the results are reliable', ['To waste time', 'Because the first test is always wrong'], 'One result could be a fluke.'],
    ['What should you do with your observations?', 'Record them carefully', ['Keep them in your head', 'Change them to match your guess'], 'Records let you and others check your work.'],
  ],
  [
    ['You test whether plants grow taller with more water. What is the independent variable?', 'The amount of water', ['The plant’s height', 'The type of pot'], 'It is the thing you change on purpose.'],
    ['In the same plant test, what is the dependent variable?', 'The plant’s height', ['The amount of water', 'The amount of sunlight'], 'It is what you measure.'],
    ['Why must all plants get the same light in that test?', 'Light is a controlled variable, so it keeps the test fair.', ['Light does not matter.', 'To make the plants grow faster.'], 'Only one thing should change.'],
  ],
  [
    ['A student tests one plant with fertilizer and one without. Why is this weak evidence?', 'The sample is too small to rule out chance.', ['It uses fertilizer.', 'Plants cannot be tested.'], 'How many plants would make you more confident?'],
    ['Data show ice-cream sales and sunburns rise together. What is the best conclusion?', 'They are correlated, likely both caused by hot sunny weather.', ['Ice cream causes sunburn.', 'Sunburn causes ice-cream sales.'], 'Correlation does not prove causation.'],
    ['Results do not support a hypothesis. What should a scientist do?', 'Report the results and revise the hypothesis', ['Hide the data', 'Change the data'], 'Unexpected results are still evidence.'],
  ],
];

const ELECTRICITY_MAGNETS = [
  [
    ['Which object will a magnet pick up?', 'A steel paper clip', ['A wooden pencil', 'A plastic spoon'], 'Magnets attract some metals, like iron and steel.'],
    ['What happens when two north poles of magnets face each other?', 'They push apart.', ['They pull together.', 'Nothing happens.'], 'Like poles repel.'],
    ['What does a light bulb need to light up in a circuit?', 'A complete path for electricity', ['A broken wire', 'Only a switch'], 'Electricity flows in a closed loop.'],
  ],
  [
    ['Which material is a good conductor of electricity?', 'Copper', ['Rubber', 'Glass'], 'Metals let electricity flow easily.'],
    ['Why are wires covered in plastic?', 'Plastic is an insulator, keeping electricity safely inside.', ['Plastic makes electricity faster.', 'For decoration only.'], 'Insulators block electricity.'],
    ['How can you make an electromagnet stronger?', 'Add more coils of wire', ['Use a plastic core', 'Remove the battery'], 'More coils or more current increase the magnetic force.'],
  ],
  [
    ['In a series circuit with two bulbs, one bulb breaks. What happens?', 'The other bulb goes out too.', ['The other bulb gets brighter.', 'Nothing changes.'], 'In series, there is only one path.'],
    ['Why do magnets stick to a fridge without touching from far away?', 'Magnetic force acts through a field, even at a distance.', ['Glue is on the fridge.', 'Gravity pulls them sideways.'], 'Non-contact forces act through fields.'],
    ['A generator turns a coil inside a magnet. What does it produce?', 'Electric current', ['Light only', 'Sound'], 'Moving magnets near coils make electricity.'],
  ],
];

const SOLAR_SYSTEM = [
  [
    ['What is the sun?', 'A star', ['A planet', 'A moon'], 'It makes its own light.'],
    ['Why does the sun appear to move across the sky each day?', 'Earth spins.', ['The sun orbits Earth each day.', 'Clouds push it.'], 'It is Earth that turns.'],
    ['Which planet do we live on?', 'Earth', ['Mars', 'Jupiter'], 'It is the third planet from the sun.'],
  ],
  [
    ['Why does the sun look bigger and brighter than other stars?', 'It is much closer to Earth.', ['It is the biggest star in the universe.', 'Other stars are not real.'], 'Distance changes how bright something looks.'],
    ['What keeps the planets in orbit around the sun?', 'Gravity', ['Magnetism', 'Wind'], 'The same force that pulls things down on Earth.'],
    ['Which way does gravity pull objects on Earth?', 'Down, toward Earth’s center', ['Up, toward the sky', 'Sideways, toward the sun'], 'Even in Australia, things fall “down”.'],
  ],
  [
    ['Why do we see different constellations in different seasons?', 'Earth’s position in its orbit changes which part of space faces us at night.', ['Stars move each month.', 'Constellations disappear in winter.'], 'Earth travels around the sun over a year.'],
    ['Why do shadows change length during the day?', 'The sun’s angle in the sky changes as Earth rotates.', ['The sun changes size.', 'Objects grow and shrink.'], 'Shadows are shortest near midday.'],
    ['What is a galaxy?', 'A huge system of billions of stars held together by gravity', ['A single planet', 'A type of moon'], 'Our galaxy is the Milky Way.'],
  ],
];

const BODY_SYSTEMS = [
  [
    ['Which organ pumps blood around the body?', 'The heart', ['The lungs', 'The stomach'], 'You can feel it beating in your chest.'],
    ['What do the lungs do?', 'Take in oxygen and remove carbon dioxide', ['Digest food', 'Pump blood'], 'They help you breathe.'],
    ['Which body system includes bones?', 'Skeletal system', ['Digestive system', 'Nervous system'], 'Bones form your skeleton.'],
  ],
  [
    ['Which system breaks food into nutrients?', 'Digestive system', ['Respiratory system', 'Skeletal system'], 'It starts in your mouth.'],
    ['How do the respiratory and circulatory systems work together?', 'Lungs take in oxygen, and blood carries it to cells.', ['They do not work together.', 'Blood digests food.'], 'Oxygen has to reach every cell.'],
    ['Which system sends signals between the brain and body?', 'Nervous system', ['Muscular system', 'Digestive system'], 'Nerves carry messages.'],
  ],
  [
    ['Which shows the levels of organization from smallest to largest?', 'cells → tissues → organs → organ systems → organism', ['organs → cells → tissues → organism', 'organism → organs → cells → tissues'], 'Start with the smallest unit of life.'],
    ['During exercise, why does your heart rate rise?', 'Muscles need more oxygen and nutrients delivered.', ['The heart is resting.', 'Bones need more blood.'], 'What do working muscles need?'],
    ['Which pair of systems directly controls movement of the body?', 'Muscular and skeletal (with the nervous system sending signals)', ['Digestive and excretory', 'Respiratory and immune'], 'Muscles pull on bones.'],
  ],
];

const ECOLOGY = [
  [
    ['What is a habitat?', 'The place where a living thing lives', ['What an animal eats', 'A kind of weather'], 'A fish’s habitat is water.'],
    ['What is a population?', 'All the members of one species in an area', ['All the rocks in an area', 'One animal'], 'Think of all the deer in one forest.'],
    ['What do decomposers do?', 'Break down dead material and return nutrients to the soil', ['Make food from sunlight', 'Hunt other animals'], 'Mushrooms and worms are examples.'],
  ],
  [
    ['Rabbits in a meadow increase, then food runs short. What happens to the rabbit population?', 'It decreases.', ['It increases forever.', 'It stays exactly the same.'], 'Resources limit populations.'],
    ['Bees carry pollen while drinking nectar. What kind of relationship is this?', 'Mutualism (both benefit)', ['Predation', 'Parasitism'], 'Both the bee and the flower gain something.'],
    ['What is a limiting factor?', 'A resource that restricts the size of a population', ['An animal that eats plants', 'A kind of fossil'], 'Water, food and space are common examples.'],
  ],
  [
    ['Wolves are reintroduced to a park, and deer numbers fall. What might happen to young trees?', 'They may recover because fewer deer eat them.', ['They all die.', 'Nothing can change.'], 'Changes ripple through a food web.'],
    ['Why does only about 10% of energy pass from one trophic level to the next?', 'Most energy is used for life processes or lost as heat.', ['Animals refuse to eat.', 'Energy is created at each level.'], 'Energy is not recycled like matter.'],
    ['Which change would most reduce an ecosystem’s biodiversity?', 'Clearing the forest for one crop', ['Adding a wildlife corridor', 'Protecting wetlands'], 'Biodiversity means the variety of species.'],
  ],
];

// Wave speed v = f × λ.
function waves(d, rand) {
  if (d === 1) return fromBank(rand, [
    ['What is the highest point of a wave called?', 'The crest', ['The trough', 'The wavelength'], 'The lowest point is the trough.'],
    ['What does the amplitude of a sound wave affect?', 'How loud it is', ['How high or low it sounds', 'Its color'], 'Bigger vibrations are louder.'],
    ['What does a wave carry from place to place?', 'Energy', ['Water itself, all the way across the ocean', 'Air molecules to another city'], 'A cork bobs up and down but stays roughly in place.'],
  ]);
  const f = int(rand, 2, 20); const l = int(rand, 2, 15);
  if (d === 2) return input(`A wave has a frequency of ${f} Hz and a wavelength of ${l} m. What is its speed, in m/s?`, f * l, ['Wave speed = frequency × wavelength.', `${f} × ${l}.`], { [f + l]: 'times-as-add' });
  return input(`A wave travels at ${f * l} m/s with a frequency of ${f} Hz. What is its wavelength, in meters?`, l, ['Rearrange v = f × λ to find λ.', `λ = ${f * l} ÷ ${f}.`], { [f * l * f]: 'inverse-operation' });
}

// Balancing equations: authored reactions with known lowest-whole-number coefficients.
export const REACTIONS = [
  // [unbalanced with a blank, answer coefficient, full balanced coefficients as [[n, formula]...] => [[n, formula]...]]
  ['__ H₂ + O₂ → 2 H₂O', 2, [[2, { H: 2 }], [1, { O: 2 }]], [[2, { H: 2, O: 1 }]]],
  ['N₂ + __ H₂ → 2 NH₃', 3, [[1, { N: 2 }], [3, { H: 2 }]], [[2, { N: 1, H: 3 }]]],
  ['CH₄ + __ O₂ → CO₂ + 2 H₂O', 2, [[1, { C: 1, H: 4 }], [2, { O: 2 }]], [[1, { C: 1, O: 2 }], [2, { H: 2, O: 1 }]]],
  ['2 Na + Cl₂ → __ NaCl', 2, [[2, { Na: 1 }], [1, { Cl: 2 }]], [[2, { Na: 1, Cl: 1 }]]],
  ['__ Mg + O₂ → 2 MgO', 2, [[2, { Mg: 1 }], [1, { O: 2 }]], [[2, { Mg: 1, O: 1 }]]],
  ['4 Fe + __ O₂ → 2 Fe₂O₃', 3, [[4, { Fe: 1 }], [3, { O: 2 }]], [[2, { Fe: 2, O: 3 }]]],
  ['2 KClO₃ → 2 KCl + __ O₂', 3, [[2, { K: 1, Cl: 1, O: 3 }]], [[2, { K: 1, Cl: 1 }], [3, { O: 2 }]]],
  ['C₃H₈ + __ O₂ → 3 CO₂ + 4 H₂O', 5, [[1, { C: 3, H: 8 }], [5, { O: 2 }]], [[3, { C: 1, O: 2 }], [4, { H: 2, O: 1 }]]],
  ['2 Al + __ HCl → 2 AlCl₃ + 3 H₂', 6, [[2, { Al: 1 }], [6, { H: 1, Cl: 1 }]], [[2, { Al: 1, Cl: 3 }], [3, { H: 2 }]]],
];
function chemicalReactions(d, rand) {
  if (d === 1) return fromBank(rand, [
    ['Which is a sign that a chemical reaction has happened?', 'A new gas forms and bubbles appear', ['Ice melts into water', 'Paper is cut in half'], 'A chemical change makes a new substance.'],
    ['Which is a physical change?', 'Water boiling into steam', ['Wood burning', 'Iron rusting'], 'In a physical change, the substance is still the same substance.'],
    ['In a reaction, what are the starting substances called?', 'Reactants', ['Products', 'Catalysts'], 'Products are made by the reaction.'],
  ]);
  const pool = d === 2 ? REACTIONS.slice(0, 5) : REACTIONS.slice(4);
  const [eq, ans] = pick(rand, pool);
  return choice(rand, {
    prompt: `Fill in the coefficient to balance the equation: ${eq}`, answer: ans, min: 1, max: 9,
    wrong: [{ value: ans + 1 }, { value: ans - 1 }, { value: ans * 2 }],
    hints: ['Count each kind of atom on both sides of the arrow.', 'The numbers must match because atoms are not created or destroyed.'],
  });
}

// ======================= Social studies =======================
const COLONIAL_REVOLUTION = [
  [
    ['Who were the first people to live in North America?', 'Native Americans (American Indians)', ['European colonists', 'Explorers from Spain'], 'People lived here for thousands of years before Europeans arrived.'],
    ['What holiday celebrates the Declaration of Independence?', 'Independence Day (July 4)', ['Thanksgiving', 'Labor Day'], 'It was adopted on July 4, 1776.'],
    ['How many original colonies became the first states?', '13', ['50', '7'], 'There are 13 stripes on the flag.'],
  ],
  [
    ['What did colonists mean by “no taxation without representation”?', 'They should not be taxed by a Parliament where they had no vote.', ['They wanted no government at all.', 'They wanted higher taxes.'], 'Who made the tax laws, and did colonists have a say?'],
    ['Who was the main author of the Declaration of Independence?', 'Thomas Jefferson', ['George Washington', 'Abraham Lincoln'], 'He later became the third president.'],
    ['Who led the Continental Army?', 'George Washington', ['Benjamin Franklin', 'King George III'], 'He became the first president.'],
  ],
  [
    ['Why was the Articles of Confederation replaced by the Constitution?', 'The national government was too weak to tax or enforce laws.', ['It gave the president too much power.', 'It created too many states.'], 'Think about what the government could NOT do.'],
    ['What was the Great Compromise?', 'Congress would have a Senate with equal representation and a House based on population.', ['Slavery was ended in 1787.', 'The president would be chosen by the king.'], 'Large and small states disagreed about representation.'],
    ['Why was the Battle of Saratoga a turning point?', 'It convinced France to openly support the Americans.', ['It ended the war at once.', 'It was the first battle.'], 'Think about the war’s allies.'],
  ],
];

const CIVIL_WAR = [
  [
    ['Who was president during the Civil War?', 'Abraham Lincoln', ['George Washington', 'Thomas Jefferson'], 'He gave the Gettysburg Address.'],
    ['What was the main issue that divided the North and South?', 'Slavery', ['Taxes on tea', 'Railroad colors'], 'It was the central conflict of the era.'],
    ['Who helped many enslaved people escape on the Underground Railroad?', 'Harriet Tubman', ['Betsy Ross', 'Paul Revere'], 'She made many dangerous trips to lead people to freedom.'],
  ],
  [
    ['What did the Emancipation Proclamation (1863) do?', 'Declared enslaved people in Confederate states free', ['Ended the Civil War', 'Made women able to vote'], 'It changed the purpose of the war.'],
    ['Which amendment abolished slavery in the United States?', 'The 13th Amendment', ['The 1st Amendment', 'The 19th Amendment'], 'It was ratified in 1865.'],
    ['What was Reconstruction?', 'The period of rebuilding the South and reuniting the nation after the war', ['The building of the first railroad', 'A war with Mexico'], 'It followed the Civil War.'],
  ],
  [
    ['What did the 14th Amendment guarantee?', 'Citizenship and equal protection of the laws to all persons born or naturalized in the US', ['The right to bear arms', 'Women’s suffrage'], 'It was central to later civil rights cases.'],
    ['Why did Reconstruction-era gains for Black Americans erode after 1877?', 'Federal troops withdrew and Southern states passed Jim Crow laws.', ['The 13th Amendment was repealed.', 'Congress banned all voting.'], 'What changed when federal enforcement ended?'],
    ['What was the purpose of the Freedmen’s Bureau?', 'To help formerly enslaved people with food, schools and legal aid', ['To collect war taxes', 'To build forts in the West'], 'Think about what newly freed people needed.'],
  ],
];

const PRIMARY_SOURCES = [
  [
    ['Which is a primary source about your own birthday party?', 'A photo taken at the party', ['A story your friend heard about it later', 'A book about parties'], 'A primary source comes from the time and place of the event.'],
    ['A letter written by a soldier in 1863 is a…', 'Primary source', ['Secondary source', 'Fictional source'], 'It was written by someone who was there, at the time.'],
    ['Which is a secondary source?', 'A textbook chapter about the Revolution', ['A diary from 1776', 'A map drawn in 1775'], 'A secondary source describes events afterward.'],
  ],
  [
    ['Why might two eyewitness accounts of the same battle differ?', 'Each person saw different parts and had their own point of view.', ['One of them must be lying.', 'Battles are always remembered the same way.'], 'Consider where each person stood and what they believed.'],
    ['A newspaper from 1920 praises a politician owned by the paper’s publisher. What should a historian consider?', 'Possible bias', ['That it must be true', 'That it is a secondary source'], 'Who created the source, and why?'],
    ['What is the best way to check a claim in a historical source?', 'Compare it with other sources from the time (corroborate)', ['Trust the oldest source', 'Use only one source'], 'Look for agreement between independent sources.'],
  ],
  [
    ['A historian argues the New Deal reduced unemployment. Which evidence would be strongest?', 'Unemployment statistics from before and after New Deal programs', ['A modern cartoon about the 1930s', 'A novel set in the 1930s'], 'Use data that directly measures the claim.'],
    ['What does “sourcing” a document mean?', 'Identifying who made it, when and why', ['Counting its words', 'Reading only the last sentence'], 'Context shapes meaning.'],
    ['Why is a political cartoon useful as a primary source?', 'It shows opinions and attitudes of its time.', ['It gives exact statistics.', 'It is always neutral.'], 'What does the artist want viewers to think?'],
  ],
];

const WORLD_GEOGRAPHY = [
  [
    ['How many continents are there?', '7', ['5', '9'], 'Count them: Africa, Antarctica, Asia, Australia, Europe, North America, South America.'],
    ['Which is the largest ocean?', 'Pacific Ocean', ['Atlantic Ocean', 'Indian Ocean'], 'It lies between Asia and the Americas.'],
    ['On which continent is Egypt?', 'Africa', ['Asia', 'Europe'], 'The Nile River flows through it.'],
  ],
  [
    ['What line divides Earth into Northern and Southern Hemispheres?', 'The equator', ['The prime meridian', 'The Tropic of Cancer'], 'It is at 0° latitude.'],
    ['Why did many early civilizations grow up along rivers?', 'Rivers gave water, fertile soil and transport.', ['Rivers kept people cold.', 'Mountains blocked all rivers.'], 'Think about farming and trade.'],
    ['Which mountain range separates India from China?', 'The Himalayas', ['The Andes', 'The Rockies'], 'It contains Mount Everest.'],
  ],
  [
    ['Lines of longitude measure distance east or west of what?', 'The prime meridian', ['The equator', 'The North Pole'], 'It runs through Greenwich, England.'],
    ['Why is much of Egypt’s population near the Nile?', 'Most of Egypt is desert, and the Nile provides water for farming.', ['The Nile is cold.', 'Cities must be on coasts.'], 'Look at Egypt’s climate.'],
    ['What is a monsoon?', 'A seasonal wind shift that brings heavy rain, especially in South Asia', ['A desert storm', 'An earthquake'], 'Farmers in India depend on it.'],
  ],
];

const ECONOMICS_BASICS = [
  [
    ['What is the difference between a need and a want?', 'A need is required to live; a want is nice to have.', ['They are the same.', 'A want is always free.'], 'Food is a need; a video game is a want.'],
    ['What are goods?', 'Things people make or grow to use', ['Actions people do for others', 'Money in a bank'], 'A bike is a good; a haircut is a service.'],
    ['What is a service?', 'Work done for someone else', ['A thing you can hold', 'A kind of tax'], 'Doctors and teachers provide these.'],
  ],
  [
    ['What is scarcity?', 'Not having enough resources to meet all wants', ['Having more than you need', 'A type of store'], 'Because of it, people must make choices.'],
    ['You choose soccer over piano lessons. What is your opportunity cost?', 'The piano lessons you gave up', ['The soccer cleats', 'Nothing'], 'It is the next-best choice you did not take.'],
    ['Why do people specialize in jobs?', 'They become more productive and trade for what they need.', ['To avoid trading', 'Because it is required by law'], 'Doing one job well lets you trade.'],
  ],
  [
    ['What usually happens to prices when inflation rises?', 'Prices go up and money buys less', ['Prices fall sharply', 'Money is worth more'], 'Inflation is a general rise in prices.'],
    ['What does the Federal Reserve mainly do?', 'Manages the money supply and interest rates', ['Collects income taxes', 'Writes federal laws'], 'It is the central bank of the United States.'],
    ['What is GDP?', 'The total value of goods and services produced in a country in a year', ['Government debt', 'The number of workers'], 'It measures the size of an economy.'],
  ],
];

const STATE_LOCAL = [
  [
    ['Who leads a city government?', 'A mayor', ['A governor', 'A president'], 'Governors lead states; presidents lead the nation.'],
    ['Who leads a state government?', 'A governor', ['A mayor', 'A senator'], 'Each state has one.'],
    ['Which service is usually provided by local government?', 'Trash collection', ['Printing money', 'Making treaties'], 'Local means your town or county.'],
  ],
  [
    ['Which level of government issues driver’s licenses?', 'State government', ['Federal government', 'The United Nations'], 'Rules for driving differ from state to state.'],
    ['Where do states get much of their money?', 'Sales, income and property taxes', ['Printing their own money', 'Selling citizenship'], 'Only the federal government prints money.'],
    ['What is a state’s supreme law?', 'Its state constitution (within the US Constitution)', ['The mayor’s rules', 'A city’s budget'], 'States have constitutions too.'],
  ],
  [
    ['What is federalism?', 'Sharing power between national and state governments', ['A government run only by states', 'Rule by one king'], 'Think about the levels of government in the Constitution.'],
    ['How can citizens propose a state law directly in some states?', 'Through a ballot initiative', ['By writing to the king', 'Only by joining Congress'], 'Some states let voters decide laws directly.'],
    ['Which is a reserved power of the states?', 'Running public schools', ['Declaring war', 'Coining money'], 'The 10th Amendment reserves powers not given to the federal government.'],
  ],
];

// Compound interest, computed (annual compounding, whole dollars).
function creditAndInterest(d, rand) {
  if (d === 1) return fromBank(rand, [
    ['What is interest on a loan?', 'Extra money you pay for borrowing', ['A gift from the bank', 'Money you never repay'], 'Borrowing money costs money.'],
    ['Why is a good credit score useful?', 'Lenders offer lower interest rates to people with good credit.', ['It lets you skip paying bills.', 'It doubles your income.'], 'A credit score shows how reliably you repay.'],
    ['What does a credit card let you do?', 'Borrow money to buy now and repay later', ['Spend money you already earned only', 'Avoid all fees'], 'Unpaid balances usually charge interest.'],
  ]);
  const p = pick(rand, [100, 200, 500, 1000]); const r = pick(rand, [10, 20, 50]); const n = d === 2 ? 2 : 3;
  const total = Math.round(p * (1 + r / 100) ** n);
  const simple = p + (p * r * n) / 100;
  return input(`You save $${p} at ${r}% interest compounded once a year. How many dollars do you have after ${n} years?`, total, ['Each year, add ' + r + '% of the current balance (not just the starting amount).', `Multiply by ${1 + r / 100} each year: $${p} × ${1 + r / 100}${n === 2 ? '²' : '³'}.`], simple !== total ? { [simple]: 'simple-vs-compound' } : {});
}

// ======================= Computing =======================
const ALGORITHMS_STEPS = [
  [
    ['What is an algorithm?', 'A set of step-by-step instructions to solve a problem', ['A kind of computer screen', 'A random guess'], 'A recipe is an example.'],
    ['Which step comes first when brushing your teeth?', 'Put toothpaste on the brush', ['Rinse your mouth', 'Brush your teeth'], 'Order matters in instructions.'],
    ['A robot is told: forward 2, turn right, forward 1. What is this?', 'A sequence of commands', ['A loop', 'A bug'], 'Commands run one after another.'],
  ],
  [
    ['What is a bug in a program?', 'A mistake that makes it behave wrongly', ['An insect inside the computer', 'A fast program'], 'Debugging means finding and fixing it.'],
    ['Why use a loop like “repeat 4 times: forward 1, turn right”?', 'To avoid writing the same steps again and again', ['To make the program slower', 'Loops only work once'], 'This draws a square with fewer lines.'],
    ['What does a conditional (“if … then …”) do?', 'Runs code only when something is true', ['Repeats code forever', 'Deletes the program'], 'If it is raining, then take an umbrella.'],
  ],
  [
    ['A program should turn on a light only when it is dark AND someone is home. Which statement is right?', 'if dark and home: light on', ['if dark or home: light on', 'repeat: light on'], 'Both conditions must be true.'],
    ['Why break a big problem into smaller parts (decomposition)?', 'Small parts are easier to solve and test.', ['It makes the problem bigger.', 'Computers cannot handle small parts.'], 'Think about planning a party step by step.'],
    ['What is a variable in a program?', 'A named place that stores a value that can change', ['A fixed number that never changes', 'A type of loop'], 'A game score is a good example.'],
  ],
];

// Loop tracing, computed.
function loops(d, rand) {
  const start = int(rand, 0, 5); const add = int(rand, 2, 6); const times = int(rand, 3, d === 1 ? 4 : 7);
  if (d === 3) {
    const lim = int(rand, 20, 60);
    let x = start; let c = 0; while (x < lim) { x += add; c++; }
    return input('What does this program print?', c, ['Track x and count after each pass of the loop.', `The loop stops as soon as x is ${lim} or more.`], { [c + 1]: 'off-by-one', [c - 1]: 'off-by-one' }, { kind: 'code', text: `x = ${start}\ncount = 0\nwhile x < ${lim}:\n    x = x + ${add}\n    count = count + 1\nprint(count)` });
  }
  return input('What does this program print?', start + add * times, [`range(${times}) runs the loop ${times} times. Each time, add ${add} to total.`, `Start from ${start}.`], { [start + add * (times - 1)]: 'off-by-one', [add * times]: null }, { kind: 'code', text: `total = ${start}\nfor i in range(${times}):\n    total = total + ${add}\nprint(total)` });
}

// Bits and bytes, computed.
function dataRepresentation(d, rand) {
  if (d === 1) { const n = int(rand, 1, 6); return input(`How many different values can ${n} bit${n > 1 ? 's' : ''} represent?`, 2 ** n, ['Each bit can be 0 or 1, which is 2 choices.', `With ${n} bits there are 2 × 2 × … (${n} times) combinations.`], { [2 * n]: 'power-as-product' }); }
  if (d === 2) { const n = int(rand, 2, 16); return input(`How many bits are in ${n} bytes?`, n * 8, ['1 byte = 8 bits.', `${n} × 8.`], { [n * 4]: null }); }
  const kb = int(rand, 2, 9);
  return input(`A file is ${kb} MB. Using 1 MB = 1,000 KB, how many KB is it?`, kb * 1000, ['A megabyte is bigger than a kilobyte.', `${kb} × 1,000.`], { [kb * 100]: 'count-zeros' });
}

function searchAlgorithms(d, rand) {
  if (d === 1) return fromBank(rand, [
    ['To find a name in a list by checking each one in order, you use…', 'Linear search', ['Binary search', 'Sorting'], 'Linear means one after another.'],
    ['What must be true of a list before using binary search?', 'It must be sorted.', ['It must be short.', 'It must contain numbers only.'], 'Binary search throws away half by comparing to the middle.'],
    ['Which is an example of sorting?', 'Putting names in alphabetical order', ['Finding one name', 'Deleting a name'], 'Sorting arranges items in an order.'],
  ]);
  const n = d === 2 ? pick(rand, [8, 16, 32, 64]) : pick(rand, [128, 256, 512, 1024]);
  const ask = rand() < 0.5;
  if (ask) return input(`At most how many items does linear search check in a list of ${n} items?`, n, ['In the worst case the item is last, or missing.', 'Linear search may have to check every item.'], { [Math.log2(n)]: null });
  return input(`Binary search halves a sorted list of ${n} items with each check. After how many halvings is one item left?`, Math.log2(n), [`Keep halving ${n}: ${n / 2}, ${n / 4}, …`, 'Count the halvings until you reach 1.'], { [n / 2]: null });
}

const DIGITAL_CITIZENSHIP = [
  [
    ['Someone online you do not know asks for your home address. What should you do?', 'Do not share it and tell a trusted adult', ['Share it if they seem nice', 'Ask for theirs first'], 'Personal information should stay private.'],
    ['Which is personal information you should keep private?', 'Your password', ['Your favorite color', 'The name of a book you like'], 'Some information could help a stranger find you or get into your accounts.'],
    ['What should you do if a message online makes you feel scared or upset?', 'Tell a trusted adult', ['Keep it secret', 'Reply angrily'], 'You do not have to handle it alone.'],
  ],
  [
    ['What is cyberbullying?', 'Using technology to hurt, threaten or embarrass someone', ['Playing games online', 'Sending a friendly message'], 'It is bullying that happens online.'],
    ['Before posting a photo of a friend, what should you do?', 'Ask their permission', ['Post it quickly', 'Edit it without telling them'], 'Respect other people’s privacy.'],
    ['What is a digital footprint?', 'The trail of information you leave online', ['A shoe size app', 'A computer virus'], 'Posts and searches can stay online for a long time.'],
  ],
  [
    ['An app asks for your location, contacts and camera, but it is a simple calculator. What is the best choice?', 'Deny permissions it does not need, or use a different app', ['Allow everything', 'Share your password too'], 'Apps should only ask for what they need.'],
    ['Why might a “free” app show you targeted ads?', 'It collects data about you to sell advertising.', ['Ads are random.', 'Because apps cannot make money.'], 'If you are not paying, your data may be the product.'],
    ['What does copyright mean for an image you find online?', 'The creator controls how it can be used; check the license or ask.', ['Anything online is free to use.', 'Images cannot be copyrighted.'], 'Look for Creative Commons or permission.'],
  ],
];

const CYBERSECURITY = [
  [
    ['Which password is strongest?', 'Purple-Tiger-Runs-42!', ['password', '123456'], 'Long passwords with a mix of words, numbers and symbols are harder to guess.'],
    ['Who should you share your password with?', 'Only a parent or guardian', ['Your best friend', 'Anyone who asks'], 'Passwords protect your accounts.'],
    ['An email says you won a prize and asks you to click a link. What should you do?', 'Do not click; ask a trusted adult', ['Click right away', 'Reply with your address'], 'Surprise prizes are a common trick.'],
  ],
  [
    ['What is phishing?', 'A trick message pretending to be trusted to steal information', ['A fishing video game', 'A safe way to log in'], 'Check the sender and links carefully.'],
    ['What does two-factor authentication add?', 'A second proof of identity, like a code sent to your phone', ['A second password that is the same', 'Nothing useful'], 'Even if a password is stolen, the account stays protected.'],
    ['Why should you install software updates?', 'They often fix security weaknesses.', ['They make the device slower on purpose.', 'They delete your files.'], 'Attackers look for old, unpatched software.'],
  ],
  [
    ['Why is reusing one password on many sites risky?', 'If one site is breached, attackers can try it on all your accounts.', ['It is not risky at all.', 'Sites share passwords anyway.'], 'Think about a single key for every lock.'],
    ['What does the padlock (https) in a browser show?', 'The connection to the site is encrypted', ['The site is guaranteed honest', 'The site is government-owned'], 'Encryption protects data in transit, but scam sites can use https too.'],
    ['What is malware?', 'Software designed to damage or gain unauthorized access to a system', ['Any free game', 'A broken keyboard'], '“Mal” means bad.'],
  ],
];

const AI_LITERACY = [
  [
    ['Which is an example of a computer using artificial intelligence?', 'A voice assistant that understands spoken questions', ['A light switch', 'A paper map'], 'AI systems learn patterns to make predictions.'],
    ['Can an AI chatbot make mistakes?', 'Yes, it can give wrong answers that sound confident.', ['No, it is always right.', 'Only on weekends.'], 'Always check important facts.'],
    ['How do many AI systems learn?', 'From lots of examples (data)', ['By reading minds', 'They never learn'], 'More and better examples help them learn patterns.'],
  ],
  [
    ['An AI was trained only on photos of golden retrievers. What might happen when shown a poodle?', 'It might not recognize it as a dog.', ['It will always say “poodle”.', 'It will refuse to turn on.'], 'AI is limited by its training data.'],
    ['What is bias in an AI system?', 'Unfair results caused by patterns in its data or design', ['A faster processor', 'A friendly voice'], 'If the data is unbalanced, results can be too.'],
    ['You use an AI to help write a report. What should you do?', 'Check facts, cite sources and follow your teacher’s rules', ['Copy it and hand it in', 'Never read it'], 'You are responsible for your work.'],
  ],
  [
    ['Why can AI-generated images be misleading?', 'They can look real but show events that never happened.', ['They are always labeled.', 'They cannot show people.'], 'Check the source of surprising images.'],
    ['A hiring AI rejects more applicants from one zip code. What should be done?', 'Audit the data and model for bias and add human review', ['Trust it because computers are neutral', 'Hide the results'], 'Algorithms can repeat past unfairness.'],
    ['What is the difference between training and using (inference) an AI model?', 'Training learns patterns from data; inference applies them to new inputs.', ['They are the same thing.', 'Inference creates the data.'], 'First it learns, then it predicts.'],
  ],
];

const NETWORKS = [
  [
    ['What is the internet?', 'A huge network connecting computers around the world', ['One big computer', 'A type of cable TV'], 'Computers send messages to each other.'],
    ['What does Wi-Fi let a device do?', 'Connect to a network without cables', ['Charge its battery', 'Print in color'], '“Wireless” is the key idea.'],
    ['What is a web browser?', 'A program for viewing websites', ['A search engine company', 'A computer virus'], 'Examples include Chrome, Safari and Firefox.'],
  ],
  [
    ['Why is data split into packets to travel across the internet?', 'Packets can take different routes and be put back together.', ['To make files bigger', 'So only one computer can use it'], 'Think of sending a long letter as numbered postcards.'],
    ['What is an IP address?', 'A number that identifies a device on a network', ['A website’s password', 'A type of email'], 'Like a mailing address for computers.'],
    ['What does DNS do?', 'Translates website names into IP addresses', ['Stores your photos', 'Blocks all ads'], 'It is like a phone book for the internet.'],
  ],
  [
    ['Why is the internet designed with many redundant paths?', 'So data can still arrive if one route fails', ['To slow it down', 'To use more electricity on purpose'], 'Fault tolerance keeps the network working.'],
    ['What is the role of a router?', 'Forwards packets toward their destination', ['Displays web pages', 'Writes programs'], 'It directs traffic between networks.'],
    ['What is the difference between the internet and the World Wide Web?', 'The internet is the network; the web is pages and links that run over it.', ['They are identical.', 'The web came first.'], 'Email also uses the internet but is not the web.'],
  ],
];

const WEB_BASICS = [
  [
    ['What does HTML stand for?', 'HyperText Markup Language', ['High Tech Modern Language', 'Home Tool Making Language'], 'It is the language for structuring web pages.'],
    ['Which HTML tag makes the biggest heading?', '<h1>', ['<h6>', '<p>'], 'Heading numbers go from 1 (biggest) to 6.'],
    ['Which tag makes a paragraph?', '<p>', ['<a>', '<img>'], 'P for paragraph.'],
  ],
  [
    ['Which tag makes a link?', '<a href="…">', ['<link text>', '<p href="…">'], 'A for anchor.'],
    ['What does CSS control?', 'How the page looks (colors, fonts, layout)', ['The page’s web address', 'The computer’s battery'], 'HTML is structure; CSS is style.'],
    ['Why add alt text to images?', 'So screen readers can describe the image and it shows if the image fails to load', ['To make the image bigger', 'To hide the image'], 'It makes pages accessible.'],
  ],
  [
    ['What does JavaScript add to a web page?', 'Interactivity and behavior', ['Only colors', 'Only the page title'], 'Buttons that respond to clicks often use it.'],
    ['Which CSS rule makes all paragraphs red?', 'p { color: red; }', ['<p color=red>', 'p = red'], 'CSS uses selector { property: value; }.'],
    ['Why is it important that a website works on phones and computers?', 'Many people browse on small screens; responsive design adapts the layout.', ['Phones cannot open websites.', 'It is not important.'], 'Think about screen sizes.'],
  ],
];

// ======================= Enrichment =======================
const STUDY_SKILLS = [
  [
    ['What is a good first step when starting homework?', 'Make a list of what needs to be done', ['Start with the TV on', 'Wait until bedtime'], 'Planning helps you finish.'],
    ['Why take short breaks while studying?', 'Breaks help your brain stay focused.', ['To avoid studying', 'Breaks are bad for learning'], 'Short, regular breaks work best.'],
    ['Where is the best place to study?', 'A quiet place with few distractions', ['In front of a loud video', 'In a crowded hallway'], 'Distractions make learning harder.'],
  ],
  [
    ['Which study method helps you remember the most?', 'Testing yourself (retrieval practice)', ['Rereading only', 'Highlighting everything'], 'Pulling information from memory strengthens it.'],
    ['You have a test in a week. What is the best plan?', 'Study a little each day', ['Study all night before the test', 'Skip studying'], 'Spacing out study beats cramming.'],
    ['What is a SMART goal?', 'Specific, Measurable, Achievable, Relevant and Time-bound', ['Simple, Messy, Any, Random, Tiny', 'A goal set by a computer'], 'A clear goal you can check.'],
  ],
  [
    ['Why is mixing different types of problems in practice (interleaving) useful?', 'It trains you to choose the right method, not just repeat one.', ['It makes practice easier.', 'It wastes time.'], 'Tests mix problem types too.'],
    ['You keep putting off a big project. Which strategy helps most?', 'Break it into small tasks with deadlines', ['Wait for motivation', 'Do it all the night before'], 'Small steps reduce the feeling of overload.'],
    ['After a test, what is the most useful thing to do with mistakes?', 'Find why each mistake happened and practice those skills', ['Ignore them', 'Only look at the score'], 'Mistakes show what to learn next.'],
  ],
];

const HEALTH = [
  [
    ['Which is a healthy snack?', 'An apple', ['A bag of candy', 'A can of soda'], 'Fruits and vegetables give your body vitamins.'],
    ['Why is sleep important?', 'It helps your body and brain rest and grow.', ['It is not important.', 'It makes you hungry.'], 'Children need lots of sleep.'],
    ['When should you wash your hands?', 'Before eating and after using the bathroom', ['Only once a week', 'Never'], 'Washing removes germs.'],
  ],
  [
    ['About how many minutes of physical activity should children get each day?', 'At least 60 minutes', ['5 minutes', 'None'], 'Health experts recommend an hour a day.'],
    ['Which food group gives you lots of energy from grains?', 'Bread, rice and pasta', ['Water', 'Salt'], 'Whole grains are a good choice.'],
    ['A friend seems sad for many days. What is a good way to help?', 'Listen and encourage them to talk to a trusted adult', ['Ignore them', 'Tell everyone their secret'], 'Mental health matters too.'],
  ],
  [
    ['Why should you read the nutrition facts label?', 'To compare sugar, sodium and nutrients in foods', ['To find the price', 'Labels are only decoration'], 'It helps you choose healthier foods.'],
    ['Which is a healthy way to manage stress?', 'Exercise, deep breathing or talking to someone', ['Skipping meals', 'Staying up all night'], 'Healthy coping helps your body and mind.'],
    ['Why is it unsafe to share prescription medicine?', 'It was prescribed for one person’s body and condition.', ['Medicine never works on others', 'Sharing is always safe'], 'Doctors choose doses for each patient.'],
  ],
];

const SPANISH = [
  [
    ['What does “hola” mean?', 'Hello', ['Goodbye', 'Thank you'], 'It is a greeting.'],
    ['How do you say “thank you” in Spanish?', 'Gracias', ['Por favor', 'Adiós'], 'You say it after someone helps you.'],
    ['What does “rojo” mean?', 'Red', ['Blue', 'Green'], 'It is a color.'],
    ['What number is “cinco”?', '5', ['4', '15'], 'Uno, dos, tres, cuatro, …'],
  ],
  [
    ['Which is the correct way to say “the house”?', 'la casa', ['el casa', 'los casa'], '“Casa” is a feminine noun.'],
    ['What does “Me llamo Ana” mean?', 'My name is Ana.', ['I live with Ana.', 'Ana is tall.'], '“Llamarse” is used for names.'],
    ['How do you say “I have two brothers”?', 'Tengo dos hermanos.', ['Tienes dos hermanos.', 'Tengo dos hermanas.'], '“Tengo” means I have; “hermanos” are brothers.'],
    ['What does “¿Cómo estás?” mean?', 'How are you?', ['Where are you?', 'Who are you?'], 'A common friendly question.'],
  ],
  [
    ['Choose the correct verb: “Nosotros ___ español.” (to speak)', 'hablamos', ['hablo', 'hablan'], '“Nosotros” (we) takes the -amos ending.'],
    ['Which sentence means “She is tired”?', 'Ella está cansada.', ['Ella es cansada.', 'Él está cansado.'], 'Use “estar” for temporary states.'],
    ['What does “Ayer fui al mercado” mean?', 'Yesterday I went to the market.', ['Tomorrow I will go to the market.', 'I go to the market every day.'], '“Ayer” means yesterday; “fui” is past tense.'],
    ['Which adjective agrees with “las flores”?', 'bonitas', ['bonito', 'bonita'], 'The noun is feminine and plural.'],
  ],
];

const ART = [
  [
    ['What are the three primary colors (for paint)?', 'Red, yellow and blue', ['Green, orange and purple', 'Black, white and gray'], 'They cannot be made by mixing other paint colors.'],
    ['What color do you get by mixing blue and yellow?', 'Green', ['Orange', 'Purple'], 'Think of grass.'],
    ['What do you get by mixing red and yellow?', 'Orange', ['Green', 'Brown'], 'Think of a sunset.'],
  ],
  [
    ['What are complementary colors?', 'Colors opposite each other on the color wheel', ['Colors next to each other', 'Only black and white'], 'Red and green are an example.'],
    ['Which is a warm color?', 'Orange', ['Blue', 'Green'], 'Warm colors remind us of fire and sun.'],
    ['What is a “tint”?', 'A color mixed with white', ['A color mixed with black', 'A primary color'], 'Tints are lighter.'],
  ],
  [
    ['What does “value” mean in art?', 'How light or dark a color is', ['How much the art costs', 'The size of the canvas'], 'Shading uses value.'],
    ['How can an artist show depth on a flat page?', 'Make far objects smaller and place them higher (perspective)', ['Make everything the same size', 'Use only one color'], 'Things look smaller when they are far away.'],
    ['What is the “rule of thirds”?', 'Placing key parts along lines that divide the picture into thirds', ['Using three colors only', 'Drawing three objects'], 'It helps make balanced, interesting compositions.'],
  ],
];

// Note values (in 4/4 time), computed.
const NOTES = [['whole note', 4], ['half note', 2], ['quarter note', 1], ['eighth note', 0.5]];
function musicRhythm(d, rand) {
  if (d === 1) { const [name, beats] = pick(rand, NOTES.slice(0, 3)); return input(`In 4/4 time, how many beats does a ${name} get?`, beats, ['A quarter note gets 1 beat.', 'A half note is two quarter notes; a whole note is four.'], {}); }
  const a = pick(rand, NOTES); const b = pick(rand, NOTES); const n = int(rand, 1, d === 2 ? 2 : 3);
  const total = a[1] * n + b[1];
  return input(`In 4/4 time, how many beats do ${n} ${a[0]}${n > 1 ? 's' : ''} and one ${b[0]} last altogether?`, total, ['Find the beats for each note, then add.', 'Whole = 4, half = 2, quarter = 1, eighth = ½.'], {});
}

export const CORE_SUBJECT_GENERATORS = {
  'digraphs': bank(DIGRAPHS),
  'vowel-patterns': bank(VOWEL_PATTERNS),
  'syllables': bank(SYLLABLES),
  'parts-of-speech': bank(PARTS_OF_SPEECH),
  'verb-tenses': bank(VERB_TENSES),
  'sentence-structure': bank(SENTENCES),
  'theme': bank(THEME),
  'authors-purpose': bank(AUTHOR_PURPOSE),
  'research-sources': bank(RESEARCH),
  'writing-revision': bank(REVISION),
  'push-pull': bank(PUSH_PULL),
  'living-needs': bank(LIVING_NEEDS),
  'weather-climate': bank(WEATHER),
  'light-sound': bank(LIGHT_SOUND),
  'inherited-traits': bank(TRAITS),
  'erosion-landforms': bank(EROSION),
  'natural-selection': bank(NATURAL_SELECTION),
  'human-impact': bank(HUMAN_IMPACT),
  'engineering-design': bank(ENGINEERING),
  'scientific-method': bank(EXPERIMENTS),
  'electricity-magnetism': bank(ELECTRICITY_MAGNETS),
  'solar-system': bank(SOLAR_SYSTEM),
  'body-systems': bank(BODY_SYSTEMS),
  'ecology': bank(ECOLOGY),
  'waves': waves,
  'chemical-reactions': chemicalReactions,
  'colonial-revolution': bank(COLONIAL_REVOLUTION),
  'civil-war-reconstruction': bank(CIVIL_WAR),
  'primary-sources': bank(PRIMARY_SOURCES),
  'world-geography': bank(WORLD_GEOGRAPHY),
  'economics-basics': bank(ECONOMICS_BASICS),
  'state-local-government': bank(STATE_LOCAL),
  'credit-interest': creditAndInterest,
  'algorithms': bank(ALGORITHMS_STEPS),
  'loops': loops,
  'data-representation': dataRepresentation,
  'search-sort': searchAlgorithms,
  'digital-citizenship': bank(DIGITAL_CITIZENSHIP),
  'cybersecurity': bank(CYBERSECURITY),
  'ai-literacy': bank(AI_LITERACY),
  'networks': bank(NETWORKS),
  'web-basics': bank(WEB_BASICS),
  'study-skills': bank(STUDY_SKILLS),
  'health-wellness': bank(HEALTH),
  'spanish-basics': bank(SPANISH),
  'art-color': bank(ART),
  'music-rhythm': musicRhythm,
};

// Authored banks, exposed for the bank tests.
export const CORE_BANKS = {
  DIGRAPHS, VOWEL_PATTERNS, SYLLABLES, PARTS_OF_SPEECH, VERB_TENSES, SENTENCES, THEME, AUTHOR_PURPOSE, RESEARCH, REVISION,
  PUSH_PULL, LIVING_NEEDS, WEATHER, LIGHT_SOUND, TRAITS, EROSION, NATURAL_SELECTION, HUMAN_IMPACT, ENGINEERING, EXPERIMENTS,
  ELECTRICITY_MAGNETS, SOLAR_SYSTEM, BODY_SYSTEMS, ECOLOGY, COLONIAL_REVOLUTION, CIVIL_WAR, PRIMARY_SOURCES, WORLD_GEOGRAPHY,
  ECONOMICS_BASICS, STATE_LOCAL, ALGORITHMS_STEPS, DIGITAL_CITIZENSHIP, CYBERSECURITY, AI_LITERACY, NETWORKS, WEB_BASICS,
  STUDY_SKILLS, HEALTH, SPANISH, ART,
};
