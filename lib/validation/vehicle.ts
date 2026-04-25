import { z } from "zod";

import {
  stockCategories,
  vehicleConditionOptions,
  vehicleFuelTypeOptions,
  vehicleStatuses,
  vehicleTransmissionOptions,
} from "@/types/dealership";

const nullishSchema = z.union([z.null(), z.undefined()]);
const httpImageUrlSchema = z
  .string()
  .trim()
  .url("Use a valid image URL.")
  .refine((value) => /^https?:\/\//i.test(value), "Use a valid image URL.");
const vehicleImageBaseSchema = z.object({
  altText: z.string().trim().optional(),
  sortOrder: z.number().int().min(0),
  isHero: z.boolean(),
});

const uploadedVehicleImageSchema = vehicleImageBaseSchema.extend({
  uploadState: z.literal("uploaded"),
  imageUrl: httpImageUrlSchema,
  cloudinaryPublicId: z.string().trim().min(1).optional().nullable(),
  sourceUrl: nullishSchema,
});

const pendingUrlVehicleImageSchema = vehicleImageBaseSchema.extend({
  uploadState: z.literal("pending_url"),
  imageUrl: httpImageUrlSchema,
  sourceUrl: httpImageUrlSchema,
  cloudinaryPublicId: nullishSchema,
});

export const vehicleImageSchema = z.discriminatedUnion("uploadState", [
  uploadedVehicleImageSchema,
  pendingUrlVehicleImageSchema,
]);

export const vehicleFormSchema = z
  .object({
    id: z.string().trim().optional(),
    title: z.string().trim().min(3, "Enter a vehicle title."),
    stockCode: z
      .string()
      .trim()
      .min(3, "Enter a stock code.")
      .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers, and hyphens only."),
    slug: z.string().trim().optional(),
    make: z.string().trim().min(2, "Enter the make."),
    model: z.string().trim().min(1, "Enter the model."),
    year: z.coerce
      .number()
      .int()
      .min(1990, "Enter a realistic year.")
      .max(new Date().getFullYear() + 1, "Enter a realistic year."),
    condition: z.enum(vehicleConditionOptions, {
      message: "Select a supported condition.",
    }),
    price: z
      .number("Enter the price in KES.")
      .positive("Enter a price greater than 0."),
    negotiable: z.boolean(),
    mileage: z
      .number("Enter the mileage.")
      .int("Enter mileage as a whole number.")
      .min(0, "Enter a valid mileage."),
    transmission: z.enum(vehicleTransmissionOptions, {
      message: "Select a supported transmission.",
    }),
    fuelType: z.enum(vehicleFuelTypeOptions, {
      message: "Select a supported fuel type.",
    }),
    driveType: z.string().trim().optional(),
    bodyType: z.string().trim().optional(),
    engineCapacity: z.string().trim().optional(),
    color: z.string().trim().optional(),
    locationId: z.string().trim().optional(),
    featured: z.boolean(),
    status: z.enum(vehicleStatuses),
    stockCategory: z.enum(stockCategories),
    description: z.string().trim().min(20, "Enter a stronger description."),
    images: z.array(vehicleImageSchema),
  })
  .superRefine((vehicle, context) => {
    if (vehicle.status === "published" && vehicle.images.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Add at least one image before publishing.",
        path: ["images"],
      });
    }
  });
