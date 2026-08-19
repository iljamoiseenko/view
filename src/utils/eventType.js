export function getEventTypeLabel(event, t) {
  if (event.type === 'other' && event.customType) return event.customType
  return t(`eventTypes.${event.type}`)
}
