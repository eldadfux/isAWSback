import { useEffect } from 'react'

interface DynamicFaviconProps {
  status: 'yes' | 'no' | 'unknown'
}

export function DynamicFavicon({ status }: DynamicFaviconProps) {
  useEffect(() => {
    const updateFavicon = () => {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
      if (link) {
        switch (status) {
          case 'yes':
            link.href = '/favicon-green.svg'
            break
          case 'no':
            link.href = '/favicon-red.svg'
            break
          case 'unknown':
          default:
            link.href = '/favicon-grey.svg'
            break
        }
      }
    }

    updateFavicon()
  }, [status])

  return null
}
