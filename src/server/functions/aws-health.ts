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
  
  // Remove UTF-16LE BOM (0xFFFE)
  if (text.charCodeAt(0) === 0xFFFE) {
    return text.slice(1)
  }
  
  // Remove UTF-16BE BOM (0xFEFF) - different from UTF-8 BOM
  if (text.charCodeAt(0) === 0xFEFF && text.length > 1) {
    return text.slice(1)
  }
  
  return text
}

/**
 * Sanitizes and validates JSON text before parsing
 * Handles UTF-16 encoding issues from AWS Health API
 */
function sanitizeJSONText(rawText: string): string {
  // Strip BOM
  let cleanText = stripBOM(rawText)

  // Check for various encoding issues
  const hasReplacementChar = cleanText.length > 0 && cleanText.charCodeAt(0) === 0xfffd
  const hasNullBytes = cleanText.includes('\u0000')
  const hasPatternOfNullBytes = cleanText.length > 10 && 
    cleanText.split('').filter((_, i) => i % 2 === 1 && cleanText.charCodeAt(i) === 0).length > cleanText.length * 0.3
  
  // Check for UTF-16BE issues (every other character is null)
  const hasUTF16BEPattern = cleanText.length > 10 && 
    cleanText.split('').filter((_, i) => i % 2 === 0 && cleanText.charCodeAt(i) === 0).length > cleanText.length * 0.3
  
  if (hasReplacementChar || (hasNullBytes && hasPatternOfNullBytes) || hasUTF16BEPattern) {
    console.error('[AWS Health] Detected UTF-16 encoding issue, cleaning...')
    
    // Remove null bytes (common in UTF-16 misreadings)
    cleanText = cleanText.replace(/\u0000/g, '')
    
    // Remove Unicode replacement characters
    cleanText = cleanText.replace(/\uFFFD/g, '')
    
    // Remove any other control characters that might interfere
    cleanText = cleanText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    
    console.error('[AWS Health] After UTF-16 cleanup, length:', cleanText.length)
  } else {
    // Remove any stray null bytes and control characters
    cleanText = cleanText.replace(/\0/g, '')
    cleanText = cleanText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
  }
  
  // Remove any remaining Unicode replacement characters that might interfere with JSON parsing
  cleanText = cleanText.replace(/\uFFFD/g, '')

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
    // Handle UTF-16 encoding properly based on content-type
    let rawText: string
    
    // Check content-type to determine encoding
    const isUTF16 = contentType?.includes('utf-16') || false
    
    console.error('[AWS Health] Content-Type:', contentType)
    console.error('[AWS Health] Detected UTF-16:', isUTF16)
    
    try {
      // Get as arrayBuffer first to handle encoding properly
      const arrayBuffer = await response.arrayBuffer()
      
      if (isUTF16) {
        // Content-Type indicates UTF-16, try both variants
        console.error('[AWS Health] Content-Type indicates UTF-16, trying UTF-16LE first')
        
        try {
          const utf16Decoder = new TextDecoder('utf-16le')
          rawText = utf16Decoder.decode(arrayBuffer)
          
          // Check if UTF-16LE produced valid JSON
          if (!rawText.trim().startsWith('[') && !rawText.trim().startsWith('{')) {
            console.error('[AWS Health] UTF-16LE did not produce valid JSON, trying UTF-16BE')
            const utf16BEDecoder = new TextDecoder('utf-16be')
            rawText = utf16BEDecoder.decode(arrayBuffer)
          }
        } catch (utf16Error) {
          console.error('[AWS Health] UTF-16LE failed, trying UTF-16BE:', utf16Error)
          const utf16BEDecoder = new TextDecoder('utf-16be')
          rawText = utf16BEDecoder.decode(arrayBuffer)
        }
      } else {
        // Try UTF-8 first (most common)
        try {
          const decoder = new TextDecoder('utf-8')
          rawText = decoder.decode(arrayBuffer)
          
          // Check if the result looks like UTF-16 data (has replacement chars or null bytes)
          if (rawText.includes('\uFFFD') || rawText.includes('\u0000')) {
            console.error('[AWS Health] UTF-8 decode produced invalid characters, trying UTF-16 variants')
            
            // Check for BOM to determine endianness
            const firstTwoBytes = new Uint8Array(arrayBuffer.slice(0, 2))
            const bom = (firstTwoBytes[0] << 8) | firstTwoBytes[1]
            
            if (bom === 0xFFFE) {
              // UTF-16LE BOM
              console.error('[AWS Health] Detected UTF-16LE BOM, using UTF-16LE decoder')
              const utf16Decoder = new TextDecoder('utf-16le')
              rawText = utf16Decoder.decode(arrayBuffer)
            } else if (bom === 0xFEFF) {
              // UTF-16BE BOM
              console.error('[AWS Health] Detected UTF-16BE BOM, using UTF-16BE decoder')
              const utf16Decoder = new TextDecoder('utf-16be')
              rawText = utf16Decoder.decode(arrayBuffer)
            } else {
              // No BOM, try UTF-16LE first (more common)
              console.error('[AWS Health] No BOM detected, trying UTF-16LE')
              const utf16Decoder = new TextDecoder('utf-16le')
              rawText = utf16Decoder.decode(arrayBuffer)
              
              // If UTF-16LE produces garbled text, try UTF-16BE
              if (rawText.includes('\uFFFD') || rawText.length < 10) {
                console.error('[AWS Health] UTF-16LE produced garbled text, trying UTF-16BE')
                const utf16BEDecoder = new TextDecoder('utf-16be')
                rawText = utf16BEDecoder.decode(arrayBuffer)
              }
            }
          }
        } catch (utf8Error) {
          // If UTF-8 fails, try UTF-16 variants
          console.error('[AWS Health] UTF-8 decode failed, trying UTF-16 variants:', utf8Error)
          
          try {
            const decoder = new TextDecoder('utf-16le')
            rawText = decoder.decode(arrayBuffer)
          } catch (utf16LEError) {
            console.error('[AWS Health] UTF-16LE failed, trying UTF-16BE:', utf16LEError)
            const decoder = new TextDecoder('utf-16be')
            rawText = decoder.decode(arrayBuffer)
          }
        }
      }
      
      // Additional validation: check if the decoded text looks like JSON
      if (!rawText.trim().startsWith('[') && !rawText.trim().startsWith('{')) {
        console.error('[AWS Health] Decoded text does not look like JSON, trying alternative approach')
        // Try to find the actual JSON start
        const jsonStart = rawText.search(/[\[\{]/)
        if (jsonStart > 0) {
          rawText = rawText.substring(jsonStart)
          console.error('[AWS Health] Trimmed to JSON start at position:', jsonStart)
        }
      }
      
    } catch (arrayBufferError) {
      // Fallback to text() method
      console.error('[AWS Health] ArrayBuffer approach failed, trying text():', arrayBufferError)
      rawText = await response.text()
    }

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
        
        // Try to fix the problematic character
        console.error('[AWS Health] Attempting to fix problematic character...')
        const fixedText = cleanText.replace(new RegExp(badChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
        
        try {
          events = JSON.parse(fixedText)
          console.error('[AWS Health] Successfully parsed after removing problematic character')
        } catch (secondError) {
          console.error('[AWS Health] Second parse attempt failed:', secondError)
          
          // Final fallback: try to extract just the JSON array
          console.error('[AWS Health] Attempting final fallback - extracting JSON array...')
          const arrayMatch = cleanText.match(/\[[\s\S]*\]/)
          if (arrayMatch) {
            try {
              events = JSON.parse(arrayMatch[0])
              console.error('[AWS Health] Successfully parsed extracted JSON array')
            } catch (extractError) {
              console.error('[AWS Health] Final fallback failed:', extractError)
              throw new Error(`Failed to parse JSON: ${errorMsg}`)
            }
          } else {
            throw new Error(`Failed to parse JSON: ${errorMsg}`)
          }
        }
      } else {
        throw new Error(`Failed to parse JSON: ${errorMsg}`)
      }
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

    // Ensure events is serializable
    const serializableEvents = events.map(event => ({
      date: event.date || '',
      arn: event.arn || '',
      region_name: event.region_name || '',
      status: event.status || '',
      service: event.service || '',
      service_name: event.service_name || '',
      summary: event.summary || '',
      event_log: Array.isArray(event.event_log) ? event.event_log.map(log => ({
        summary: log.summary || '',
        message: log.message || '',
        status: log.status || 0,
        timestamp: log.timestamp || 0,
      })) : [],
      impacted_services: event.impacted_services && typeof event.impacted_services === 'object' 
        ? Object.fromEntries(
            Object.entries(event.impacted_services).map(([key, service]) => [
              key,
              {
                service_name: service.service_name || '',
                current: service.current || '',
                max: service.max || '',
              }
            ])
          )
        : {},
    }))

    // If no events, AWS is operational
    if (serializableEvents.length === 0) {
      return {
        status: 'yes',
        lastUpdated: new Date().toISOString(),
        details: 'All AWS services operational',
      }
    }

    // Count impacted services from all events
    const impactedServicesSet = new Set<string>()

    serializableEvents.forEach((event) => {
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
    try {
      console.log('[AWS Health] Server function called')
      const now = Date.now()

      // Return cached status if still valid
      if (cachedStatus && now - cachedStatus.timestamp < CACHE_DURATION) {
        console.log('[AWS Health] Returning cached status')
        return {
          status: cachedStatus.status,
          lastUpdated: cachedStatus.lastUpdated,
          details: cachedStatus.details,
        }
      }

      console.log('[AWS Health] Fetching fresh status...')
      
      // Fetch fresh status
      const healthStatus = await fetchAWSHealthStatus()

      // Update cache with serializable data only
      cachedStatus = {
        status: healthStatus.status,
        lastUpdated: healthStatus.lastUpdated,
        details: healthStatus.details,
        timestamp: now,
      }

      console.log('[AWS Health] Successfully fetched status:', healthStatus.status)
      
      // Return only serializable data
      return {
        status: healthStatus.status,
        lastUpdated: healthStatus.lastUpdated,
        details: healthStatus.details,
      }
    } catch (error) {
      console.error('[AWS Health] Error in server function:', error)
      
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
        details: `Unable to fetch AWS health status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  },
)
