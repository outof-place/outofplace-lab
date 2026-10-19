"use server";

import { updateTag } from "next/cache";

import type { City } from "./get-stamp";

const cities: City[] = ["gdansk", "krakow"];

// A Server Action: updateTag works only here. It expires every entry tagged with this city, so
// the next render runs getStamp for that city again and reuses the other city's entry.
export async function clearCity(formData: FormData) {
  const city = formData.get("city");
  if (!cities.includes(city as City)) return;
  updateTag(`city-${city}`);
}
