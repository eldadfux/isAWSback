import { createServerFn } from '@tanstack/react-start'

// In-memory cache for AWS health status
let cachedStatus: {
  status: 'yes' | 'no' | 'unknown'
  lastUpdated: string
  details: string
  timestamp: number
} | null = null

const CACHE_DURATION = 10000 // 10 seconds
const FETCH_TIMEOUT = 8000 // 8 seconds

interface AWSHealthResponse {
  status: 'yes' | 'no' | 'unknown'
  lastUpdated: string
  details: string
}

interface AWSEventLogEntry {
  summary: string
  message: string
  status: number
  timestamp: number
}

interface ImpactedService {
  service_name: string
  current: string
  max: string
}

interface AWSCurrentEvent {
  date: string
  arn: string
  region_name: string
  status: string
  service: string
  service_name: string
  summary: string
  event_log: AWSEventLogEntry[]
  impacted_services: {
    [key: string]: ImpactedService
  }
}

/**
 * Removes BOM (Byte Order Mark) and other encoding artifacts from text
 */
function stripBOM(text: string): string {
  // Remove UTF-8 BOM (EF BB BF)
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1)
  }
  // Remove other common BOM patterns
  if (text.startsWith('\uFEFF')) {
    return text.slice(1)
  }
  return text
}

/**
 * Sanitizes and validates JSON text before parsing
 */
function sanitizeJSONText(rawText: string): string {
  // Strip BOM
  let cleanText = stripBOM(rawText)

  // Remove any null bytes
  cleanText = cleanText.replace(/\0/g, '')

  // Trim whitespace
  cleanText = cleanText.trim()

  return cleanText
}

/**
 * Fetches AWS health status from the AWS Health Dashboard Public API
 * Checks for active events/incidents
 */
async function fetchAWSHealthStatus(): Promise<AWSHealthResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    // Fetch from the public current events API
    const response = await fetch(
      'https://health.aws.amazon.com/public/currentevents',
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; isAWSback-checker/1.0)',
          Accept: 'application/json',
          'Accept-Charset': 'utf-8',
        },
      },
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`AWS Health API returned ${response.status}`)
    }

    // Validate and log content-type and encoding
    const contentType = response.headers.get('content-type')
    const contentEncoding = response.headers.get('content-encoding')

    if (!contentType || !contentType.includes('application/json')) {
      console.error(
        `[AWS Health] Unexpected content-type: ${contentType}. Expected application/json`,
      )
    }

    // Log encoding information for debugging
    if (contentEncoding) {
      console.error(`[AWS Health] Content-Encoding: ${contentEncoding}`)
    }

    // Get the raw text first for validation and debugging
    const rawText = await response.text()

    // Log raw response details when debugging
    console.error('[AWS Health] Response length:', rawText.length)
    console.error(
      '[AWS Health] First 200 chars (raw):',
      JSON.stringify(rawText.substring(0, 200)),
    )
    console.error(
      '[AWS Health] First char code:',
      rawText.charCodeAt(0).toString(16),
    )

    // Validate response is not empty
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Empty response from AWS Health API')
    }

    // Sanitize the response text (remove BOM, null bytes, etc.)
    const cleanText = sanitizeJSONText(rawText)

    console.error('[AWS Health] After sanitization, length:', cleanText.length)
    console.error(
      '[AWS Health] After sanitization, first 200 chars:',
      JSON.stringify(cleanText.substring(0, 200)),
    )

    // Attempt to parse JSON with detailed error handling
    let events: AWSCurrentEvent[]
    try {
      events = JSON.parse(cleanText)
    } catch (parseError) {
      const errorMsg =
        parseError instanceof Error ? parseError.message : 'Unknown parse error'
      console.error('[AWS Health] JSON parse error:', errorMsg)
      console.error(
        '[AWS Health] Attempted to parse (first 500 chars):',
        cleanText.substring(0, 500),
      )

      // Try to identify the problematic character
      const match = errorMsg.match(/Unrecognized token '(.)'/)
      if (match) {
        const badChar = match[1]
        const charCode = badChar.charCodeAt(0)
        console.error(
          `[AWS Health] Problematic character: '${badChar}' (code: ${charCode.toString(16)})`,
        )
        // Find position of the character
        const pos = cleanText.indexOf(badChar)
        if (pos !== -1) {
          console.error(
            `[AWS Health] Character found at position ${pos}, context: ${cleanText.substring(Math.max(0, pos - 20), pos + 20)}`,
          )
        }
      }

      throw new Error(`Failed to parse JSON: ${errorMsg}`)
    }

    // Validate the response is an array
    if (!Array.isArray(events)) {
      console.error(
        '[AWS Health] Expected array response, got:',
        typeof events,
        'Value:',
        JSON.stringify(events).substring(0, 200),
      )
      throw new Error('Expected array response from AWS Health API')
    }

    console.error(`[AWS Health] Successfully parsed ${events.length} events`)

    // If no events, AWS is operational
    if (events.length === 0) {
      return {
        status: 'yes',
        lastUpdated: new Date().toISOString(),
        details: 'All AWS services operational',
      }
    }

    // Count impacted services from all events
    const impactedServicesSet = new Set<string>()

    events.forEach((event) => {
      // Validate event structure
      if (!event || typeof event !== 'object') {
        console.error('[AWS Health] Invalid event object:', event)
        return
      }

      // Check if impacted_services exists and is an object
      if (
        !event.impacted_services ||
        typeof event.impacted_services !== 'object'
      ) {
        return
      }

      // Iterate through impacted services
      Object.entries(event.impacted_services).forEach(([_key, serviceInfo]) => {
        // Validate service info structure
        if (
          !serviceInfo ||
          typeof serviceInfo !== 'object' ||
          !serviceInfo.service_name ||
          typeof serviceInfo.current !== 'string'
        ) {
          return
        }

        // Count services where current > 0 (meaning they have some level of impact)
        const current = parseInt(serviceInfo.current, 10)
        if (!isNaN(current) && current > 0) {
          impactedServicesSet.add(serviceInfo.service_name)
        }
      })
    })

    const impactedCount = impactedServicesSet.size

    // If there are active events with impacted services, AWS is experiencing issues
    if (impactedCount > 0) {
      return {
        status: 'no',
        lastUpdated: new Date().toISOString(),
        details: `AWS is experiencing issues - ${impactedCount} service${impactedCount !== 1 ? 's' : ''} impacted`,
      }
    }

    // Events exist but no services are currently impacted (recovering)
    return {
      status: 'yes',
      lastUpdated: new Date().toISOString(),
      details: 'All AWS services operational',
    }
  } catch (error) {
    clearTimeout(timeoutId)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    console.error(
      '[AWS Health] Error fetching AWS health status:',
      errorMessage,
    )

    // Return cached status if available, otherwise unknown
    if (cachedStatus) {
      console.error('[AWS Health] Returning cached status due to error')
      return {
        status: cachedStatus.status,
        lastUpdated: cachedStatus.lastUpdated,
        details: cachedStatus.details,
      }
    }

    return {
      status: 'unknown',
      lastUpdated: new Date().toISOString(),
      details: `Unable to fetch AWS health status: ${errorMessage}`,
    }
  }
}

/**
 * Server function to get AWS health status
 * Implements caching and error handling
 */
export const getAWSHealthStatusFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const now = Date.now()

    // Return cached status if still valid
    if (cachedStatus && now - cachedStatus.timestamp < CACHE_DURATION) {
      return {
        status: cachedStatus.status,
        lastUpdated: cachedStatus.lastUpdated,
        details: cachedStatus.details,
      }
    }

    // Fetch fresh status
    const healthStatus = await fetchAWSHealthStatus()

    // Update cache
    cachedStatus = {
      ...healthStatus,
      timestamp: now,
    }

    return healthStatus
  },
)
