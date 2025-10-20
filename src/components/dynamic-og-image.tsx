import { useEffect } from 'react'

interface DynamicOGImageProps {
  status: 'yes' | 'no' | 'unknown'
}

export function DynamicOGImage({ status }: DynamicOGImageProps) {
  useEffect(() => {
    const updateOGImage = () => {
      // Update og:image meta tag
      const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement
      if (ogImage) {
        switch (status) {
          case 'yes':
            ogImage.content = '/og-image-green.png'
            break
          case 'no':
            ogImage.content = '/og-image-red.png'
            break
          case 'unknown':
          default:
            ogImage.content = '/og-image-grey.png'
            break
        }
      }

      // Update twitter:image meta tag
      const twitterImage = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement
      if (twitterImage) {
        switch (status) {
          case 'yes':
            twitterImage.content = '/og-image-green.png'
            break
          case 'no':
            twitterImage.content = '/og-image-red.png'
            break
          case 'unknown':
          default:
            twitterImage.content = '/og-image-grey.png'
            break
        }
      }

      // Update og:title and twitter:title based on status
      const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement
      const twitterTitle = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement
      
      let statusText = ''
      switch (status) {
        case 'yes':
          statusText = '✅ All Systems Operational'
          break
        case 'no':
          statusText = '❌ Service Disruption Detected'
          break
        case 'unknown':
        default:
          statusText = '❓ Status Unknown'
          break
      }

      if (ogTitle) {
        ogTitle.content = `Is AWS Back? - ${statusText}`
      }
      if (twitterTitle) {
        twitterTitle.content = `Is AWS Back? - ${statusText}`
      }
    }

    updateOGImage()
  }, [status])

  return null
}
