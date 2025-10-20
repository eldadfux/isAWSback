import { createServerFn } from '@tanstack/react-start'

// Simple fallback server function for AWS health status
export const getAWSHealthStatusSimpleFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    try {
      console.log('[AWS Health Simple] Server function called')
      
      // Simple fetch without complex parsing
      const response = await fetch(
        'https://health.aws.amazon.com/public/currentevents',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; isAWSback-checker/1.0)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        },
      )

      if (!response.ok) {
        throw new Error(`AWS Health API returned ${response.status}`)
      }

      const text = await response.text()
      
      // Simple check: if response contains "[]" or is empty, AWS is operational
      if (text.trim() === '[]' || text.trim() === '') {
        return {
          status: 'yes' as const,
          lastUpdated: new Date().toISOString(),
          details: 'All AWS services operational',
        }
      }

      // If response contains data, assume there might be issues
      // This is a simplified check - in production you'd want more sophisticated parsing
      return {
        status: 'unknown' as const,
        lastUpdated: new Date().toISOString(),
        details: 'AWS status check completed - check AWS Health Dashboard for details',
      }
    } catch (error) {
      console.error('[AWS Health Simple] Error:', error)
      
      return {
        status: 'unknown' as const,
        lastUpdated: new Date().toISOString(),
        details: `Unable to fetch AWS health status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  },
)
