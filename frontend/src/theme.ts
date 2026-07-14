export const colors = {
  surface: "#FFFFFF",
  onSurface: "#111827",
  surfaceSecondary: "#F9FAFB",
  onSurfaceSecondary: "#374151",
  surfaceTertiary: "#EEF2F6",
  onSurfaceTertiary: "#4B5563",
  surfaceInverse: "#0A1929",
  onSurfaceInverse: "#FFFFFF",
  brand: "#0B3A64",
  brandPrimary: "#1A65A9",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E6F0F9",
  onBrandSecondary: "#0B3A64",
  brandTertiary: "#F0F5FA",
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  info: "#0284C7",
  border: "#E5E7EB",
  borderStrong: "#9CA3AF",
  divider: "#F3F4F6",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export const shadow = {
  card: {
    shadowColor: "#0B3A64",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  strong: {
    shadowColor: "#0B3A64",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const font = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
};

export const ROLES: Record<string, string> = {
  patient: "Patient:in",
  relative: "Angehörige:r",
  caregiver: "Pflegekraft",
};

export const MED_COLORS = ["#1A65A9", "#0B3A64", "#059669", "#D97706", "#0284C7", "#7C3AED"];
export const MED_FORMS = ["Tablette", "Kapsel", "Tropfen", "Spritze", "Creme", "Sonstiges"];
export const WEEKDAYS_FULL = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
