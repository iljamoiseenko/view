// A donation-based event has no fixed price — optionally with a suggested
// minimum amount — so it reads similarly to a free event everywhere price
// is shown, just with its own label instead of "Free".
export function eventPriceLabel(event, t) {
  if (event.isDonation) {
    return event.donationMinAmount
      ? t('common.donationFrom', event.donationMinAmount)
      : t('common.donation')
  }
  return event.price === 0 ? t('common.free') : `${event.price} ${t('common.currency')}`
}

export function isEventFreeDisplay(event) {
  return event.isDonation || event.price === 0
}
