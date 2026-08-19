// Some venue owners cram multiple locations into one address field,
// separated by a pin emoji (or occasionally a newline). Split those apart
// for display; a plain single address just comes back as a 1-item array.
export function parseAddresses(address) {
  if (!address) return []
  return address
    .split(/📍|\n/)
    .map(s => s.trim())
    .filter(Boolean)
}
