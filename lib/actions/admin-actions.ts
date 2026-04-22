"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession, signInDemoAdmin, signOutAdmin } from "@/lib/auth";
import {
  allowDemoAdmin,
  env,
  hasAdminManagementConfig,
  hasAdminSuperEmailConfig,
  hasCloudinaryConfig,
  hasSupabaseConfig,
  hasSupabaseSecretConfig,
} from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteCloudinaryAssets,
  uploadVehicleImageFromUrl,
} from "@/lib/cloudinary";
import { isRepositoryUnavailableError } from "@/lib/data/errors";
import { resolveVehicleIdentifiers } from "@/lib/data/filters";
import {
  deleteVehicle,
  getAdminVehicles,
  getVehicleById,
  saveVehicle,
  syncVehicleImagesFromCloudinary,
  toggleVehicleFeatured,
  updateLeadInboxState,
  updateVehicleStatus,
} from "@/lib/data/repository";
import { mapVehicleFormData } from "@/lib/vehicle-form";
import type {
  ActionState,
  AdminSession,
  LeadInboxSourceType,
  LeadWorkflowStatus,
  VehicleFormInput,
} from "@/types/dealership";

function validationErrorState(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}): ActionState {
  return {
    success: false,
    message: "Please review the highlighted fields and try again.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

function actionFailure(message: string, fieldErrors?: Record<string, string[]>) {
  return {
    success: false,
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  } satisfies ActionState;
}

function actionSuccess(message: string, redirectTo?: string) {
  return {
    success: true,
    message,
    ...(redirectTo ? { redirectTo } : {}),
  } satisfies ActionState;
}

class VehicleSaveActionError extends Error {}

function isSuperAdmin(session: AdminSession) {
  return (
    hasAdminSuperEmailConfig &&
    session.email.toLowerCase() === env.adminSuperEmail.toLowerCase()
  );
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findUserByEmail(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  email: string,
) {
  const normalized = normalizeEmail(email);
  let page = 1;
  const perPage = 200;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return null;
    }

    const match = data.users.find(
      (user) => normalizeEmail(user.email || "") === normalized,
    );

    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }

  return null;
}

function parseNewUploadPublicIds(formData: FormData) {
  const raw = String(formData.get("newUploadPublicIdsJson") || "[]");

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter((value): value is string => typeof value === "string"),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

async function cleanupUploadedVehicleImages(publicIds: string[]) {
  if (!publicIds.length) {
    return;
  }

  try {
    await deleteCloudinaryAssets(publicIds);
  } catch (error) {
    console.warn(
      "[cloudinary] Unable to clean up uploaded vehicle images after a failed save.",
      error instanceof Error ? error.message : error,
    );
  }
}

async function finalizeVehicleImages(
  input: VehicleFormInput,
  uploadedPublicIds: string[],
  options: { canUploadToCloudinary: boolean },
) {
  const finalizedImages: VehicleFormInput["images"] = [];

  for (const image of input.images) {
    if (image.uploadState === "pending_url") {
      if (!image.sourceUrl) {
        throw new VehicleSaveActionError(
          "One staged image URL is missing. Add it again and save.",
        );
      }

      if (!options.canUploadToCloudinary) {
        finalizedImages.push({
          ...image,
          imageUrl: image.sourceUrl,
          cloudinaryPublicId: null,
          uploadState: "uploaded",
          sourceUrl: null,
        });
        continue;
      }

      try {
        const uploaded = await uploadVehicleImageFromUrl(image.sourceUrl, {
          stockCode: input.stockCode,
        });

        uploadedPublicIds.push(uploaded.publicId);
        finalizedImages.push({
          ...image,
          imageUrl: uploaded.secureUrl,
          cloudinaryPublicId: uploaded.publicId,
          uploadState: "uploaded",
          sourceUrl: null,
        });
      } catch (error) {
        throw new VehicleSaveActionError(
          error instanceof Error ? error.message : "Image upload failed.",
        );
      }

      continue;
    }

    if (image.uploadState !== "uploaded") {
      throw new VehicleSaveActionError(
        "One image is still unresolved. Add it again and save.",
      );
    }

    finalizedImages.push({
      ...image,
      uploadState: "uploaded",
      sourceUrl: null,
    });
  }

  return {
    finalizedImages,
  };
}

function revalidateVehiclePaths(slug?: string) {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/inventory/new");
  revalidatePath("/inventory/used");
  revalidatePath("/inventory/imported");
  revalidatePath("/inventory/traded-in");

  if (slug) {
    revalidatePath(`/cars/${slug}`);
  }
}

export async function cleanupUploadedVehicleImagesAction(publicIds: string[]) {
  await requireAdminSession();
  await cleanupUploadedVehicleImages(publicIds);
}

export async function loginAdminAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    return actionFailure("Enter both email and password.");
  }

  if (allowDemoAdmin) {
    const demoResult = await signInDemoAdmin(email, password);

    if (demoResult.success) {
      redirect("/admin/vehicles");
    }
  }

  if (!hasSupabaseConfig) {
    return actionFailure(
      allowDemoAdmin
        ? "Local demo admin is enabled. Sign in with the configured local demo credentials."
        : "Supabase auth is not configured.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.auth.signInWithPassword({ email, password });

  if (error) {
    return actionFailure(
      allowDemoAdmin
        ? "Login failed. Use the configured local demo credentials or finish Supabase admin setup."
        : "Login failed. Check the credentials and try again.",
    );
  }

  const {
    data: { user },
  } = await supabase!.auth.getUser();

  const { data: profile, error: profileError } = await supabase!
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  if (profileError || !profile) {
    await supabase!.auth.signOut();

    return actionFailure(
      profileError
        ? "Supabase admin access is not ready yet. Use the local demo admin or complete the admin_profiles setup."
        : "This account does not have admin access.",
    );
  }

  if (user?.user_metadata?.mustResetPassword) {
    redirect("/admin/reset-password");
  }

  redirect("/admin/vehicles");
}

export async function logoutAdminAction() {
  await signOutAdmin();
  redirect("/admin/login");
}

export async function saveVehicleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSession();
  const uploadedPublicIds = parseNewUploadPublicIds(formData);
  let vehicle: Awaited<ReturnType<typeof saveVehicle>>;
  let isEditing = false;

  try {
    const input = mapVehicleFormData(formData);
    isEditing = Boolean(input.id);
    const adminVehicles = await getAdminVehicles({
      forceDemo: session.mode === "demo",
    });
    const currentVehicle = adminVehicles.find((item) => item.id === input.id);
    const resolvedIdentifiers = resolveVehicleIdentifiers(
      {
        ...input,
        stockCode: currentVehicle?.stockCode || input.stockCode,
        slug: currentVehicle?.slug || input.slug,
      },
      adminVehicles,
    );
    const inputWithResolvedIdentifiers = {
      ...input,
      ...resolvedIdentifiers,
    };
    const finalized = await finalizeVehicleImages(
      inputWithResolvedIdentifiers,
      uploadedPublicIds,
      {
        canUploadToCloudinary: hasCloudinaryConfig,
      },
    );
    const inputWithUploadedImages = {
      ...inputWithResolvedIdentifiers,
      images: finalized.finalizedImages,
    };

    vehicle = await saveVehicle(inputWithUploadedImages, {
      forceDemo: session.mode === "demo",
    });
  } catch (error) {
    await cleanupUploadedVehicleImages(uploadedPublicIds);

    if (error instanceof Error && "flatten" in error) {
      return validationErrorState(
        error as unknown as { flatten: () => { fieldErrors: Record<string, string[]> } },
      );
    }

    if (error instanceof VehicleSaveActionError) {
      return actionFailure(error.message);
    }

    if (isRepositoryUnavailableError(error)) {
      return actionFailure(error.message);
    }

    return actionFailure("We could not save the vehicle right now.");
  }

  revalidateVehiclePaths(vehicle.slug);
  revalidatePath("/admin/vehicles");
  revalidatePath(`/admin/vehicles/${vehicle.id}`);
  return isEditing
    ? actionSuccess("Vehicle saved successfully.")
    : actionSuccess(
        "Vehicle created successfully.",
        `/admin/vehicles/${vehicle.id}?saved=1`,
      );
}

export async function setVehicleStatusAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireAdminSession();
    const id = String(formData.get("id") || "");
    const status = String(formData.get("status") || "") as
      | "draft"
      | "published"
      | "sold"
      | "unpublished";

    if (!id || !status) {
      return actionFailure("Select a vehicle and status before trying again.");
    }

    const vehicle = await updateVehicleStatus(id, status, {
      forceDemo: session.mode === "demo",
    });
    revalidateVehiclePaths(vehicle?.slug);
    revalidatePath("/admin/vehicles");
    return actionSuccess("Vehicle status updated.");
  } catch (error) {
    return actionFailure(
      error instanceof Error ? error.message : "Vehicle status could not be updated.",
    );
  }
}

export async function toggleVehicleFeaturedAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireAdminSession();
    const id = String(formData.get("id") || "");

    if (!id) {
      return actionFailure("Vehicle id is required.");
    }

    const vehicle = await toggleVehicleFeatured(id, {
      forceDemo: session.mode === "demo",
    });
    revalidateVehiclePaths(vehicle?.slug);
    revalidatePath("/admin/vehicles");
    return actionSuccess("Vehicle featured state updated.");
  } catch (error) {
    return actionFailure(
      error instanceof Error
        ? error.message
        : "Vehicle featured state could not be updated.",
    );
  }
}

export async function deleteVehicleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireAdminSession();
    const id = String(formData.get("id") || "");

    if (!id) {
      return actionFailure("Vehicle id is required.");
    }

    const vehicle = await getVehicleById(id, {
      forceDemo: session.mode === "demo",
    });
    await deleteVehicle(id, {
      forceDemo: session.mode === "demo",
    });
    revalidateVehiclePaths(vehicle?.slug);
    revalidatePath("/admin/vehicles");
    return actionSuccess("Vehicle deleted.");
  } catch (error) {
    return actionFailure(
      error instanceof Error ? error.message : "Vehicle deletion failed.",
    );
  }
}

export async function syncVehicleImagesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSession();
  const id = String(formData.get("id") || "");

  if (!id) {
    return actionFailure("Vehicle id is required for image sync.");
  }

  try {
    const result = await syncVehicleImagesFromCloudinary(id, {
      forceDemo: session.mode === "demo",
    });

    revalidateVehiclePaths(result.vehicle.slug);
    revalidatePath("/admin/vehicles");
    revalidatePath(`/admin/vehicles/${id}`);

    return actionSuccess(
      `Synced ${result.syncedCount} image(s) from Cloudinary folder "${result.assetFolder}".`,
    );
  } catch (error) {
    return actionFailure(
      error instanceof Error ? error.message : "Cloudinary folder sync failed.",
    );
  }
}

export async function updateLeadInboxStateAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireAdminSession();
    const sourceId = String(formData.get("sourceId") || "");
    const sourceType = String(formData.get("sourceType") || "") as LeadInboxSourceType;
    const status = String(formData.get("status") || "") as LeadWorkflowStatus;

    if (!sourceId || !sourceType || !status) {
      return actionFailure("Select a lead status before trying again.");
    }

    await updateLeadInboxState(
      {
        sourceId,
        sourceType,
        status,
      },
      {
        forceDemo: session.mode === "demo",
      },
    );

    revalidatePath("/admin/leads");

    if (status === "contacted") {
      return actionSuccess("Lead marked as contacted.");
    }

    return actionSuccess("Lead status updated.");
  } catch (error) {
    return actionFailure(
      error instanceof Error ? error.message : "Lead status could not be updated.",
    );
  }
}

export async function createAdminAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSession();

  if (!isSuperAdmin(session)) {
    return actionFailure("Only the super admin can manage admin access.");
  }

  if (!hasAdminManagementConfig) {
    return actionFailure(
      "Set ADMIN_SUPER_EMAIL and ADMIN_DEFAULT_PASSWORD to enable admin management.",
    );
  }

  if (!hasSupabaseSecretConfig) {
    return actionFailure("Supabase service key is missing. Add it to enable admin management.");
  }

  const email = normalizeEmail(String(formData.get("email") || ""));
  const fullName = String(formData.get("fullName") || "").trim();

  if (!email) {
    return actionFailure("Enter the admin email address.");
  }

  if (!isValidEmail(email)) {
    return actionFailure("Enter a valid email address.");
  }

  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    return actionFailure("Supabase admin client is unavailable.");
  }

  const defaultPassword = env.adminDefaultPassword;
  let userId: string | null = null;

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      mustResetPassword: true,
      createdBy: session.email,
    },
  });

  if (createError) {
    if (
      createError.code === "email_exists" ||
      createError.code === "user_already_exists"
    ) {
      const existing = await findUserByEmail(adminClient, email);

      if (!existing) {
        return actionFailure(
          "That email already exists but could not be retrieved. Check Supabase Auth.",
        );
      }

      userId = existing.id;

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        userId,
        {
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            ...(existing.user_metadata || {}),
            mustResetPassword: true,
            createdBy: session.email,
          },
        },
      );

      if (updateError) {
        return actionFailure(updateError.message || "Could not update the existing user.");
      }
    } else {
      return actionFailure(createError.message || "Could not create the admin account.");
    }
  } else {
    userId = created.user?.id ?? null;
  }

  if (!userId) {
    return actionFailure("Admin user could not be created.");
  }

  const { error: profileError } = await adminClient
    .from("admin_profiles")
    .upsert(
      {
        user_id: userId,
        email,
        full_name: fullName || null,
      },
      {
        onConflict: "user_id",
      },
    );

  if (profileError) {
    return actionFailure(profileError.message || "Could not save admin profile.");
  }

  revalidatePath("/admin/admins");
  return actionSuccess(
    `Admin added. Temporary password: ${defaultPassword}. They will be asked to reset it on first login.`,
  );
}

export async function disableAdminAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSession();

  if (!isSuperAdmin(session)) {
    return actionFailure("Only the super admin can manage admin access.");
  }

  if (!hasAdminSuperEmailConfig) {
    return actionFailure("Set ADMIN_SUPER_EMAIL to enable admin management.");
  }

  if (!hasSupabaseSecretConfig) {
    return actionFailure("Supabase service key is missing. Add it to manage admin access.");
  }

  const userId = String(formData.get("userId") || "");
  const email = normalizeEmail(String(formData.get("email") || ""));

  if (!userId) {
    return actionFailure("Admin user id is required.");
  }

  if (email && email === env.adminSuperEmail.toLowerCase()) {
    return actionFailure("The super admin cannot be disabled.");
  }

  if (session.userId && userId === session.userId) {
    return actionFailure("You cannot disable your own admin account.");
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return actionFailure("Supabase admin client is unavailable.");
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });

  if (error) {
    return actionFailure(error.message || "Could not disable admin access.");
  }

  revalidatePath("/admin/admins");
  return actionSuccess("Admin disabled.");
}

export async function enableAdminAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSession();

  if (!isSuperAdmin(session)) {
    return actionFailure("Only the super admin can manage admin access.");
  }

  if (!hasAdminSuperEmailConfig) {
    return actionFailure("Set ADMIN_SUPER_EMAIL to enable admin management.");
  }

  if (!hasSupabaseSecretConfig) {
    return actionFailure("Supabase service key is missing. Add it to manage admin access.");
  }

  const userId = String(formData.get("userId") || "");
  const email = normalizeEmail(String(formData.get("email") || ""));

  if (!userId) {
    return actionFailure("Admin user id is required.");
  }

  if (email && email === env.adminSuperEmail.toLowerCase()) {
    return actionFailure("The super admin cannot be disabled.");
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return actionFailure("Supabase admin client is unavailable.");
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (error) {
    return actionFailure(error.message || "Could not enable admin access.");
  }

  revalidatePath("/admin/admins");
  return actionSuccess("Admin enabled.");
}

export async function removeAdminAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminSession();

  if (!isSuperAdmin(session)) {
    return actionFailure("Only the super admin can manage admin access.");
  }

  if (!hasAdminSuperEmailConfig) {
    return actionFailure("Set ADMIN_SUPER_EMAIL to enable admin management.");
  }

  if (!hasSupabaseSecretConfig) {
    return actionFailure("Supabase service key is missing. Add it to manage admin access.");
  }

  const userId = String(formData.get("userId") || "");
  const email = normalizeEmail(String(formData.get("email") || ""));

  if (!userId) {
    return actionFailure("Admin user id is required.");
  }

  if (email && email === env.adminSuperEmail.toLowerCase()) {
    return actionFailure("The super admin cannot be removed.");
  }

  if (session.userId && userId === session.userId) {
    return actionFailure("You cannot remove your own admin account.");
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return actionFailure("Supabase admin client is unavailable.");
  }

  const { error: deleteProfileError } = await adminClient
    .from("admin_profiles")
    .delete()
    .eq("user_id", userId);

  if (deleteProfileError) {
    return actionFailure(deleteProfileError.message || "Could not remove admin profile.");
  }

  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    return actionFailure(deleteUserError.message || "Could not remove admin account.");
  }

  revalidatePath("/admin/admins");
  return actionSuccess("Admin removed.");
}

export async function resetAdminPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminSession();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!password || password.length < 8) {
    return actionFailure("Use a password with at least 8 characters.");
  }

  if (password !== confirmPassword) {
    return actionFailure("Passwords do not match.");
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return actionFailure("Supabase auth is unavailable.");
  }

  const { data, error } = await supabase.auth.updateUser({
    password,
    data: {
      mustResetPassword: false,
    },
  });

  if (error || !data.user) {
    return actionFailure(
      error?.message || "We could not reset the password right now.",
    );
  }

  return actionSuccess("Password updated. Redirecting you to the dashboard.", "/admin/vehicles");
}
