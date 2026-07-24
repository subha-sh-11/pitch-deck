"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TREATMENT, type SlideTreatment } from "@/lib/reference-profile";

/**
 * The reference-derived slide treatment (parsed from design_direction.referenceProfile by
 * lib/reference-profile) shared with every template under a SlideRenderer. Defaults to the
 * neutral treatment, so templates rendered without a provider (or without a profile) look
 * exactly as they always did.
 */
const SlideTreatmentContext = createContext<SlideTreatment>(DEFAULT_TREATMENT);

export const SlideTreatmentProvider = SlideTreatmentContext.Provider;

export function useSlideTreatment(): SlideTreatment {
  return useContext(SlideTreatmentContext);
}
