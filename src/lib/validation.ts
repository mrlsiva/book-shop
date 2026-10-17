// Mirrors the Sling API's validation rules so shoppers see problems before submitting.

export const PASSWORD_HINT = "6–20 characters with an uppercase letter, a lowercase letter, a number and one of @ $ ! % * # ? &.";

export function passwordProblem(password: string) {
  if (password.length < 6 || password.length > 20) return "Your password must be 6–20 characters long.";
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]+$/.test(password)) {
    return `Your password needs ${PASSWORD_HINT.replace(/^6–20 characters with /, "")}`;
  }
  return "";
}

export const isPhone = (value: string) => /^\d{10}$/.test(value);
export const isPincode = (value: string) => /^[1-9]\d{5}$/.test(value);
export const isGst = (value: string) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(value);

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Shared checks for the register and profile forms; returns the first problem. */
export function profileProblem(fields: { name: string; phone?: string; altPhone: string; address: string; pincode: string; gst: string }) {
  if (!fields.name) return "Enter your name.";
  if (fields.name.length > 50) return "Your name can be at most 50 characters.";
  if (fields.phone !== undefined && !isPhone(fields.phone)) return "Enter a valid 10-digit phone number.";
  if (fields.altPhone && !isPhone(fields.altPhone)) return "Enter a valid 10-digit alternate phone number.";
  if (fields.altPhone && fields.phone !== undefined && fields.altPhone === fields.phone) return "Your alternate phone must differ from your main phone.";
  if (!fields.address) return "Enter your delivery address.";
  if (fields.address.length > 200) return "Your address can be at most 200 characters.";
  if (fields.pincode && !isPincode(fields.pincode)) return "Enter a valid 6-digit pincode.";
  if (fields.gst && !isGst(fields.gst)) return "Enter a valid 15-character GSTIN, or leave it blank.";
  return "";
}
