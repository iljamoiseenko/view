import { useEffect, useState } from 'react'
import { Share } from '@capacitor/share'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { useLanguage } from '../../context/LanguageContext'
import { isNative, publicOrigin } from '../../native/platform'

// Opens the native share sheet in the iOS app (and navigator.share on mobile web).
// Hidden where sharing isn't supported, e.g. most desktop browsers.
export default function ShareButton({ title, text, path, className = 'btn btn-outline' }) {
  const { t } = useLanguage()
  const [canShare, setCanShare] = useState(isNative)

  useEffect(() => {
    if (isNative) return
    Share.canShare().then(r => setCanShare(r.value)).catch(() => setCanShare(false))
  }, [])

  if (!canShare) return null

  const handleShare = async () => {
    if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    try {
      await Share.share({ title, text, url: `${publicOrigin()}${path}` })
    } catch { /* user dismissed the sheet */ }
  }

  return (
    <button type="button" className={className} onClick={handleShare}>
      {t('common.share')}
    </button>
  )
}
