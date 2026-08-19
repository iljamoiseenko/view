export function getPlaceTypeLabel(place, t) {
  if (place.type === 'other' && place.customType) return place.customType
  return t(`placeTypes.${place.type}`)
}
