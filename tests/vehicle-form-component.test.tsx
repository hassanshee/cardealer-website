import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cleanupUploadedVehicleImagesAction: vi.fn(),
  router: {
    push: vi.fn(),
    refresh: vi.fn(),
  },
  saveVehicleAction: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: mocks.useRouter,
}));

vi.mock("@/lib/actions/admin-actions", () => ({
  cleanupUploadedVehicleImagesAction: mocks.cleanupUploadedVehicleImagesAction,
  saveVehicleAction: mocks.saveVehicleAction,
}));

import { VehicleForm } from "@/components/admin/vehicle-form";
import type { Vehicle } from "@/types/dealership";

function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "vehicle-1",
    title: "2021 Toyota Corolla",
    stockCode: "COR-001",
    slug: "2021-toyota-corolla",
    make: "Toyota",
    model: "Corolla",
    year: 2021,
    condition: "Foreign used",
    price: 2150000,
    negotiable: false,
    mileage: 24000,
    transmission: "Automatic",
    fuelType: "Petrol",
    driveType: null,
    bodyType: "Sedan",
    engineCapacity: null,
    color: "White",
    locationId: null,
    location: null,
    featured: false,
    status: "draft",
    stockCategory: "used",
    description: "Clean unit ready for viewing.",
    heroImageUrl: null,
    images: [],
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useRouter.mockReturnValue(mocks.router);
  mocks.saveVehicleAction.mockResolvedValue({
    success: false,
    message: "Please review the highlighted fields and try again.",
    fieldErrors: {
      images: ["Add at least one gallery image."],
      price: ["Enter the price in KES."],
    },
  });
});

describe("VehicleForm", () => {
  it("keeps save disabled on a blank create form until the admin starts typing", () => {
    render(<VehicleForm locations={[]} />);

    const saveButton = screen.getByRole("button", { name: /save vehicle/i });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/make/i), {
      target: { value: "Toyota" },
    });

    expect(saveButton).toBeEnabled();
  });

  it("renders a keyboard-accessible file staging button with image type filters", () => {
    const { container } = render(<VehicleForm locations={[]} />);

    expect(
      screen.getByRole("button", { name: /add photos from phone/i }),
    ).toBeInTheDocument();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;

    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveAttribute(
      "accept",
      expect.stringContaining("image/jpeg"),
    );
    expect(fileInput).toHaveAttribute(
      "accept",
      expect.stringContaining("image/png"),
    );
  });

  it("quick-fills core fields from a WhatsApp-style dealer message", () => {
    render(
      <VehicleForm
        locations={[
          {
            id: "mombasa",
            name: "Mombasa Showroom",
            addressLine: "Moi Avenue",
            city: "Mombasa",
            phone: "+254700000000",
            hours: "9am-6pm",
            isPrimary: true,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/dealer message/i), {
      target: {
        value:
          "Toyota Harrier 2017 petrol automatic 83,000 km Ksh 3.4M Mombasa very clean",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /parse & fill/i }));

    expect(screen.getByLabelText(/make/i)).toHaveValue("Toyota");
    expect(screen.getByLabelText(/model/i)).toHaveValue("Harrier");
    expect(screen.getByLabelText(/year/i)).toHaveValue(2017);
    expect(document.getElementById("price")).toHaveValue("3400000");
    expect(screen.getByLabelText(/mileage/i)).toHaveValue("83000");
    expect(screen.getByLabelText(/condition/i)).toHaveValue("Very clean");
    expect(screen.getByLabelText(/transmission/i)).toHaveValue("Automatic");
    expect(screen.getByLabelText(/fuel type/i)).toHaveValue("Petrol");
    expect(screen.getByLabelText(/location/i)).toHaveValue("mombasa");
  });

  it("surfaces field-level save errors inline after submission", async () => {
    render(<VehicleForm locations={[]} />);

    fireEvent.change(screen.getByLabelText(/make/i), {
      target: { value: "Toyota" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save vehicle/i }));

    await waitFor(() => {
      expect(screen.getByText("Enter the price in KES.")).toBeInTheDocument();
    });

    expect(screen.getByText("Add at least one gallery image.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("warns before leaving when the editor has unsaved changes", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<VehicleForm locations={[]} vehicle={buildVehicle()} />);

    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: "Corolla Cross" },
    });
    fireEvent.click(screen.getByRole("button", { name: /return to inventory/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("reconciles staged url images after a successful edit save", async () => {
    mocks.saveVehicleAction.mockResolvedValueOnce({
      success: true,
      message: "Vehicle saved successfully.",
      savedImages: [
        {
          imageUrl: "https://cdn.example.com/imported-car.jpg",
          cloudinaryPublicId: "vehicle/imported-car",
          sortOrder: 0,
          isHero: true,
          uploadState: "uploaded",
          sourceUrl: null,
        },
      ],
    });

    render(<VehicleForm locations={[]} vehicle={buildVehicle()} />);

    fireEvent.click(screen.getByText(/add image from url/i));
    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: "https://example.com/car.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: /stage url/i }));

    expect(screen.getByText("Imports on save")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Vehicle saved successfully.")).toBeInTheDocument();
    });

    expect(screen.queryByText("Imports on save")).not.toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(
      screen.getByText("https://cdn.example.com/imported-car.jpg"),
    ).toBeInTheDocument();
  });

  it("prevents duplicate submits while a save is in flight", async () => {
    let resolveSave: (
      value: Awaited<ReturnType<typeof mocks.saveVehicleAction>>,
    ) => void = () => {};

    mocks.saveVehicleAction.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );

    render(<VehicleForm locations={[]} vehicle={buildVehicle()} />);

    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: "Corolla Cross" },
    });

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.saveVehicleAction).toHaveBeenCalledTimes(1);
    });

    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);

    expect(mocks.saveVehicleAction).toHaveBeenCalledTimes(1);

    resolveSave({
      success: true,
      message: "Vehicle saved successfully.",
      savedImages: [],
    });

    await waitFor(() => {
      expect(screen.getByText("Vehicle saved successfully.")).toBeInTheDocument();
    });
  });
});
