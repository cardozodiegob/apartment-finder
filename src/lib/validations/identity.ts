/**
 * Validates ID numbers based on country and ID type.
 */
export function validateIdNumber(
  idType: string,
  idNumber: string,
  nationality: string
): { valid: boolean; error?: string } {
  if (!idNumber || !idType) {
    return { valid: false, error: "ID type and number are required" };
  }

  const trimmed = idNumber.trim();

  // Passport (generic) for any country
  if (idType === "passport") {
    // UK passport: 9 digits
    if (nationality.toLowerCase() === "united kingdom" || nationality.toLowerCase() === "uk") {
      if (/^\d{9}$/.test(trimmed)) return { valid: true };
      return { valid: false, error: "UK passport must be 9 digits" };
    }
    // Generic passport: 6-9 alphanumeric
    if (/^[A-Za-z0-9]{6,9}$/.test(trimmed)) return { valid: true };
    return { valid: false, error: "Passport must be 6-9 alphanumeric characters" };
  }

  if (idType === "national_id") {
    const country = nationality.toLowerCase();

    // Germany: 10 digits
    if (country === "germany") {
      if (/^\d{10}$/.test(trimmed)) return { valid: true };
      return { valid: false, error: "German national ID must be 10 digits" };
    }

    // France: 12 digits
    if (country === "france") {
      if (/^\d{12}$/.test(trimmed)) return { valid: true };
      return { valid: false, error: "French national ID must be 12 digits" };
    }

    // Spain (DNI): 8 digits + 1 letter
    if (country === "spain") {
      if (/^\d{8}[A-Za-z]$/.test(trimmed)) return { valid: true };
      return { valid: false, error: "Spanish DNI must be 8 digits followed by 1 letter" };
    }

    // Italy (codice fiscale): 16 chars — 2 letters + 5 digits + 1 letter + 1 digit + 1 letter + 3 digits + 1 letter
    if (country === "italy") {
      if (/^[A-Za-z]{2}\d{5}[A-Za-z]\d[A-Za-z]\d{3}[A-Za-z]$/.test(trimmed)) return { valid: true };
      return { valid: false, error: "Italian codice fiscale must be 16 characters (e.g., AB12345C6D789E)" };
    }

    // Portugal: 8 digits
    if (country === "portugal") {
      if (/^\d{8}$/.test(trimmed)) return { valid: true };
      return { valid: false, error: "Portuguese national ID must be 8 digits" };
    }
  }

  // Residence permit or other countries: 6-20 alphanumeric
  if (/^[A-Za-z0-9]{6,20}$/.test(trimmed)) return { valid: true };
  return { valid: false, error: "ID number must be 6-20 alphanumeric characters" };
}
