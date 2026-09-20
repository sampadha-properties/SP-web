export function cleanPhoneNumber(value: string): string {
  return value.replace(/[^0-9+]/g, "").replace(/(?!^)\+/g, "");
}

export function phoneHref(value: string): string {
  const cleaned = cleanPhoneNumber(value);
  return cleaned.startsWith("+")
    ? `+${cleaned.slice(1).replace(/\D/g, "")}`
    : cleaned.replace(/\D/g, "");
}

export function whatsappNumber(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("91") && digits.length === 12) {
    return digits;
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

export function whatsappHref(value: string): string {
  return `https://wa.me/${whatsappNumber(value)}`;
}
