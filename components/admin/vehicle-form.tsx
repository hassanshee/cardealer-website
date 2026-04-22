"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUp, ImagePlus, LoaderCircle, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cleanupUploadedVehicleImagesAction,
  saveVehicleAction,
} from "@/lib/actions/admin-actions";
import {
  SUPPORTED_IMAGE_MIME_TYPES,
  VEHICLE_IMAGE_UPLOAD_MAX_FILES,
  validateVehicleImageUpload,
} from "@/lib/vehicle-image-upload";
import { buildVehicleDraftIdentifiers } from "@/lib/vehicle-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ActionState,
  Location,
  Vehicle,
  VehicleImageInput,
} from "@/types/dealership";
import { cn } from "@/lib/utils";

type EditableImage = {
  imageUrl: string;
  altText?: string | null;
  cloudinaryPublicId?: string | null;
  sortOrder: number;
  isHero: boolean;
  uploadState?: "uploaded" | "pending_file" | "pending_url";
  sourceUrl?: string | null;
  pendingFileId?: string | null;
};

type PendingFile = {
  id: string;
  file: File;
  previewUrl: string;
};

type UploadedPendingFile = {
  publicId: string;
  secureUrl: string;
};

type PreparedUploadPayload = {
  allowedFormats: string[];
  apiKey: string;
  assetFolder: string;
  signature: string;
  slug: string;
  stockCode: string;
  timestamp: number;
  uploadUrl: string;
};

const initialState: ActionState = { success: false, message: "" };
const selectClassName =
  "h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-stone-900 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

const editorSections = [
  { id: "quick-fill", label: "Quick fill" },
  { id: "basics", label: "Basics" },
  { id: "listing-setup", label: "Listing setup" },
  { id: "gallery", label: "Gallery" },
  { id: "vehicle-details", label: "Vehicle details" },
  { id: "description", label: "Description" },
] as const;

const conditionOptions = [
  "Foreign used",
  "Locally used",
  "Brand new",
  "Trade-in unit",
];

const transmissionOptions = ["Automatic", "Manual", "CVT"];
const fuelTypeOptions = ["Petrol", "Diesel", "Hybrid", "Electric"];
const driveTypeOptions = ["2WD", "4WD", "AWD", "RWD", "FWD"];
const bodyTypeOptions = ["SUV", "Sedan", "Pickup", "Hatchback", "Van", "Coupe"];
const commonMakes = [
  "Toyota",
  "Nissan",
  "Subaru",
  "Mazda",
  "Honda",
  "Mitsubishi",
  "Isuzu",
  "Ford",
  "BMW",
  "Mercedes-Benz",
  "Lexus",
  "Volkswagen",
  "Audi",
  "Land Rover",
  "Range Rover",
  "Suzuki",
  "Kia",
  "Hyundai",
  "Peugeot",
  "Renault",
];

type ParsedDealerListing = {
  make?: string;
  model?: string;
  year?: number;
  title?: string;
  priceKes?: number;
  condition?: string;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  driveType?: string;
  bodyType?: string;
  engineCapacity?: string;
  color?: string;
  locationId?: string;
  negotiable?: boolean;
  stockCategory?: Vehicle["stockCategory"];
  accidentFree?: boolean;
  originalPaint?: boolean;
  tradeInAccepted?: boolean;
  features?: string[];
  hirePurchase?: {
    depositKes?: number;
    termMonths?: number;
  };
  notes?: string[];
};

function makeEditableImages(vehicle?: Vehicle | null): EditableImage[] {
  if (!vehicle) {
    return [];
  }

  return vehicle.images.map((image) => ({
    imageUrl: image.imageUrl,
    altText: image.altText,
    cloudinaryPublicId: image.cloudinaryPublicId,
    sortOrder: image.sortOrder,
    isHero: image.isHero,
    uploadState: "uploaded",
    sourceUrl: null,
    pendingFileId: null,
  }));
}

function getImageLabel(imageUrl: string, fallbackIndex: number) {
  try {
    const pathname = new URL(imageUrl).pathname;
    const filename = pathname.split("/").pop();

    return filename || `Image ${fallbackIndex + 1}`;
  } catch {
    return `Image ${fallbackIndex + 1}`;
  }
}

function FormSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-32 space-y-4 border-t border-border/70 pt-6 first:border-t-0 first:pt-0 lg:scroll-mt-24",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-stone-950">{title}</h3>
        <p className="text-sm text-stone-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function VehicleForm({
  locations,
  vehicle,
  initialNotice,
}: {
  locations: Location[];
  vehicle?: Vehicle | null;
  initialNotice?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const [state, setState] = useState<ActionState>(initialState);
  const [successNotice, setSuccessNotice] = useState(initialNotice || "");
  const [images, setImages] = useState<EditableImage[]>(() =>
    makeEditableImages(vehicle),
  );
  const [uploadError, setUploadError] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [title, setTitle] = useState(vehicle?.title || "");
  const [make, setMake] = useState(vehicle?.make || "");
  const [model, setModel] = useState(vehicle?.model || "");
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : "");
  const [quickPaste, setQuickPaste] = useState("");
  const [quickPasteNotice, setQuickPasteNotice] = useState("");
  const [requiredSnapshot, setRequiredSnapshot] = useState({
    price: "",
    condition: "",
    mileage: "",
    transmission: "",
    fuelType: "",
    description: "",
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialNotice ? new Date().toISOString() : null,
  );
  const filePickerRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const pendingFilesRef = useRef<PendingFile[]>([]);
  const normalizedImages = useMemo(() => normalizeImages(images), [images]);
  const isEditing = Boolean(vehicle?.id);

  function normalizeImages(nextImages: EditableImage[]) {
    const heroIndex = nextImages.findIndex((image) => image.isHero);
    const resolvedHeroIndex =
      heroIndex >= 0 ? heroIndex : nextImages.length ? 0 : -1;

    return nextImages.map((image, index) => {
      const normalizedImage: EditableImage = {
        ...image,
        sortOrder: index,
        isHero: index === resolvedHeroIndex,
      };

      if (!normalizedImage.uploadState) {
        normalizedImage.uploadState = normalizedImage.cloudinaryPublicId
          ? "uploaded"
          : normalizedImage.sourceUrl
            ? "pending_url"
            : "uploaded";
      }

      return normalizedImage;
    });
  }

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    if (!initialNotice) {
      return;
    }

    setSuccessNotice(initialNotice);
    setLastSavedAt(new Date().toISOString());
    setHasUnsavedChanges(false);
  }, [initialNotice]);

  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl),
      );
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      captureRequiredSnapshot();
    });
  }, [vehicle]);

  function getFieldError(name: string) {
    return state.fieldErrors?.[name]?.[0];
  }

  function getFieldErrorId(name: string) {
    return `${name}-error`;
  }

  function getFieldProps(name: string) {
    const error = getFieldError(name);

    return {
      "aria-describedby": error ? getFieldErrorId(name) : undefined,
      "aria-invalid": error ? true : undefined,
      className: error
        ? "border-red-500 focus-visible:border-red-600"
        : undefined,
    };
  }

  function openFilePicker() {
    filePickerRef.current?.click();
  }

  function clearSuccessNotice() {
    setSuccessNotice("");
  }

  function setGlobalError(message: string) {
    setState((current) => ({
      ...current,
      message,
      success: false,
    }));
  }

  function markUnsaved() {
    setHasUnsavedChanges(true);
    clearSuccessNotice();
  }

  function formatCurrency(value: number) {
    return value.toLocaleString("en-KE");
  }

  function normalizeDealerText(text: string) {
    return text.replace(/\r/g, "\n").replace(/\t/g, " ").trim();
  }

  function parseMoney(value: string) {
    const cleaned = value.replace(/,/g, "").trim();
    const match = cleaned.match(/^(\d+(?:\.\d+)?)([mk])?$/i);
    if (!match) {
      return null;
    }
    const amount = Number(match[1]);
    if (Number.isNaN(amount)) {
      return null;
    }
    const suffix = match[2]?.toLowerCase();
    if (suffix === "m") {
      return Math.round(amount * 1_000_000);
    }
    if (suffix === "k") {
      return Math.round(amount * 1_000);
    }
    return Math.round(amount);
  }

  function extractPrice(text: string) {
    const withSuffix = text.match(/\b(\d+(?:\.\d+)?)\s*([mk])\b/i);
    if (withSuffix) {
      return parseMoney(`${withSuffix[1]}${withSuffix[2]}`);
    }

    const currencyMatch = text.match(
      /\b(?:kes|ksh|kshs)\b[^0-9]*([0-9][0-9,]*(?:\.\d+)?)/i,
    );
    if (currencyMatch) {
      return parseMoney(currencyMatch[1]);
    }

    const priceLine = text
      .split("\n")
      .find((line) => /price|offer/i.test(line));
    if (priceLine) {
      const fallback = priceLine.match(/([0-9][0-9,]*(?:\.\d+)?)(?:\s*[mk])?/i);
      if (fallback?.[0]) {
        return parseMoney(fallback[0].replace(/\s+/g, ""));
      }
    }

    return null;
  }

  function extractYear(text: string) {
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
  }

  function extractEngineCapacity(text: string) {
    const match = text.match(/\b(\d{3,4})\s*cc\b/i);
    if (!match) {
      return null;
    }
    const raw = Number(match[1]);
    if (Number.isNaN(raw)) {
      return null;
    }
    const normalized = raw < 500 ? raw * 10 : raw;
    return `${normalized}cc`;
  }

  function extractFuelType(text: string) {
    if (/diesel/i.test(text)) {
      return "Diesel";
    }
    if (/petrol/i.test(text)) {
      return "Petrol";
    }
    if (/hybrid/i.test(text)) {
      return "Hybrid";
    }
    if (/electric/i.test(text)) {
      return "Electric";
    }
    return null;
  }

  function extractTransmission(text: string) {
    if (/automatic/i.test(text)) {
      return "Automatic";
    }
    if (/manual/i.test(text)) {
      return "Manual";
    }
    if (/cvt/i.test(text)) {
      return "CVT";
    }
    return null;
  }

  function extractDriveType(text: string) {
    const matches = text.match(/\b(4wd|2wd|awd|rwd|fwd)\b/gi);
    if (!matches?.length) {
      return null;
    }
    const unique = [...new Set(matches.map((item) => item.toUpperCase()))];
    return unique.length > 1 ? unique.join("/") : unique[0];
  }

  function extractCondition(text: string) {
    if (/traded[-\s]?in/i.test(text)) {
      return "Trade-in unit";
    }
    if (/very clean/i.test(text)) {
      return "Very clean";
    }
    if (/clean unit/i.test(text)) {
      return "Clean unit";
    }
    if (/brand new|new\b/i.test(text)) {
      return "Brand new";
    }
    if (/foreign used/i.test(text)) {
      return "Foreign used";
    }
    if (/locally used/i.test(text)) {
      return "Locally used";
    }
    return null;
  }

  function extractHirePurchase(text: string) {
    if (!/hire purchase|financing/i.test(text)) {
      return null;
    }
    const depositMatch = text.match(/deposit\s*([0-9][0-9,]*(?:\.\d+)?)([mk])?/i);
    const termMatch = text.match(/\b(\d{1,2})\s*months?\b/i);
    const depositKes = depositMatch?.[0]
      ? parseMoney(`${depositMatch[1]}${depositMatch[2] || ""}`)
      : null;

    return {
      depositKes: depositKes || undefined,
      termMonths: termMatch ? Number(termMatch[1]) : undefined,
    };
  }

  function extractMakeModel(text: string) {
    const makeMatch = text.match(/\bmake\s*:\s*([a-z0-9\- ]+)/i);
    const modelMatch = text.match(/\bmodel\s*:\s*([a-z0-9\- ]+)/i);

    if (makeMatch || modelMatch) {
      return {
        make: makeMatch?.[1]?.trim(),
        model: modelMatch?.[1]?.trim(),
      };
    }

    const firstLine = text.split("\n").find((line) => line.trim().length > 2);
    if (!firstLine) {
      return {};
    }
    const cleaned = firstLine.replace(/[^a-z0-9\s-]/gi, " ").trim();
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      return {};
    }

    const makeIndex = tokens.findIndex((token) =>
      commonMakes.some(
        (make) => make.toLowerCase() === token.toLowerCase(),
      ),
    );
    if (makeIndex >= 0) {
      const make = commonMakes.find(
        (value) => value.toLowerCase() === tokens[makeIndex]?.toLowerCase(),
      );
      const model = tokens
        .slice(makeIndex + 1)
        .filter((token) => !/^(19|20)\d{2}$/.test(token))
        .join(" ")
        .trim();
      return {
        make: make || tokens[makeIndex],
        model: model || undefined,
      };
    }

    return {
      make: tokens[0],
      model:
        tokens
          .slice(1)
          .filter((token) => !/^(19|20)\d{2}$/.test(token))
          .join(" ")
          .trim() || undefined,
    };
  }

  function buildSuggestedTitle(parsed: ParsedDealerListing) {
    const parts = [];
    const base = [parsed.make, parsed.model].filter(Boolean).join(" ");
    if (base) {
      parts.push(base);
    }
    if (parsed.year) {
      parts.push(String(parsed.year));
    }
    if (parsed.accidentFree) {
      parts.push("Accident-free");
    }
    return parts.join(" • ");
  }

  function buildSuggestedDescription(parsed: ParsedDealerListing) {
    const notes: string[] = [];

    if (parsed.accidentFree && parsed.originalPaint) {
      notes.push("Accident-free with original paint.");
    } else if (parsed.accidentFree) {
      notes.push("Accident-free unit.");
    } else if (parsed.originalPaint) {
      notes.push("Original paint finish.");
    }

    parsed.features?.forEach((feature) => {
      notes.push(feature);
    });

    if (parsed.tradeInAccepted) {
      notes.push("Trade-in accepted.");
    }

    if (parsed.hirePurchase?.depositKes || parsed.hirePurchase?.termMonths) {
      const deposit =
        parsed.hirePurchase.depositKes != null
          ? `Deposit KES ${formatCurrency(parsed.hirePurchase.depositKes)}`
          : null;
      const term = parsed.hirePurchase.termMonths
        ? `Balance over ${parsed.hirePurchase.termMonths} months`
        : null;
      const line = [deposit, term].filter(Boolean).join(", ");
      if (line) {
        notes.push(`Hire purchase available. ${line}.`);
      }
    }

    parsed.notes?.forEach((note) => notes.push(note));

    return notes.join(" ");
  }

  function parseDealerListing(text: string): ParsedDealerListing {
    const normalized = normalizeDealerText(text);

    if (!normalized) {
      return {};
    }

    const upper = normalized.toUpperCase();
    const { make, model } = extractMakeModel(normalized);
    const yearValue = extractYear(normalized) || undefined;
    const priceKes = extractPrice(normalized) || undefined;
    const accidentFree = /accident[-\s]?free/i.test(normalized);
    const originalPaint = /original paint/i.test(normalized);
    const tradeInAccepted = /trade[-\s]?in accepted/i.test(normalized);
    const negotiable = /negotiable|best offer|neg\b/i.test(normalized);
    const condition = extractCondition(normalized) || undefined;
    const engineCapacity = extractEngineCapacity(normalized) || undefined;
    const fuelType = extractFuelType(normalized) || undefined;
    const transmission = extractTransmission(normalized) || undefined;
    const driveType = extractDriveType(upper) || undefined;
    const hirePurchase = extractHirePurchase(normalized) || undefined;

    const features: string[] = [];
    if (/functional ac|ac\b/i.test(normalized)) {
      features.push("Functional AC.");
    }
    if (/sunroof|moonroof/i.test(normalized)) {
      features.push("Functional sunroof.");
    }
    if (/alloy/i.test(normalized)) {
      features.push("Alloy rims.");
    }
    if (/new tyres|new tires/i.test(normalized)) {
      features.push("New tyres.");
    }
    if (/fully loaded/i.test(normalized)) {
      features.push("Fully loaded.");
    }
    if (/well maintained/i.test(normalized)) {
      features.push("Well maintained.");
    }
    if (/buy & drive|buy and drive/i.test(normalized)) {
      features.push("Buy and drive ready.");
    }

    const notes: string[] = [];
    if (/luxury/i.test(normalized)) {
      notes.push("Luxury interior.");
    }
    if (/spacious/i.test(normalized)) {
      notes.push("Spacious interior.");
    }

    const stockCategory = /traded[-\s]?in/i.test(normalized)
      ? "traded_in"
      : undefined;

    const title = buildSuggestedTitle({
      make,
      model,
      year: yearValue,
      accidentFree,
    });

    const locationId = locations.find((location) => {
      const name = location.name.toLowerCase();
      const city = location.city.toLowerCase();
      const textLower = normalized.toLowerCase();
      return textLower.includes(name) || textLower.includes(city);
    })?.id;

    return {
      make: make || undefined,
      model: model || undefined,
      year: yearValue,
      title: title || undefined,
      priceKes,
      condition,
      transmission,
      fuelType,
      driveType,
      engineCapacity,
      locationId,
      negotiable,
      stockCategory,
      accidentFree,
      originalPaint,
      tradeInAccepted,
      features,
      hirePurchase: hirePurchase || undefined,
      notes,
    };
  }

  function setFormValue(name: string, value?: string) {
    const element = formRef.current?.elements.namedItem(name);
    if (!element || value === undefined || value === null) {
      return;
    }

    if (element instanceof HTMLInputElement) {
      element.value = value;
      return;
    }

    if (element instanceof HTMLTextAreaElement) {
      element.value = value;
      return;
    }

    if (element instanceof HTMLSelectElement) {
      element.value = value;
    }
  }

  function setFormChecked(name: string, checked?: boolean) {
    const element = formRef.current?.elements.namedItem(name);
    if (!(element instanceof HTMLInputElement) || element.type !== "checkbox") {
      return;
    }
    element.checked = Boolean(checked);
  }

  function captureRequiredSnapshot() {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const readValue = (name: string) => {
      const element = form.elements.namedItem(name);
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        return element.value || "";
      }
      return "";
    };

    setRequiredSnapshot({
      price: readValue("price"),
      condition: readValue("condition"),
      mileage: readValue("mileage"),
      transmission: readValue("transmission"),
      fuelType: readValue("fuelType"),
      description: readValue("description"),
    });
  }

  function applyParsedListing(parsed: ParsedDealerListing) {
    if (!parsed) {
      return;
    }

    if (parsed.make) {
      setMake(parsed.make);
    }
    if (parsed.model) {
      setModel(parsed.model);
    }
    if (parsed.year) {
      setYear(String(parsed.year));
    }
    if (parsed.title && !title.trim()) {
      setTitle(parsed.title);
    }

    if (parsed.priceKes != null) {
      setFormValue("price", String(parsed.priceKes));
    }
    if (parsed.condition) {
      setFormValue("condition", parsed.condition);
    }
    if (parsed.mileage != null) {
      setFormValue("mileage", String(parsed.mileage));
    }
    if (parsed.transmission) {
      setFormValue("transmission", parsed.transmission);
    }
    if (parsed.fuelType) {
      setFormValue("fuelType", parsed.fuelType);
    }
    if (parsed.driveType) {
      setFormValue("driveType", parsed.driveType);
    }
    if (parsed.bodyType) {
      setFormValue("bodyType", parsed.bodyType);
    }
    if (parsed.engineCapacity) {
      setFormValue("engineCapacity", parsed.engineCapacity);
    }
    if (parsed.color) {
      setFormValue("color", parsed.color);
    }
    if (parsed.locationId) {
      setFormValue("locationId", parsed.locationId);
    }
    if (parsed.stockCategory) {
      setFormValue("stockCategory", parsed.stockCategory);
    }

    if (parsed.negotiable !== undefined) {
      setFormChecked("negotiable", parsed.negotiable);
    }

    const descriptionElement = formRef.current?.elements.namedItem("description");
    if (
      descriptionElement instanceof HTMLTextAreaElement &&
      !descriptionElement.value.trim()
    ) {
      const description = buildSuggestedDescription(parsed);
      if (description) {
        descriptionElement.value = description;
      }
    }

    markUnsaved();
    captureRequiredSnapshot();
  }

  function handleQuickPaste() {
    if (!quickPaste.trim()) {
      setQuickPasteNotice("Paste a dealer message to auto-fill fields.");
      return;
    }

    const parsed = parseDealerListing(quickPaste);
    applyParsedListing(parsed);

    const applied = [
      parsed.make ? "make" : null,
      parsed.model ? "model" : null,
      parsed.year ? "year" : null,
      parsed.priceKes ? "price" : null,
      parsed.engineCapacity ? "engine" : null,
      parsed.fuelType ? "fuel" : null,
      parsed.locationId ? "location" : null,
    ].filter(Boolean);

    setQuickPasteNotice(
      applied.length
        ? `Auto-filled: ${applied.join(", ")}. Please review the rest.`
        : "Parsed the message. Please review fields.",
    );
  }

  const requiredMissing = useMemo(() => {
    const missing: string[] = [];

    const missingNumber = (value: string) => {
      const numeric = Number(value);
      return !value || Number.isNaN(numeric) || numeric <= 0;
    };

    if (!title.trim()) {
      missing.push("Title");
    }
    if (!make.trim()) {
      missing.push("Make");
    }
    if (!model.trim()) {
      missing.push("Model");
    }
    const yearValue = Number(year);
    if (!year.trim() || Number.isNaN(yearValue) || yearValue <= 0) {
      missing.push("Year");
    }
    if (missingNumber(requiredSnapshot.price)) {
      missing.push("Price");
    }
    if (!requiredSnapshot.condition.trim()) {
      missing.push("Condition");
    }
    if (missingNumber(requiredSnapshot.mileage)) {
      missing.push("Mileage");
    }
    if (!requiredSnapshot.transmission.trim()) {
      missing.push("Transmission");
    }
    if (!requiredSnapshot.fuelType.trim()) {
      missing.push("Fuel type");
    }
    if (requiredSnapshot.description.trim().length < 20) {
      missing.push("Description");
    }

    return missing;
  }, [make, model, requiredSnapshot, title, year]);

  function getSaveStatusLabel() {
    if (isSubmitting) {
      return "Saving changes";
    }

    if (hasUnsavedChanges) {
      return "Unsaved changes";
    }

    if (lastSavedAt) {
      return "Saved just now";
    }

    return isEditing ? "No unsaved changes" : "Ready to create";
  }

  function getSaveStatusVariant() {
    if (isSubmitting) {
      return "accent" as const;
    }

    if (hasUnsavedChanges) {
      return "muted" as const;
    }

    return "success" as const;
  }

  function ensureImageLimit(nextCount: number) {
    if (nextCount > VEHICLE_IMAGE_UPLOAD_MAX_FILES) {
      throw new Error(
        `Each vehicle can include up to ${VEHICLE_IMAGE_UPLOAD_MAX_FILES} images.`,
      );
    }
  }

  async function prepareCloudinaryUpload() {
    const response = await fetch("/api/admin/cloudinary/sign", {
      body: JSON.stringify({
        id: vehicle?.id || undefined,
        make,
        model,
        title,
        year: Number(year) || 0,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const data = (await response.json().catch(() => null)) as
      | ({ message?: string } & Partial<PreparedUploadPayload>)
      | null;

    if (!response.ok || !data) {
      throw new Error(
        data?.message || "We could not prepare the Cloudinary upload.",
      );
    }

    return data as PreparedUploadPayload;
  }

  async function uploadFileToCloudinary(
    file: File,
    payload: PreparedUploadPayload,
  ) {
    const cloudinaryFormData = new FormData();
    cloudinaryFormData.set("allowed_formats", payload.allowedFormats.join(","));
    cloudinaryFormData.set("api_key", payload.apiKey);
    cloudinaryFormData.set("asset_folder", payload.assetFolder);
    cloudinaryFormData.set("file", file);
    cloudinaryFormData.set("signature", payload.signature);
    cloudinaryFormData.set("timestamp", String(payload.timestamp));
    cloudinaryFormData.set("unique_filename", "true");
    cloudinaryFormData.set("use_filename", "true");

    const response = await fetch(payload.uploadUrl, {
      body: cloudinaryFormData,
      method: "POST",
    });
    const data = (await response.json().catch(() => null)) as
      | {
          error?: { message?: string };
          public_id?: string;
          secure_url?: string;
        }
      | null;

    if (!response.ok || !data?.public_id || !data.secure_url) {
      throw new Error(data?.error?.message || "Image upload failed.");
    }

    return {
      publicId: data.public_id,
      secureUrl: data.secure_url,
    } satisfies UploadedPendingFile;
  }

  async function uploadPendingFiles() {
    const pendingImages = normalizedImages.filter(
      (image): image is EditableImage & { uploadState: "pending_file"; pendingFileId: string } =>
        image.uploadState === "pending_file" && Boolean(image.pendingFileId),
    );

    if (!pendingImages.length) {
      return {
        newUploadPublicIds: [] as string[],
        preparedUpload: null as PreparedUploadPayload | null,
        uploadedByPendingId: new Map<string, UploadedPendingFile>(),
      };
    }

    const preparedUpload = await prepareCloudinaryUpload();
    const pendingFileLookup = new Map(
      pendingFilesRef.current.map((item) => [item.id, item]),
    );
    const uploadedByPendingId = new Map<string, UploadedPendingFile>();
    const newUploadPublicIds: string[] = [];

    try {
      for (const image of pendingImages) {
        const pendingFile = pendingFileLookup.get(image.pendingFileId);

        if (!pendingFile) {
          throw new Error("One staged file is missing. Add it again and save.");
        }

        validateVehicleImageUpload(pendingFile.file);
        const uploaded = await uploadFileToCloudinary(
          pendingFile.file,
          preparedUpload,
        );
        uploadedByPendingId.set(image.pendingFileId, uploaded);
        newUploadPublicIds.push(uploaded.publicId);
      }
    } catch (error) {
      if (newUploadPublicIds.length) {
        await cleanupUploadedVehicleImagesAction(newUploadPublicIds);
      }

      throw error;
    }

    return {
      newUploadPublicIds,
      preparedUpload,
      uploadedByPendingId,
    };
  }

  function buildSubmissionImages(
    uploadedByPendingId: Map<string, UploadedPendingFile>,
  ): VehicleImageInput[] {
    return normalizedImages.map((image) => {
      if (image.uploadState === "pending_file") {
        const uploaded = image.pendingFileId
          ? uploadedByPendingId.get(image.pendingFileId)
          : null;

        if (!uploaded) {
          throw new Error("One staged file is missing. Add it again and save.");
        }

        return {
          altText: image.altText,
          cloudinaryPublicId: uploaded.publicId,
          imageUrl: uploaded.secureUrl,
          isHero: image.isHero,
          sortOrder: image.sortOrder,
          sourceUrl: null,
          uploadState: "uploaded",
        } satisfies VehicleImageInput;
      }

      if (image.uploadState === "pending_url") {
        return {
          altText: image.altText,
          cloudinaryPublicId: image.cloudinaryPublicId || null,
          imageUrl: image.imageUrl,
          isHero: image.isHero,
          sortOrder: image.sortOrder,
          sourceUrl: image.sourceUrl || image.imageUrl,
          uploadState: "pending_url",
        } satisfies VehicleImageInput;
      }

      return {
        altText: image.altText,
        cloudinaryPublicId: image.cloudinaryPublicId || null,
        imageUrl: image.imageUrl,
        isHero: image.isHero,
        sortOrder: image.sortOrder,
        sourceUrl: null,
        uploadState: "uploaded",
      } satisfies VehicleImageInput;
    });
  }

  async function submitVehicleForm() {
    if (!formRef.current) {
      return;
    }

    setUploadError("");
    setState(initialState);
    clearSuccessNotice();

    try {
      const draftIdentifiers = buildVehicleDraftIdentifiers({
        make,
        model,
        title,
        year: Number(year) || 0,
      });
      const {
        newUploadPublicIds,
        preparedUpload,
        uploadedByPendingId,
      } = await uploadPendingFiles();
      const formData = new FormData(formRef.current);
      formData.set(
        "imagesJson",
        JSON.stringify(buildSubmissionImages(uploadedByPendingId)),
      );
      formData.set("newUploadPublicIdsJson", JSON.stringify(newUploadPublicIds));

      if (preparedUpload) {
        formData.set("resolvedStockCode", preparedUpload.stockCode);
        formData.set("resolvedSlug", preparedUpload.slug);
      } else {
        formData.set("resolvedStockCode", draftIdentifiers.stockCode);
        if (draftIdentifiers.slug) {
          formData.set("resolvedSlug", draftIdentifiers.slug);
        }
      }

      const result = await saveVehicleAction(initialState, formData);

      if (result.success && result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }

      if (result.success) {
        setState(initialState);
        setHasUnsavedChanges(false);
        setLastSavedAt(new Date().toISOString());
        setSuccessNotice(result.message || "Vehicle saved successfully.");
        return;
      }

      setState(result);
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "We could not save the vehicle right now.",
      );
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSubmitting(() => {
      void submitVehicleForm();
    });
  }

  function addManualImage() {
    const nextUrl = manualImageUrl.trim();

    if (!nextUrl) {
      return;
    }

    try {
      ensureImageLimit(normalizedImages.length + 1);
      const parsedUrl = new URL(nextUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Use an http or https image URL.");
      }
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Use a valid image URL before staging it.",
      );
      return;
    }

    setUploadError("");
    setState(initialState);
    markUnsaved();
    setImages((current) =>
      normalizeImages([
        ...current,
        {
          imageUrl: nextUrl,
          sourceUrl: nextUrl,
          sortOrder: current.length,
          isHero: current.length === 0,
          uploadState: "pending_url",
          pendingFileId: null,
        },
      ]),
    );
    setManualImageUrl("");
  }

  function uploadFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    try {
      ensureImageLimit(normalizedImages.length + files.length);

      const nextPendingFiles = Array.from(files).map((file) => {
        validateVehicleImageUpload(file);
const pendingFileId =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return {
          id: pendingFileId,
          file,
          previewUrl: URL.createObjectURL(file),
        } satisfies PendingFile;
      });

      setUploadError("");
      setState(initialState);
      markUnsaved();
      setPendingFiles((current) => [...current, ...nextPendingFiles]);
      setImages((current) =>
        normalizeImages([
          ...current,
          ...nextPendingFiles.map((item, index) => ({
            imageUrl: item.previewUrl,
            cloudinaryPublicId: null,
            sortOrder: current.length + index,
            isHero: current.length + index === 0,
            uploadState: "pending_file" as const,
            pendingFileId: item.id,
            sourceUrl: null,
          })),
        ]),
      );
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "We could not stage the selected image files.",
      );
    }

    if (filePickerRef.current) {
      filePickerRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    markUnsaved();
    setImages((current) => {
      const removedImage = current[index];

      if (
        removedImage?.uploadState === "pending_file" &&
        removedImage.pendingFileId
      ) {
        setPendingFiles((pendingCurrent) => {
          const target = pendingCurrent.find(
            (item) => item.id === removedImage.pendingFileId,
          );

          if (target) {
            URL.revokeObjectURL(target.previewUrl);
          }

          return pendingCurrent.filter(
            (item) => item.id !== removedImage.pendingFileId,
          );
        });
      }

      return normalizeImages(current.filter((_, item) => item !== index));
    });
  }

  function moveImageUp(index: number) {
    if (index === 0) {
      return;
    }

    markUnsaved();
    setImages((current) => {
      const next = [...current];
      const target = next[index];
      next[index] = next[index - 1];
      next[index - 1] = target;
      return normalizeImages(next);
    });
  }

  function setHero(index: number) {
    markUnsaved();
    setImages((current) =>
      normalizeImages(
        current.map((image, item) => ({
          ...image,
          isHero: item === index,
        })),
      ),
    );
  }

  return (
    <Card className="rounded-[28px] p-5 sm:p-6">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onChangeCapture={() => {
          setHasUnsavedChanges(true);
          clearSuccessNotice();
          captureRequiredSnapshot();
        }}
        className="flex flex-col gap-7"
      >
        <input type="hidden" name="id" value={vehicle?.id || ""} />

        <div className="sticky top-[4.75rem] z-20 rounded-[28px] border border-white/80 bg-white/96 px-4 py-3 shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur lg:top-6 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getSaveStatusVariant()}>{getSaveStatusLabel()}</Badge>
                {vehicle?.stockCode ? (
                  <Badge variant="muted">Stock {vehicle.stockCode}</Badge>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-950">
                  {isEditing
                    ? "Stay in the editor while you update the listing."
                    : "The first save creates the listing and keeps you inside the editor."}
                </p>
                <p className="mt-1 hidden text-sm text-stone-600 sm:block">
                  Use the section links below to jump between content blocks without
                  losing your place.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href="/admin/vehicles">Return to inventory</Link>
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {isEditing ? "Save changes" : "Save vehicle"}
              </Button>
            </div>
          </div>
        </div>

        <nav
          aria-label="Vehicle editor sections"
          className="flex flex-wrap gap-2 rounded-[26px] border border-border/70 bg-stone-50/90 p-3"
        >
          {editorSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-border/70 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-600 transition-colors hover:border-primary/25 hover:text-stone-950"
            >
              {section.label}
            </a>
          ))}
        </nav>

        {requiredMissing.length ? (
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:hidden">
            <p className="font-semibold">Missing required fields</p>
            <p className="mt-1">
              {requiredMissing.slice(0, 3).join(", ")}
              {requiredMissing.length > 3
                ? ` +${requiredMissing.length - 3} more`
                : ""}
            </p>
          </div>
        ) : (
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 sm:hidden">
            All required fields are filled.
          </div>
        )}

        {successNotice ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800">
            {successNotice}
          </div>
        ) : null}

        {state.message ? (
          <div
            className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
            role="alert"
          >
            {state.message}
          </div>
        ) : null}

        <FormSection
          id="quick-fill"
          title="Quick fill"
          description="Paste a WhatsApp listing and let us prefill the fields you already have."
          className="order-0"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <Label htmlFor="quick-paste">Paste dealer message</Label>
              <Textarea
                id="quick-paste"
                value={quickPaste}
                onChange={(event) => {
                  setQuickPaste(event.target.value);
                  if (quickPasteNotice) {
                    setQuickPasteNotice("");
                  }
                }}
                placeholder="Paste the dealer message here..."
                className="min-h-32"
              />
              <p className="mt-2 text-xs text-stone-500">
                We detect make, model, year, price, engine cc, fuel, condition, and
                location when possible.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
              <Button type="button" onClick={handleQuickPaste}>
                Parse & fill
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setQuickPaste("");
                  setQuickPasteNotice("");
                }}
              >
                Clear paste
              </Button>
            </div>
          </div>
          {quickPasteNotice ? (
            <div className="rounded-[18px] border border-border/70 bg-stone-50 px-4 py-3 text-xs text-stone-600">
              {quickPasteNotice}
            </div>
          ) : null}
        </FormSection>

        <FormSection
          id="basics"
          title="Basics"
          description="Keep the key listing fields fast to fill. The reference code and vehicle URL are managed automatically."
          className="order-1"
        >
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Label htmlFor="title">Listing title</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="2018 Range Rover Vogue"
                {...getFieldProps("title")}
              />
              <FieldError
                id={getFieldErrorId("title")}
                error={getFieldError("title")}
              />
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                name="year"
                type="number"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                placeholder="2018"
                min={1990}
                max={new Date().getFullYear() + 1}
                {...getFieldProps("year")}
              />
              <FieldError
                id={getFieldErrorId("year")}
                error={getFieldError("year")}
              />
            </div>
            <div>
              <Label htmlFor="make">Make</Label>
              <Input
                id="make"
                name="make"
                value={make}
                onChange={(event) => setMake(event.target.value)}
                placeholder="Toyota"
                list="vehicle-make-options"
                {...getFieldProps("make")}
              />
              <FieldError
                id={getFieldErrorId("make")}
                error={getFieldError("make")}
              />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                name="model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="Land Cruiser V8"
                {...getFieldProps("model")}
              />
              <FieldError
                id={getFieldErrorId("model")}
                error={getFieldError("model")}
              />
            </div>
            <div className="rounded-3xl border border-dashed border-border/70 bg-stone-50 px-4 py-3 text-sm text-stone-600 xl:col-span-3">
              The system keeps the stock code and public vehicle URL in sync
              automatically when you save this listing.
            </div>
          </div>
        </FormSection>

        <FormSection
          id="listing-setup"
          title="Listing setup"
          description="These fields control how the vehicle appears in admin and on the live site."
          className="order-2"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                name="price"
                type="number"
                defaultValue={vehicle?.price}
                placeholder="2790000"
                min={0}
                step={1000}
                {...getFieldProps("price")}
              />
              <p className="mt-2 text-xs text-stone-500">
                Enter the full price in KES (example: 2,790,000).
              </p>
              <FieldError
                id={getFieldErrorId("price")}
                error={getFieldError("price")}
              />
            </div>
            <div>
              <Label htmlFor="condition">Condition</Label>
              <Input
                id="condition"
                name="condition"
                defaultValue={vehicle?.condition}
                list="vehicle-condition-options"
                placeholder="Foreign used"
                {...getFieldProps("condition")}
              />
              <FieldError
                id={getFieldErrorId("condition")}
                error={getFieldError("condition")}
              />
            </div>
            <div>
              <Label htmlFor="locationId">Location</Label>
              <select
                id="locationId"
                name="locationId"
                defaultValue={vehicle?.locationId || ""}
                className={cn(selectClassName, getFieldProps("locationId").className)}
                aria-invalid={getFieldProps("locationId")["aria-invalid"]}
                aria-describedby={getFieldProps("locationId")["aria-describedby"]}
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              <FieldError
                id={getFieldErrorId("locationId")}
                error={getFieldError("locationId")}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={vehicle?.status || "draft"}
                className={cn(selectClassName, getFieldProps("status").className)}
                aria-invalid={getFieldProps("status")["aria-invalid"]}
                aria-describedby={getFieldProps("status")["aria-describedby"]}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="sold">Sold</option>
                <option value="unpublished">Unpublished</option>
              </select>
              <FieldError
                id={getFieldErrorId("status")}
                error={getFieldError("status")}
              />
            </div>
            <div>
              <Label htmlFor="stockCategory">Stock category</Label>
              <select
                id="stockCategory"
                name="stockCategory"
                defaultValue={vehicle?.stockCategory || "used"}
                className={cn(
                  selectClassName,
                  getFieldProps("stockCategory").className,
                )}
                aria-invalid={getFieldProps("stockCategory")["aria-invalid"]}
                aria-describedby={getFieldProps("stockCategory")["aria-describedby"]}
              >
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="imported">Imported</option>
                <option value="available_for_importation">
                  Available for importation
                </option>
                <option value="traded_in">Traded-in</option>
              </select>
              <FieldError
                id={getFieldErrorId("stockCategory")}
                error={getFieldError("stockCategory")}
              />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={vehicle?.featured}
                className="size-4"
              />
              Featured listing
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                name="negotiable"
                defaultChecked={vehicle?.negotiable}
                className="size-4"
              />
              Price negotiable
            </label>
          </div>
        </FormSection>

        <FormSection
          id="vehicle-details"
          title="Vehicle details"
          description="Use the common options for speed, but keep the fields open for custom entries when needed."
          className="order-4 lg:order-3"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label htmlFor="mileage">Mileage (km)</Label>
              <Input
                id="mileage"
                name="mileage"
                type="number"
                defaultValue={vehicle?.mileage}
                placeholder="85000"
                min={0}
                {...getFieldProps("mileage")}
              />
              <FieldError
                id={getFieldErrorId("mileage")}
                error={getFieldError("mileage")}
              />
            </div>
            <div>
              <Label htmlFor="transmission">Transmission</Label>
              <Input
                id="transmission"
                name="transmission"
                defaultValue={vehicle?.transmission}
                list="vehicle-transmission-options"
                placeholder="Automatic"
                {...getFieldProps("transmission")}
              />
              <FieldError
                id={getFieldErrorId("transmission")}
                error={getFieldError("transmission")}
              />
            </div>
            <div>
              <Label htmlFor="fuelType">Fuel type</Label>
              <Input
                id="fuelType"
                name="fuelType"
                defaultValue={vehicle?.fuelType}
                list="vehicle-fuel-options"
                placeholder="Petrol"
                {...getFieldProps("fuelType")}
              />
              <FieldError
                id={getFieldErrorId("fuelType")}
                error={getFieldError("fuelType")}
              />
            </div>
            <div>
              <Label htmlFor="driveType">Drive type</Label>
              <Input
                id="driveType"
                name="driveType"
                defaultValue={vehicle?.driveType || ""}
                list="vehicle-drive-options"
                placeholder="4WD"
              />
            </div>
            <div>
              <Label htmlFor="bodyType">Body type</Label>
              <Input
                id="bodyType"
                name="bodyType"
                defaultValue={vehicle?.bodyType || ""}
                list="vehicle-body-options"
                placeholder="SUV"
              />
            </div>
            <div>
              <Label htmlFor="engineCapacity">Engine capacity</Label>
              <Input
                id="engineCapacity"
                name="engineCapacity"
                defaultValue={vehicle?.engineCapacity || ""}
                placeholder="4700cc"
              />
            </div>
            <div>
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                name="color"
                defaultValue={vehicle?.color || ""}
                placeholder="White"
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          id="description"
          title="Description"
          description="Keep the copy short and sales-led so the website reads cleanly."
          className="order-5 lg:order-4"
        >
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={vehicle?.description}
            className={cn("min-h-32", getFieldProps("description").className)}
            placeholder="Highlight condition, standout features, viewing location, and the strongest reason to enquire."
            aria-invalid={getFieldProps("description")["aria-invalid"]}
            aria-describedby={getFieldProps("description")["aria-describedby"]}
          />
          <FieldError
            id={getFieldErrorId("description")}
            error={getFieldError("description")}
          />
        </FormSection>

        <FormSection
          id="gallery"
          title="Gallery"
          description="Stage files or URLs here. Files upload directly to Cloudinary when you save the vehicle."
          className="order-3 lg:order-5"
        >
          <input
            ref={filePickerRef}
            type="file"
            multiple
            accept={SUPPORTED_IMAGE_MIME_TYPES.join(",")}
            className="hidden"
            onChange={(event) => uploadFiles(event.target.files)}
          />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <Label htmlFor="manual-image">Stage image from URL</Label>
              <Input
                id="manual-image"
                value={manualImageUrl}
                onChange={(event) => setManualImageUrl(event.target.value)}
                placeholder="https://..."
                aria-describedby={
                  uploadError || getFieldError("images")
                    ? "vehicle-gallery-error"
                    : undefined
                }
                aria-invalid={uploadError || getFieldError("images") ? true : undefined}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={addManualImage}
            >
              <ImagePlus className="size-4" />
              Stage URL
            </Button>
            <Button type="button" variant="dark" onClick={openFilePicker}>
              <ImagePlus className="size-4" />
              Stage Files
            </Button>
          </div>

          <FieldError
            id="vehicle-gallery-error"
            error={uploadError || getFieldError("images")}
            className="text-sm text-red-600"
          />

          {normalizedImages.length ? (
            <div className="grid gap-3">
              {normalizedImages.map((image, index) => {
                const isPending =
                  image.uploadState === "pending_file" ||
                  image.uploadState === "pending_url";

                return (
                  <div
                    key={`${image.imageUrl}-${index}`}
                    className="grid gap-3 rounded-[24px] border border-border bg-white p-3 md:grid-cols-[112px_minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="relative h-20 overflow-hidden rounded-2xl bg-stone-100">
                      <Image
                        src={image.imageUrl}
                        alt={image.altText || "Vehicle image"}
                        fill
                        sizes="(max-width: 767px) 100vw, 112px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {getImageLabel(image.imageUrl, index)}
                        </p>
                        {image.isHero ? <Badge variant="accent">Hero</Badge> : null}
                        <Badge variant={isPending ? "muted" : "success"}>
                          {image.uploadState === "pending_url"
                            ? "Imports on save"
                            : isPending
                              ? "Uploads on save"
                              : "Saved"}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-stone-500">
                        {image.imageUrl}
                      </p>
                      <Input
                        aria-label={`Alt text for image ${index + 1}`}
                        placeholder="Alt text"
                        value={image.altText || ""}
                        onChange={(event) =>
                          setImages((current) =>
                            normalizeImages(
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, altText: event.target.value }
                                  : item,
                              ),
                            ),
                          )
                        }
                        className="mt-3 h-10"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {image.isHero ? (
                        <Badge variant="accent">Hero image</Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setHero(index)}
                        >
                          <Star className="size-4" />
                          Make hero
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveImageUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="size-4" />
                        Move up
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() => removeImage(index)}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-border bg-stone-50 px-5 py-7 text-sm leading-7 text-stone-600">
              No gallery images yet. You can save the vehicle first, then pull
              the Cloudinary folder later, or stage images now and upload them
              with the save action.
            </div>
          )}
        </FormSection>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">
            Gallery order, hero selection, and listing details are all committed with
            the save action.
          </p>
          {lastSavedAt ? (
            <p className="text-sm font-medium text-emerald-700">
              Last saved in this session.
            </p>
          ) : null}
        </div>

        <datalist id="vehicle-condition-options">
          {conditionOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="vehicle-make-options">
          {commonMakes.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="vehicle-transmission-options">
          {transmissionOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="vehicle-fuel-options">
          {fuelTypeOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="vehicle-drive-options">
          {driveTypeOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="vehicle-body-options">
          {bodyTypeOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </form>
    </Card>
  );
}
