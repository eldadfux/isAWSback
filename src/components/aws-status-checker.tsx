import { useEffect, useState, useRef } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { getAWSHealthStatusFn } from '@/server/functions/aws-health'
import { getAWSHealthStatusSimpleFn } from '@/server/functions/aws-health-simple'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { DynamicFavicon } from './dynamic-favicon'
import { DynamicOGImage } from './dynamic-og-image'

interface StatusData {
  status: 'yes' | 'no' | 'unknown'
  lastUpdated: string
  details: string
}

const REFRESH_INTERVAL = 30000 // 30 seconds

export function AWSStatusChecker() {
  const [statusData, setStatusData] = useState<StatusData>({
    status: 'unknown',
    lastUpdated: new Date().toISOString(),
    details: 'Checking AWS status...',
  })
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  const fetchingRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const getStatus = useServerFn(getAWSHealthStatusFn)
  const getStatusSimple = useServerFn(getAWSHealthStatusSimpleFn)

  const fetchStatus = async () => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current) {
      return
    }

    fetchingRef.current = true
    setIsFetching(true)

    try {
      setError(null)
      let data
      try {
        // Try the main function first
        data = await getStatus()
      } catch (mainError) {
        console.error('[AWS Status] Main function failed, trying simple fallback:', mainError)
        // Fallback to simple function
        data = await getStatusSimple()
      }
      
      setStatusData(data as StatusData)
    } catch (err) {
      console.error('[AWS Status] Both functions failed:', err)
      setError('Unable to check AWS status')

      // Set status to unknown on error
      setStatusData({
        status: 'unknown',
        lastUpdated: new Date().toISOString(),
        details: 'Unable to fetch AWS health status',
      })
    } finally {
      fetchingRef.current = false
      setIsFetching(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchStatus()

    // Set up auto-refresh interval
    intervalRef.current = setInterval(() => {
      fetchStatus()
    }, REFRESH_INTERVAL)

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const getStatusConfig = () => {
    if (!statusData) {
      return {
        text: '❓',
        color: 'text-gray-500',
        bgGradient: 'from-gray-100 to-gray-200',
        darkBgGradient: 'dark:from-gray-800 dark:to-gray-900',
        message: 'Status Unknown',
      }
    }

    switch (statusData.status) {
      case 'yes':
        return {
          text: '✅',
          color: 'text-green-600 dark:text-green-400',
          bgGradient: 'from-green-50 to-emerald-50',
          darkBgGradient: 'dark:from-green-950 dark:to-emerald-950',
          message: 'AWS is operational',
        }
      case 'no':
        return {
          text: '❌',
          color: 'text-red-600 dark:text-red-400',
          bgGradient: 'from-red-50 to-rose-50',
          darkBgGradient: 'dark:from-red-950 dark:to-rose-950',
          message: 'AWS is experiencing issues',
        }
      case 'unknown':
      default:
        return {
          text: '❓',
          color: 'text-gray-600 dark:text-gray-400',
          bgGradient: 'from-gray-50 to-slate-50',
          darkBgGradient: 'dark:from-gray-900 dark:to-slate-900',
          message: 'Unable to determine AWS status',
        }
    }
  }

  const config = getStatusConfig()

  const getTimeAgo = () => {
    if (!statusData?.lastUpdated) return ''
    try {
      return formatDistanceToNow(new Date(statusData.lastUpdated), {
        addSuffix: true,
      })
    } catch {
      return ''
    }
  }

  return (
    <>
      <DynamicFavicon status={statusData?.status || 'unknown'} />
      <DynamicOGImage status={statusData?.status || 'unknown'} />
      <div
        className={cn(
          'min-h-screen flex flex-col items-center justify-center p-8 transition-all duration-1000 ease-in-out',
          'bg-gradient-to-br',
          config.bgGradient,
          config.darkBgGradient,
        )}
      >
      <main
        className="flex flex-col items-center justify-center gap-8 max-w-4xl w-full"
        role="main"
        aria-label="AWS Status Checker"
      >
        {/* Main Status Display */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white">
            Is AWS Back?
          </h1>

          <div
            className={cn(
              'text-8xl md:text-[12rem] font-black tracking-tight transition-all duration-700 ease-in-out leading-none',
              config.color,
            )}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{ minHeight: '1em', lineHeight: '1' }}
          >
            {config.text}
          </div>

          <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 font-medium transition-colors duration-700 ease-in-out">
            {config.message}
          </p>
        </div>

        {/* Details Section - Always reserve space */}
        <div className="w-full max-w-2xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 min-h-[200px] transition-all duration-700 ease-in-out">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400 font-medium">
                Last Updated
              </span>
              <div className="flex items-center gap-2">
                {isFetching && (
                  <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
                )}
                <time
                  className="text-gray-900 dark:text-gray-100 font-semibold"
                  dateTime={statusData?.lastUpdated || ''}
                >
                  {getTimeAgo()}
                </time>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}

            {statusData?.details && statusData.details !== 'Checking AWS status...' && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">
                  Details
                </p>
                <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                  {statusData.details}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                Auto-refreshing every 30 seconds
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-600 dark:text-gray-400 space-y-4">
          <p>
            Monitoring AWS health status •{' '}
            <a
              href="https://health.aws.amazon.com/health/status"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              Official AWS Health Dashboard
            </a>
          </p>
          
          {/* Appwrite Attribution */}
          <div className="flex items-center justify-center gap-2 text-xs mt-6">
            <span>This service is brought to you courtesy of</span>
            <a
              href="https://appwrite.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <img
                src="https://appwrite.io/images/logos/appwrite-light.svg"
                alt="Appwrite"
                className="h-4 w-auto"
              />
            </a>
          </div>
        </footer>
      </main>
    </div>
    </>
  )
}
