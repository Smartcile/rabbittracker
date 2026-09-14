import { count } from "drizzle-orm";
import { db } from "../db/index.ts";
import { faqEntries } from "../db/schema.ts";

type SeedEntry = {
  category: string;
  question: string;
  answer: string;
};

const NOTE =
  "This is general guidance, not veterinary advice — contact your vet for medical concerns.";

const SEED: SeedEntry[] = [
  {
    category: "Diet",
    question: "What should my rabbit eat every day?",
    answer:
      "A rabbit's diet should be mostly hay or grass — around 80–90% of everything they eat. Add a small measured portion of plain rabbit pellets and a couple of handfuls of leafy greens. Fresh water must always be available. " +
      NOTE,
  },
  {
    category: "Diet",
    question: "How much hay should I give?",
    answer:
      "Offer unlimited fresh hay every day; a rabbit should eat roughly its own body size in hay daily. Good-quality hay smells sweet and has long strands. " +
      NOTE,
  },
  {
    category: "Diet",
    question: "Can rabbits eat fruit and vegetables?",
    answer:
      "Leafy greens such as cos lettuce, parsley, coriander and bok choy are good daily options. Fruit is high in sugar and should be a rare, small treat only. Avoid iceberg lettuce, avocado, onion, garlic, rhubarb and anything mouldy. " +
      NOTE,
  },
  {
    category: "Diet",
    question: "Why is hay so important?",
    answer:
      "Chewing hay wears down continuously growing teeth and keeps the gut moving. A rabbit that stops eating hay is at risk of dental disease and gut stasis. " +
      NOTE,
  },
  {
    category: "Health",
    question: "What is GI stasis and what should I watch for?",
    answer:
      "Gastrointestinal (GI) stasis is when the gut slows or stops. Warning signs include not eating, tiny or no droppings, sitting hunched, tooth grinding, and a bloated or gassy belly. It is an emergency — contact your vet straight away. " +
      NOTE,
  },
  {
    category: "Health",
    question: "Which vaccinations does my rabbit need?",
    answer:
      "In many countries rabbits are vaccinated against RHDV2 (rabbit haemorrhagic disease virus) and myxomatosis, with boosters at the interval your vet recommends. Ask your vet what is required where you live. " +
      NOTE,
  },
  {
    category: "Health",
    question: "How do I know if my rabbit is in pain?",
    answer:
      "Rabbits hide pain well. Signs include a hunched posture, tooth grinding, reduced appetite, unusual quietness, squinting, and changes in droppings. Contact your vet if you notice these. " +
      NOTE,
  },
  {
    category: "Health",
    question: "When should I see a vet immediately?",
    answer:
      "Treat not eating, no droppings for 12 hours, laboured breathing, a bloated belly, flystrike, sudden collapse or a visibly injured rabbit as emergencies. Call your vet immediately. " +
      NOTE,
  },
  {
    category: "Health",
    question: "How often should I weigh my rabbit?",
    answer:
      "Weigh weekly and log it here. Losing more than 2–5% of body weight, especially over just a few days, is an early warning sign of illness. " +
      NOTE,
  },
  {
    category: "Housing",
    question: "How big should my rabbit's enclosure be?",
    answer:
      "Rabbits need room to run, jump and stand upright. As a guide, a single rabbit should have at least 3 m² of permanent space plus daily free-roam time, and bonded pairs need more. Bigger is always better. " +
      NOTE,
  },
  {
    category: "Housing",
    question: "Should my rabbit live indoors or outdoors?",
    answer:
      "Indoors is safer from predators and extreme weather, and rabbits are social with their people. Outdoors needs a secure, weatherproof hutch and run — keep heat, cold and predators in mind. " +
      NOTE,
  },
  {
    category: "Housing",
    question: "How do I keep my rabbit cool in summer?",
    answer:
      "Rabbits cannot sweat and overheat easily. Provide shade, frozen water bottles wrapped in towels, cool floor tiles and good ventilation. Bring outdoor rabbits inside on hot days — heat stress is an emergency. " +
      NOTE,
  },
  {
    category: "Grooming",
    question: "How often should I trim my rabbit's nails?",
    answer:
      "Most rabbits need a trim every 4–8 weeks, depending on how much they wear their nails down. Trim just the tip and avoid the quick (the pink blood supply). If unsure, ask your vet or a groomer to show you. " +
      NOTE,
  },
  {
    category: "Grooming",
    question: "Does my rabbit need brushing?",
    answer:
      "Regular brushing — daily during a moult — reduces swallowed fur and hairballs. Long-haired breeds need more frequent grooming. " +
      NOTE,
  },
  {
    category: "Grooming",
    question: "What are the signs of dental problems?",
    answer:
      "Watch for dropping food, drooling, weight loss, reduced hay eating, weepy eyes or a wet chin. Rabbit teeth grow continuously and dental disease is common; see your vet if you notice these signs. " +
      NOTE,
  },
  {
    category: "Social",
    question: "Should I get a companion for my rabbit?",
    answer:
      "Rabbits are highly social and usually thrive with a compatible desexed companion of their own kind. Bonding must be done slowly and carefully, ideally with help from a rescue or vet. " +
      NOTE,
  },
];

export async function ensureFaqSeed(): Promise<void> {
  const [{ value }] = await db.select({ value: count() }).from(faqEntries);
  if (value > 0) return;
  const perCategory = new Map<string, number>();
  const values = SEED.map((entry) => {
    const order = perCategory.get(entry.category) ?? 0;
    perCategory.set(entry.category, order + 1);
    return { ...entry, sortOrder: order };
  });
  await db.insert(faqEntries).values(values);
}
