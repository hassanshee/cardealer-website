"use client";

import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  Camera,
  CheckCircle2,
  HelpCircle,
  LoaderCircle,
  Star,
  Trash2,
} from "lucide-react";
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
import {
  vehicleConditionOptions,
  vehicleFuelTypeOptions,
  vehicleTransmissionOptions,
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
const designInputClassName =
  "h-10 w-full rounded-lg border border-[#c5c6cf] bg-white px-2.5 text-sm text-[#141d23] shadow-none outline-none focus-visible:border-[#1a2b4b] focus-visible:ring-0";
const selectClassName =
  "h-10 w-full rounded-lg border border-[#c5c6cf] bg-white px-2.5 text-sm text-[#141d23] shadow-none outline-none focus-visible:border-[#1a2b4b] focus-visible:ring-0";
const unsavedChangesMessage =
  "You have unsaved changes. Leave the editor without saving?";

const requiredFieldNames = new Set([
  "make",
  "model",
  "year",
  "price",
  "condition",
  "mileage",
  "transmission",
  "fuelType",
  "description",
]);

const conditionOptions = vehicleConditionOptions;
const transmissionOptions = vehicleTransmissionOptions;
const fuelTypeOptions = vehicleFuelTypeOptions;
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

function makeEditableImagesFromSaved(
  savedImages: VehicleImageInput[],
): EditableImage[] {
  return savedImages.map((image) => ({
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
  summary,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  summary?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 space-y-4 rounded-xl border border-[#c5c6cf] bg-white p-4 shadow-[0_2px_4px_rgba(3,22,53,0.05)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold leading-6 text-[#031635]">
            {title}
        </h3>
        {summary ? (
          <span className="shrink-0 text-[11px] font-semibold leading-4 tracking-[0.03em] text-[#44474e]">
            {summary}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RequiredMark() {
  return (
    <span className="ml-1 text-danger" aria-hidden="true">
      *
    </span>
  );
}

function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: React.ReactNode;
  htmlFor: string;
  required?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-medium leading-5 text-[#44474e]">
      {children}
      {required ? <RequiredMark /> : null}
    </Label>
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
  const [isSaving, setIsSaving] = useState(false);
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
  const filePickerRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const pendingFilesRef = useRef<PendingFile[]>([]);
  const normalizedImages = useMemo(() => normalizeImages(images), [images]);
  const isEditing = Boolean(vehicle?.id);
  const formId = isEditing ? "vehicle-edit-form" : "vehicle-create-form";

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

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = unsavedChangesMessage;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

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

  function clearPendingFiles() {
    setPendingFiles((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
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

  function extractMileage(text: string) {
    const abbreviatedMatch = text.match(
      /\b(\d+(?:\.\d+)?)\s*k\s*(?:km|kms|kilometres|kilometers)\b/i,
    );

    if (abbreviatedMatch) {
      return Math.round(Number(abbreviatedMatch[1]) * 1000);
    }

    const mileageMatch =
      text.match(
        /\b([0-9][0-9,\s]*)\s*(?:km|kms|kilometres|kilometers)\b/i,
      ) || text.match(/\bmileage\b[^0-9]*([0-9][0-9,\s]*)/i);

    if (!mileageMatch) {
      return null;
    }

    const value = Number(mileageMatch[1].replace(/[,\s]/g, ""));
    return Number.isFinite(value) ? value : null;
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
      const modelBoundaryTokens = new Set([
        "petrol",
        "diesel",
        "hybrid",
        "electric",
        "automatic",
        "manual",
        "auto",
        "cvt",
        "kes",
        "ksh",
        "kshs",
        "km",
        "kms",
        "mileage",
        "price",
        "offer",
        "very",
        "clean",
        "foreign",
        "locally",
        "used",
        "mombasa",
        "miritini",
        "nairobi",
      ]);
      const modelTokens: string[] = [];

      for (const token of tokens.slice(makeIndex + 1)) {
        const normalizedToken = token.toLowerCase();

        if (
          /^(19|20)\d{2}$/.test(token) ||
          /^\d/.test(token) ||
          modelBoundaryTokens.has(normalizedToken)
        ) {
          break;
        }

        modelTokens.push(token);

        if (modelTokens.length >= 4) {
          break;
        }
      }

      const model = modelTokens.join(" ").trim();
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
    const mileage = extractMileage(normalized) || undefined;
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
      mileage,
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
      parsed.mileage ? "mileage" : null,
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
      const numeric = Number(value.replace(/[,\s]/g, ""));
      return !value || Number.isNaN(numeric) || numeric <= 0;
    };

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
    if (
      !requiredSnapshot.mileage ||
      Number.isNaN(Number(requiredSnapshot.mileage.replace(/[,\s]/g, "")))
    ) {
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
  }, [make, model, requiredSnapshot, year]);

  const hasDraftProgress = useMemo(
    () =>
      Boolean(
        title.trim() ||
          make.trim() ||
          model.trim() ||
          year.trim() ||
          requiredSnapshot.price.trim() ||
          requiredSnapshot.condition.trim() ||
          requiredSnapshot.mileage.trim() ||
          requiredSnapshot.transmission.trim() ||
          requiredSnapshot.fuelType.trim() ||
          requiredSnapshot.description.trim() ||
          quickPaste.trim() ||
          normalizedImages.length,
      ),
    [make, model, normalizedImages.length, quickPaste, requiredSnapshot, title, year],
  );

  const saveDisabled =
    isSaving || isSubmitting || (isEditing ? !hasUnsavedChanges : !hasDraftProgress);
  const hasSaveError = Boolean(state.message && !state.success);

  function focusFieldByName(name: string) {
    const form = formRef.current;

    if (!form) {
      return;
    }

    if (name === "images") {
      const gallerySection = document.getElementById("vehicle-gallery");
      if (
        gallerySection &&
        "scrollIntoView" in gallerySection &&
        typeof gallerySection.scrollIntoView === "function"
      ) {
        gallerySection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      const galleryInput =
        (form.elements.namedItem("manual-image") as HTMLInputElement | null) ||
        document.getElementById("manual-image");
      if (galleryInput instanceof HTMLInputElement) {
        galleryInput.focus();
      }
      return;
    }

    const field =
      form.elements.namedItem(name) ||
      document.getElementById(name);

    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement
    ) {
      if ("scrollIntoView" in field && typeof field.scrollIntoView === "function") {
        field.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      field.focus();
    }
  }

  function focusFirstInvalidField(fieldErrors?: Record<string, string[]>) {
    const firstInvalidField = Object.keys(fieldErrors || {}).find(
      (name) => fieldErrors?.[name]?.length,
    );

    if (!firstInvalidField) {
      return;
    }

    requestAnimationFrame(() => {
      focusFieldByName(firstInvalidField);
    });
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

  function reconcileSavedImages(
    uploadedByPendingId: Map<string, UploadedPendingFile>,
    savedImages?: VehicleImageInput[],
  ) {
    if (savedImages) {
      setImages(normalizeImages(makeEditableImagesFromSaved(savedImages)));
      return;
    }

    setImages((current) =>
      normalizeImages(
        current.map((image) => {
          if (image.uploadState === "pending_file" && image.pendingFileId) {
            const uploaded = uploadedByPendingId.get(image.pendingFileId);

            return uploaded
              ? {
                  ...image,
                  imageUrl: uploaded.secureUrl,
                  cloudinaryPublicId: uploaded.publicId,
                  sourceUrl: null,
                  uploadState: "uploaded" as const,
                }
              : image;
          }

          if (image.uploadState === "pending_url") {
            return {
              ...image,
              sourceUrl: null,
              uploadState: "uploaded" as const,
            };
          }

          return {
            ...image,
            sourceUrl: null,
            uploadState: "uploaded" as const,
          };
        }),
      ),
    );
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
        reconcileSavedImages(uploadedByPendingId, result.savedImages);
        clearPendingFiles();
        setState(initialState);
        setHasUnsavedChanges(false);
        setSuccessNotice(result.message || "Vehicle saved successfully.");
        captureRequiredSnapshot();
        router.refresh();
        return;
      }

      setState(result);
      focusFirstInvalidField(result.fieldErrors);
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
    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    startSubmitting(() => {
      void submitVehicleForm().finally(() => {
        isSavingRef.current = false;
        setIsSaving(false);
      });
    });
  }

  function handleFormChangeCapture(event: React.FormEvent<HTMLFormElement>) {
    const target = event.target;

    if (
      target instanceof HTMLTextAreaElement &&
      target.id === "quick-paste"
    ) {
      return;
    }

    if (
      target instanceof HTMLInputElement &&
      (target.id === "manual-image" || target.type === "file")
    ) {
      return;
    }

    setHasUnsavedChanges(true);
    clearSuccessNotice();
    captureRequiredSnapshot();
  }

  function handleReturnToInventory() {
    if (hasUnsavedChanges && !window.confirm(unsavedChangesMessage)) {
      return;
    }

    router.push("/admin/vehicles");
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
    <Card className="-mx-4 -mt-4 min-h-screen rounded-none border-0 bg-[#f6faff] p-0 font-sans text-[#141d23] shadow-none sm:-mx-6 lg:mx-auto lg:mt-0 lg:min-h-0 lg:max-w-xl lg:rounded-xl">
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[#e9ecef] bg-[#f8f9fa] px-4 text-[#1a2b4b] shadow-sm lg:hidden">
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[#44474e]"
          onClick={handleReturnToInventory}
        >
          <ArrowLeft className="size-5 text-[#141d23]" />
          Return to inventory
        </button>
        <HelpCircle className="size-5 text-[#44474e]" aria-hidden="true" />
      </div>
      <form
        id={formId}
        ref={formRef}
        onSubmit={handleSubmit}
        onChangeCapture={handleFormChangeCapture}
        className="mx-auto flex w-full max-w-[360px] flex-col gap-6 px-4 pb-32 pt-20 lg:max-w-xl lg:px-0 lg:pt-0"
      >
        <input type="hidden" name="id" value={vehicle?.id || ""} />

        <section className="space-y-1">
          <h2 className="text-2xl font-semibold leading-8 tracking-[-0.01em] text-[#031635]">
            {isEditing ? "Edit vehicle" : "Create vehicle"}
          </h2>
          <p className="text-sm leading-5 text-[#44474e]">
            Paste a dealer message, add photos, then review the essentials.
          </p>
        </section>

        <section className="flex items-center justify-between rounded-xl border border-[#c5c6cf] bg-white p-4 shadow-[0_2px_4px_rgba(3,22,53,0.05)]">
          <div className="flex items-center gap-2">
            {hasSaveError || requiredMissing.length ? (
              <AlertCircle className="size-5 text-[#5d4217]" />
            ) : (
              <CheckCircle2 className="size-5 fill-green-600 text-green-600" />
            )}
            <span
              className={cn(
                "text-sm font-medium leading-5",
                hasSaveError || requiredMissing.length
                  ? "text-[#5d4217]"
                  : "text-green-700",
              )}
            >
              {hasSaveError
                ? "Needs review"
                : isSaving || isSubmitting
                  ? "Saving changes"
                  : "Ready to create"}
            </span>
          </div>
          <span className="rounded-full bg-[#e8c08a]/20 px-3 py-1 text-[11px] font-semibold leading-4 tracking-[0.03em] text-[#5d4217]">
            {requiredMissing.length
              ? `${requiredMissing.length} missing`
              : "Ready"}
          </span>
        </section>

        <section
          id="vehicle-quick-fill"
          className="space-y-4 rounded-xl border border-[#c5c6cf] bg-white p-4 shadow-[0_2px_4px_rgba(3,22,53,0.05)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium leading-5 tracking-[0.01em] text-[#031635]">
              Quick Fill
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[11px] font-semibold leading-4 tracking-[0.03em] text-[#075E54]">
                <span className="size-2 rounded-sm bg-[#075E54]" />
                WhatsApp
            </span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="quick-paste" className="text-sm font-medium leading-5 text-[#44474e]">
              Dealer message
            </Label>
            <Textarea
              id="quick-paste"
              value={quickPaste}
              onChange={(event) => {
                setQuickPaste(event.target.value);
                if (quickPasteNotice) {
                  setQuickPasteNotice("");
                }
              }}
              placeholder="Toyota Harrier 2017 2.5L petrol, auto, 83k km, Ksh 3.4M, Mombasa..."
              className="min-h-[100px] resize-none rounded-lg border-[#c5c6cf] bg-white p-2 text-xs leading-4 focus-visible:border-[#1a2b4b] focus-visible:ring-0"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="h-12 flex-1 rounded-lg border-[#1a2b4b] bg-[#1a2b4b] text-sm font-semibold text-white shadow-none hover:border-[#031635] hover:bg-[#031635]"
              onClick={handleQuickPaste}
            >
              Parse & fill
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-12 rounded-lg border-[#c5c6cf] bg-white px-4 text-sm font-medium text-[#5c5f60] shadow-none hover:bg-white"
              onClick={() => {
                setQuickPaste("");
                setQuickPasteNotice("");
              }}
            >
              Clear paste
            </Button>
          </div>
          {quickPasteNotice ? (
            <div className="rounded-lg border border-[#c5c6cf] bg-[#ecf5fe] px-3 py-2 text-xs leading-4 text-[#44474e]">
              {quickPasteNotice}
            </div>
          ) : null}
        </section>

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
          id="vehicle-basics"
          title="Basic Details"
          description="Start with the identifiers a broker needs when adding a vehicle from a phone."
          className="order-2"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <FieldLabel htmlFor="make" required={requiredFieldNames.has("make")}>
                Make
              </FieldLabel>
              <Input
                id="make"
                name="make"
                value={make}
                onChange={(event) => setMake(event.target.value)}
                placeholder="Toyota"
                list="vehicle-make-options"
                className={cn(designInputClassName, getFieldProps("make").className)}
                aria-invalid={getFieldProps("make")["aria-invalid"]}
                aria-describedby={getFieldProps("make")["aria-describedby"]}
              />
              <FieldError
                id={getFieldErrorId("make")}
                error={getFieldError("make")}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="model" required={requiredFieldNames.has("model")}>
                Model
              </FieldLabel>
              <Input
                id="model"
                name="model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="Land Cruiser V8"
                className={cn(designInputClassName, getFieldProps("model").className)}
                aria-invalid={getFieldProps("model")["aria-invalid"]}
                aria-describedby={getFieldProps("model")["aria-describedby"]}
              />
              <FieldError
                id={getFieldErrorId("model")}
                error={getFieldError("model")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <FieldLabel htmlFor="year" required={requiredFieldNames.has("year")}>
                  Year
                </FieldLabel>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  placeholder="2018"
                  min={1990}
                  max={new Date().getFullYear() + 1}
                  className={cn(designInputClassName, getFieldProps("year").className)}
                  aria-invalid={getFieldProps("year")["aria-invalid"]}
                  aria-describedby={getFieldProps("year")["aria-describedby"]}
                />
                <FieldError
                  id={getFieldErrorId("year")}
                  error={getFieldError("year")}
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="locationId"
                  className="text-sm font-medium leading-5 text-[#44474e]"
                >
                  Location
                </Label>
                <select
                  id="locationId"
                  name="locationId"
                  defaultValue={vehicle?.locationId || ""}
                  className={cn(selectClassName, getFieldProps("locationId").className)}
                  aria-invalid={getFieldProps("locationId")["aria-invalid"]}
                  aria-describedby={getFieldProps("locationId")["aria-describedby"]}
                >
                  <option value="">Select</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.city || location.name}
                    </option>
                  ))}
                </select>
                <FieldError
                  id={getFieldErrorId("locationId")}
                  error={getFieldError("locationId")}
                />
              </div>
            </div>
            <input type="hidden" name="title" value={title} />
          </div>
        </FormSection>

        <FormSection
          id="vehicle-price"
          title="Price"
          description="Use full KES amounts. Commas are accepted for faster phone entry."
          className="order-3"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <FieldLabel htmlFor="price" required={requiredFieldNames.has("price")}>
                Price (Ksh)
              </FieldLabel>
              <Input
                id="price"
                name="price"
                type="text"
                inputMode="numeric"
                defaultValue={vehicle?.price}
                placeholder="2,790,000"
                className={cn(
                  designInputClassName,
                  "font-semibold",
                  getFieldProps("price").className,
                )}
                aria-invalid={getFieldProps("price")["aria-invalid"]}
                aria-describedby={getFieldProps("price")["aria-describedby"]}
              />
              <FieldError
                id={getFieldErrorId("price")}
                error={getFieldError("price")}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel
                htmlFor="condition"
                required={requiredFieldNames.has("condition")}
              >
                Condition
              </FieldLabel>
              <select
                id="condition"
                name="condition"
                defaultValue={vehicle?.condition}
                className={cn(selectClassName, getFieldProps("condition").className)}
                aria-invalid={getFieldProps("condition")["aria-invalid"]}
                aria-describedby={getFieldProps("condition")["aria-describedby"]}
              >
                <option value="">Select condition</option>
                {conditionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <FieldError
                id={getFieldErrorId("condition")}
                error={getFieldError("condition")}
              />
            </div>
            <label className="flex min-h-6 cursor-pointer items-center gap-2 text-sm leading-5 text-[#141d23]">
              <input
                type="checkbox"
                name="negotiable"
                defaultChecked={vehicle?.negotiable}
                className="size-5 rounded border-[#c5c6cf] text-[#1a2b4b] focus:ring-[#1a2b4b]"
              />
              Price negotiable
            </label>
          </div>
        </FormSection>

        <FormSection
          id="vehicle-specs"
          title="Specs"
          description="Use the common options for speed, but keep the fields open for custom entries when needed."
          className="order-4"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <FieldLabel
                htmlFor="mileage"
                required={requiredFieldNames.has("mileage")}
              >
                Mileage (km)
              </FieldLabel>
              <Input
                id="mileage"
                name="mileage"
                type="text"
                inputMode="numeric"
                defaultValue={vehicle?.mileage}
                placeholder="85000"
                className={cn(
                  designInputClassName,
                  getFieldProps("mileage").className,
                )}
                aria-invalid={getFieldProps("mileage")["aria-invalid"]}
                aria-describedby={getFieldProps("mileage")["aria-describedby"]}
              />
              <FieldError
                id={getFieldErrorId("mileage")}
                error={getFieldError("mileage")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <FieldLabel
                  htmlFor="transmission"
                  required={requiredFieldNames.has("transmission")}
                >
                  Transmission
                </FieldLabel>
                <select
                  id="transmission"
                  name="transmission"
                  defaultValue={vehicle?.transmission || ""}
                  className={cn(
                    selectClassName,
                    getFieldProps("transmission").className,
                  )}
                  aria-invalid={getFieldProps("transmission")["aria-invalid"]}
                  aria-describedby={getFieldProps("transmission")["aria-describedby"]}
                >
                  <option value="">Select</option>
                  {transmissionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <FieldError
                  id={getFieldErrorId("transmission")}
                  error={getFieldError("transmission")}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel
                  htmlFor="fuelType"
                  required={requiredFieldNames.has("fuelType")}
                >
                  Fuel type
                </FieldLabel>
                <select
                  id="fuelType"
                  name="fuelType"
                  defaultValue={vehicle?.fuelType || ""}
                  className={cn(selectClassName, getFieldProps("fuelType").className)}
                  aria-invalid={getFieldProps("fuelType")["aria-invalid"]}
                  aria-describedby={getFieldProps("fuelType")["aria-describedby"]}
                >
                  <option value="">Select</option>
                  {fuelTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <FieldError
                  id={getFieldErrorId("fuelType")}
                  error={getFieldError("fuelType")}
                />
              </div>
            </div>
          </div>
        </FormSection>

        <div className="hidden">
          <input name="driveType" defaultValue={vehicle?.driveType || ""} />
          <input name="bodyType" defaultValue={vehicle?.bodyType || ""} />
          <input name="engineCapacity" defaultValue={vehicle?.engineCapacity || ""} />
          <input name="color" defaultValue={vehicle?.color || ""} />
        </div>

        <FormSection
          id="vehicle-gallery"
          title="Images"
          description="Add listing photos from the phone gallery or from a URL."
          summary={normalizedImages.length ? `${normalizedImages.length} staged` : "Optional draft"}
          className="order-5"
        >
          <input
            ref={filePickerRef}
            type="file"
            multiple
            accept={SUPPORTED_IMAGE_MIME_TYPES.join(",")}
            className="hidden"
            onChange={(event) => uploadFiles(event.target.files)}
          />

          <div
            className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-[#c5c6cf] bg-[#e6eff8] transition-colors hover:bg-[#e0e9f2]"
            onClick={openFilePicker}
          >
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-2 text-[#031635]"
              onClick={openFilePicker}
            >
              <Camera className="size-9 fill-[#031635] stroke-[#031635]" />
              <span className="text-sm font-medium leading-5">
                Add photos from phone
              </span>
            </button>
          </div>

          <details className="group">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center text-sm font-medium leading-5 text-[#031635] [&::-webkit-details-marker]:hidden">
              Add image from URL
            </summary>
            <div className="mt-2 grid gap-2">
              <div className="space-y-1">
                <Label
                  htmlFor="manual-image"
                  className="text-sm font-medium leading-5 text-[#44474e]"
                >
                  Image URL
                </Label>
                <Input
                  id="manual-image"
                  value={manualImageUrl}
                  onChange={(event) => setManualImageUrl(event.target.value)}
                  placeholder="https://..."
                  className={designInputClassName}
                  aria-describedby={
                    uploadError || getFieldError("images")
                      ? "vehicle-gallery-error"
                      : undefined
                  }
                  aria-invalid={
                    uploadError || getFieldError("images") ? true : undefined
                  }
                />
              </div>
              <Button
                type="button"
                className="h-12 rounded-lg border-[#1a2b4b] bg-[#1a2b4b] text-sm font-semibold text-white shadow-none hover:border-[#031635] hover:bg-[#031635]"
                onClick={addManualImage}
              >
                Stage URL
              </Button>
            </div>
          </details>

          <FieldError
            id="vehicle-gallery-error"
            error={uploadError || getFieldError("images")}
            className="text-sm text-red-600"
          />

          {normalizedImages.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {normalizedImages.map((image, index) => {
                const isPending =
                  image.uploadState === "pending_file" ||
                  image.uploadState === "pending_url";

                return (
                  <div
                    key={`${image.imageUrl}-${index}`}
                    className="overflow-hidden rounded-xl border border-[#c5c6cf] bg-white shadow-[0_2px_4px_rgba(3,22,53,0.05)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                      <Image
                        src={image.imageUrl}
                        alt={image.altText || "Vehicle image"}
                        fill
                        sizes="(max-width: 767px) 100vw, 112px"
                        className="object-cover"
                      />
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                        {image.isHero ? <Badge variant="accent">Hero</Badge> : null}
                        <Badge variant={isPending ? "muted" : "success"}>
                          {image.uploadState === "pending_url"
                            ? "Imports on save"
                            : isPending
                              ? "Uploads on save"
                              : "Saved"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-3 p-3">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {getImageLabel(image.imageUrl, index)}
                      </p>
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
                        className={cn(designInputClassName, "mt-3")}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setHero(index)}
                          disabled={image.isHero}
                          className="rounded-lg"
                        >
                          <Star className="size-4" />
                          {image.isHero ? "Hero" : "Hero"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => moveImageUp(index)}
                          disabled={index === 0}
                          className="rounded-lg"
                        >
                          <ArrowUp className="size-4" />
                          Move up
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="col-span-2 rounded-lg text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => removeImage(index)}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            null
          )}
        </FormSection>

        <FormSection
          id="vehicle-description"
          title="Description *"
          description="Keep the copy short and sales-led so the website reads cleanly."
          className="order-6"
        >
          <Textarea
            id="description"
            name="description"
            defaultValue={vehicle?.description}
            className={cn(
              "min-h-[120px] resize-none rounded-lg border-[#c5c6cf] bg-white p-2 text-sm leading-5 focus-visible:border-[#1a2b4b] focus-visible:ring-0",
              getFieldProps("description").className,
            )}
            placeholder="Clean unit, buy-and-drive. Well maintained with full service history..."
            aria-invalid={getFieldProps("description")["aria-invalid"]}
            aria-describedby={getFieldProps("description")["aria-describedby"]}
          />
          <FieldError
            id={getFieldErrorId("description")}
            error={getFieldError("description")}
          />
        </FormSection>

        <FormSection
          id="vehicle-status"
          title="Listing Status"
          description="Choose whether this listing should stay private, go live, or be marked sold."
          className="order-7"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label
                htmlFor="status"
                className="text-sm font-medium leading-5 text-[#44474e]"
              >
                Status
              </Label>
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
            <div className="space-y-1">
              <Label
                htmlFor="stockCategory"
                className="text-sm font-medium leading-5 text-[#44474e]"
              >
                Stock category
              </Label>
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
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#ecf5fe] p-2">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={vehicle?.featured}
                className="size-5 rounded border-[#c5c6cf] text-[#1a2b4b] focus:ring-[#1a2b4b]"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium leading-5 text-[#031635]">
                  Featured listing
                </span>
                <span className="text-xs leading-4 text-[#44474e]">
                  Show at top of dealer page
                </span>
              </span>
            </label>
          </div>
        </FormSection>

        <div className="fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-between border-t border-[#e9ecef] bg-white/80 px-4 shadow-[0_-4px_12px_rgba(3,22,53,0.05)] backdrop-blur-md">
          <div className="mx-auto grid w-full max-w-[360px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[11px] font-semibold leading-4 tracking-[0.03em]",
                  hasSaveError || requiredMissing.length
                    ? "text-[#44474e]"
                    : "text-green-700",
                )}
              >
                {isSaving || isSubmitting
                  ? "Saving"
                  : hasSaveError
                    ? "Failed"
                    : requiredMissing.length
                      ? "Incomplete"
                      : "Complete"}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold leading-5 text-[#3e2700]">
                {requiredMissing.length ? (
                  <AlertCircle className="size-4 fill-[#3e2700]" />
                ) : (
                  <CheckCircle2 className="size-4 fill-green-600 text-green-600" />
                )}
                {requiredMissing.length
                  ? `${requiredMissing.length} missing`
                  : "Ready"}
              </p>
            </div>
            <Button
              type="submit"
              form={formId}
              className="h-12 rounded-xl border-[#1a2b4b] bg-[#1a2b4b] px-8 text-lg font-semibold leading-6 text-white shadow-lg hover:border-[#031635] hover:bg-[#031635]"
              disabled={saveDisabled}
            >
              {isSaving || isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              {isEditing ? "Save changes" : "Save vehicle"}
            </Button>
          </div>
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
