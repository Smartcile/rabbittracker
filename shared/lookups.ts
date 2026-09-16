export const LOOKUP_KINDS = [
  "breed",
  "colour",
  "visit_type",
  "location",
  "vaccine_type",
  "route",
  "frequency",
  "reason",
  "care_type",
  "food_type",
  "faq_category",
  "supplier",
  "event_type",
] as const;

export type LookupKind = (typeof LOOKUP_KINDS)[number];

export const LOOKUP_KIND_LABELS: Record<LookupKind, string> = {
  breed: "Breeds",
  colour: "Colours",
  visit_type: "Visit types",
  location: "Locations",
  vaccine_type: "Vaccine types",
  route: "Treatment routes",
  frequency: "Treatment frequencies",
  reason: "Treatment reasons",
  care_type: "Care types",
  food_type: "Food types",
  faq_category: "FAQ categories",
  supplier: "Suppliers",
  event_type: "Calendar event types",
};

export type LookupDefault = {
  value: string;
  label: string;
  defaultInt?: number;
  defaultCents?: number;
};

export const DEFAULT_LOOKUPS: Record<LookupKind, LookupDefault[]> = {
  breed: [
    { value: "new_zealand_white", label: "New Zealand White" },
    { value: "lionhead", label: "Lionhead" },
    { value: "mini_lop", label: "Mini Lop" },
    { value: "netherland_dwarf", label: "Netherland Dwarf" },
    { value: "dutch", label: "Dutch" },
    { value: "rex", label: "Rex" },
    { value: "californian", label: "Californian" },
    { value: "angora", label: "Angora" },
    { value: "flemish_giant", label: "Flemish Giant" },
    { value: "mixed", label: "Mixed breed" },
  ],
  colour: [
    { value: "white", label: "White" },
    { value: "black", label: "Black" },
    { value: "grey", label: "Grey" },
    { value: "brown", label: "Brown" },
    { value: "agouti", label: "Agouti" },
    { value: "cream", label: "Cream" },
    { value: "tan", label: "Tan" },
    { value: "chinchilla", label: "Chinchilla" },
    { value: "harlequin", label: "Harlequin" },
    { value: "spotted", label: "Spotted" },
  ],
  visit_type: [
    { value: "check_up", label: "Check-up" },
    { value: "vaccination", label: "Vaccination" },
    { value: "dental", label: "Dental" },
    { value: "nail_trim", label: "Nail trim" },
    { value: "follow_up", label: "Follow-up" },
    { value: "desexing", label: "Desexing" },
  ],
  location: [
    { value: "clinic", label: "Clinic" },
    { value: "home_visit", label: "Home visit" },
  ],
  vaccine_type: [
    { value: "rhdv2", label: "RHDV2", defaultInt: 365 },
    { value: "myxomatosis", label: "Myxomatosis", defaultInt: 180 },
    { value: "other", label: "Other" },
  ],
  route: [
    { value: "oral", label: "Oral" },
    { value: "topical", label: "Topical" },
    { value: "injection", label: "Injection" },
    { value: "subcutaneous", label: "Subcutaneous" },
    { value: "ophthalmic", label: "Ophthalmic" },
    { value: "otic", label: "Otic (ear)" },
  ],
  frequency: [
    { value: "once_daily", label: "Once daily" },
    { value: "twice_daily", label: "Twice daily" },
    { value: "three_times_daily", label: "Three times daily" },
    { value: "every_8_hours", label: "Every 8 hours" },
    { value: "every_12_hours", label: "Every 12 hours" },
    { value: "every_other_day", label: "Every other day" },
    { value: "every_10_14_days", label: "Every 10–14 days" },
    { value: "once_weekly", label: "Once weekly" },
    { value: "twice_weekly", label: "Twice weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "as_needed", label: "As needed" },
    { value: "every_6_hours_as_needed", label: "Every 6 hours as needed" },
    { value: "as_directed", label: "As directed" },
  ],
  reason: [
    { value: "post_op_pain", label: "Post-op pain" },
    { value: "infection", label: "Infection" },
    { value: "gut_stasis", label: "Gut stasis" },
    { value: "dental_disease", label: "Dental disease" },
    { value: "parasites", label: "Parasites" },
    { value: "respiratory", label: "Respiratory" },
  ],
  care_type: [
    { value: "nails", label: "Nails", defaultInt: 30 },
    { value: "teeth", label: "Teeth", defaultInt: 90 },
    { value: "grooming", label: "Grooming", defaultInt: 60 },
  ],
  food_type: [
    { value: "hay", label: "Hay" },
    { value: "pellets", label: "Pellets" },
    { value: "greens", label: "Greens" },
    { value: "treats", label: "Treats" },
    { value: "other", label: "Other" },
  ],
  faq_category: [
    { value: "health", label: "Health" },
    { value: "diet", label: "Diet" },
    { value: "housing", label: "Housing" },
    { value: "behaviour", label: "Behaviour" },
    { value: "handling", label: "Handling" },
    { value: "grooming", label: "Grooming" },
    { value: "emergencies", label: "Emergencies" },
  ],
  supplier: [],
  event_type: [
    { value: "vet_visit", label: "Vet visit" },
    { value: "hay_collection", label: "Hay collection" },
    { value: "volunteer_run", label: "Volunteer run" },
    { value: "fundraiser", label: "Fundraiser" },
    { value: "cleaning", label: "Cleaning" },
    { value: "other", label: "Other" },
  ],
};

export function lookupKindHasInterval(kind: LookupKind): boolean {
  return kind === "vaccine_type" || kind === "care_type";
}

export function lookupKindHasCost(kind: LookupKind): boolean {
  return kind === "visit_type";
}
