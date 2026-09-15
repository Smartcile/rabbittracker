import type { BreedNormDto, SettingsDto } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { toast } from "../components/toast.ts";
import type { PageContext } from "../context.ts";
import { h } from "../dom.ts";

function gramsToKg(grams: number): string {
  return String(Number((grams / 1000).toFixed(3)));
}

function kgToGrams(value: string): number {
  return Math.round(Number(value) * 1000);
}

export function renderNormsPage(_ctx: PageContext): HTMLElement {
  const foodMin = h("input", { type: "number", min: "0", step: "1" });
  const foodMax = h("input", { type: "number", min: "0", step: "1" });
  const waterMin = h("input", { type: "number", min: "0", step: "1" });
  const waterMax = h("input", { type: "number", min: "0", step: "1" });
  const rateError = h("p", { class: "form-error" });
  rateError.style.display = "none";
  const saveRates = h("button", { class: "btn primary small", type: "button" }, "Save rates");

  const breedList = h("div", { class: "stack", style: { gap: "0" } });
  const newBreed = h("input", { placeholder: "Breed name" });
  const newMin = h("input", { type: "number", min: "0", step: "0.01", placeholder: "min kg" });
  const newMax = h("input", { type: "number", min: "0", step: "0.01", placeholder: "max kg" });
  const addBreed = h("button", { class: "btn outline small", type: "button" }, "Add breed");
  const addDefaults = h(
    "button",
    { class: "btn ghost small", type: "button" },
    "Add defaults",
  );

  async function loadRates(): Promise<void> {
    const { settings } = await api.get<{ settings: SettingsDto }>("/api/settings");
    foodMin.value = String(settings.foodMinGramsPerKg);
    foodMax.value = String(settings.foodMaxGramsPerKg);
    waterMin.value = String(settings.waterMinMilliLitresPerKg);
    waterMax.value = String(settings.waterMaxMilliLitresPerKg);
  }

  async function saveRatesNow(): Promise<void> {
    rateError.style.display = "none";
    saveRates.disabled = true;
    try {
      await api.put("/api/settings/norms", {
        foodMinGramsPerKg: Math.round(Number(foodMin.value)),
        foodMaxGramsPerKg: Math.round(Number(foodMax.value)),
        waterMinMilliLitresPerKg: Math.round(Number(waterMin.value)),
        waterMaxMilliLitresPerKg: Math.round(Number(waterMax.value)),
      });
      toast("Norms saved");
    } catch (err) {
      rateError.textContent = err instanceof Error ? err.message : "Something went wrong";
      rateError.style.display = "";
    } finally {
      saveRates.disabled = false;
    }
  }
  saveRates.addEventListener("click", () => void saveRatesNow());

  async function loadBreeds(): Promise<void> {
    const { norms } = await api.get<{ norms: BreedNormDto[] }>("/api/breed-norms");
    breedList.replaceChildren();
    if (norms.length === 0) {
      breedList.append(h("p", { class: "dim small", style: { margin: 0 } }, "No breed norms yet."));
      return;
    }
    for (const norm of norms) breedList.append(breedRow(norm));
  }

  function breedRow(norm: BreedNormDto): HTMLElement {
    const min = h("input", { type: "number", min: "0", step: "0.01", value: gramsToKg(norm.minGrams) });
    const max = h("input", { type: "number", min: "0", step: "0.01", value: gramsToKg(norm.maxGrams) });
    return h(
      "div",
      { class: "list-row" },
      h("span", { style: { flex: "1 1 8rem", minWidth: "0" } }, norm.breed),
      h("div", { class: "row", style: { gap: "0.3rem" } }, min, h("span", { class: "dim" }, "–"), max),
      h("span", { class: "dim small" }, "kg"),
      h("span", { class: "spacer" }),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => void saveRow(norm.id, min.value, max.value) },
        "Save",
      ),
      h(
        "button",
        { class: "btn ghost small", type: "button", onClick: () => void removeRow(norm.id) },
        "Delete",
      ),
    );
  }

  async function saveRow(id: number, min: string, max: string): Promise<void> {
    try {
      await api.patch(`/api/breed-norms/${id}`, {
        minGrams: kgToGrams(min),
        maxGrams: kgToGrams(max),
      });
      toast("Breed norm saved");
      await loadBreeds();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function removeRow(id: number): Promise<void> {
    try {
      await api.del(`/api/breed-norms/${id}`);
      toast("Breed norm removed");
      await loadBreeds();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  addBreed.addEventListener("click", async () => {
    const name = newBreed.value.trim();
    if (!name) {
      toast("Enter a breed name", "error");
      return;
    }
    try {
      await api.post("/api/breed-norms", {
        breed: name,
        minGrams: kgToGrams(newMin.value),
        maxGrams: kgToGrams(newMax.value),
      });
      newBreed.value = "";
      newMin.value = "";
      newMax.value = "";
      toast("Breed added");
      await loadBreeds();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  });

  addDefaults.addEventListener("click", async () => {
    try {
      const { added } = await api.post<{ added: string[] }>("/api/breed-norms/defaults");
      toast(added.length === 0 ? "All default breeds are already set up" : `Added ${added.join(", ")}`);
      await loadBreeds();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  });

  const container = h(
    "section",
    { class: "stack" },
    h(
      "div",
      { class: "card-title", style: { flexWrap: "wrap" } },
      h("h1", null, "Growth norms"),
      h("span", { class: "spacer" }),
      h("a", { class: "btn outline small", href: "#/settings" }, "Back to settings"),
    ),
    h(
      "p",
      { class: "dim small" },
      "Used to judge whether a bunny's weight and food/water intake are in a healthy range. Breed ranges are adult weights; growing bunnies are compared against the age-scaled share of them.",
    ),
    h(
      "div",
      { class: "card" },
      h("h2", null, "Consumption norms"),
      h(
        "p",
        { class: "dim small" },
        "Expected daily food and water per kilogram of body weight.",
      ),
      rateError,
      h(
        "div",
        { class: "filters" },
        h("div", { class: "field" }, h("label", null, "Food min (g/kg)"), foodMin),
        h("div", { class: "field" }, h("label", null, "Food max (g/kg)"), foodMax),
        h("div", { class: "field" }, h("label", null, "Water min (ml/kg)"), waterMin),
        h("div", { class: "field" }, h("label", null, "Water max (ml/kg)"), waterMax),
      ),
      h("div", { class: "row" }, saveRates),
    ),
    h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "card-title", style: { flexWrap: "wrap" } },
        h("h2", null, "Breed weight norms"),
        h("span", { class: "spacer" }),
        addDefaults,
      ),
      breedList,
      h(
        "div",
        { class: "field", style: { marginTop: "0.75rem" } },
        h("label", null, "Add a breed"),
        h("div", { class: "row wrap" }, newBreed, newMin, newMax, addBreed),
      ),
    ),
  );

  void loadRates();
  void loadBreeds();
  return container;
}
