import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from 'next-themes'
import { authMiddleware } from '@/server/functions/auth'

interface MyRouterContext {
  queryClient: QueryClient
}

const scripts: React.DetailedHTMLProps<
  React.ScriptHTMLAttributes<HTMLScriptElement>,
  HTMLScriptElement
>[] = []

if (import.meta.env.VITE_INSTRUMENTATION_SCRIPT_SRC) {
  scripts.push({
    src: import.meta.env.VITE_INSTRUMENTATION_SCRIPT_SRC,
    type: 'module',
  })
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: async () => {
    const { currentUser } = await authMiddleware()

    return {
      currentUser,
    }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Is AWS Back?',
      },
      // Open Graph meta tags
      {
        property: 'og:title',
        content: 'Is AWS Back? - ❓ Status Unknown',
      },
      {
        property: 'og:description',
        content: 'Monitor AWS service health status in real-time. Get instant notifications about AWS outages and service disruptions.',
      },
      {
        property: 'og:image',
        content: '/og-image.png',
      },
      {
        property: 'og:image:width',
        content: '1200',
      },
      {
        property: 'og:image:height',
        content: '630',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: 'https://isawsback.com',
      },
      // Twitter Card meta tags
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'Is AWS Back? - ❓ Status Unknown',
      },
      {
        name: 'twitter:description',
        content: 'Monitor AWS service health status in real-time. Get instant notifications about AWS outages and service disruptions.',
      },
      {
        name: 'twitter:image',
        content: '/og-image.png',
      },
      // Additional meta tags
      {
        name: 'description',
        content: 'Monitor AWS service health status in real-time. Get instant notifications about AWS outages and service disruptions.',
      },
      {
        name: 'keywords',
        content: 'AWS, Amazon Web Services, health status, monitoring, outage, downtime, real-time',
      },
    ],
    links: [
      // Preload CSS for faster loading
      {
        rel: 'preload',
        href: appCss,
        as: 'style',
      },
      // Favicon - default grey circle
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      // Colored favicons for different AWS statuses
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon-red.svg',
        media: '(prefers-color-scheme: dark)',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon-green.svg',
        media: '(prefers-color-scheme: light)',
      },
      // Critical CSS - loads immediately and synchronously
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
    scripts: [...scripts],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Critical CSS inline to prevent FOUC */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Reset and base styles */
            *, *::before, *::after { box-sizing: border-box; }
            body { 
              margin: 0; 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; 
              -webkit-font-smoothing: antialiased; 
              -moz-osx-font-smoothing: grayscale;
              line-height: 1.5;
            }
            
            /* CSS Variables */
            :root { 
              --background: oklch(1 0 0); 
              --foreground: oklch(0.141 0.005 285.823);
              --border: oklch(0.886 0.005 285.823);
              --input: oklch(0.886 0.005 285.823);
              --ring: oklch(0.141 0.005 285.823);
              --primary: oklch(0.141 0.005 285.823);
              --primary-foreground: oklch(1 0 0);
              --secondary: oklch(0.886 0.005 285.823);
              --secondary-foreground: oklch(0.141 0.005 285.823);
              --muted: oklch(0.886 0.005 285.823);
              --muted-foreground: oklch(0.455 0.005 285.823);
              --accent: oklch(0.886 0.005 285.823);
              --accent-foreground: oklch(0.141 0.005 285.823);
              --destructive: oklch(0.628 0.258 29.234);
              --destructive-foreground: oklch(1 0 0);
              --card: oklch(1 0 0);
              --card-foreground: oklch(0.141 0.005 285.823);
              --popover: oklch(1 0 0);
              --popover-foreground: oklch(0.141 0.005 285.823);
              --radius: 0.5rem;
            }
            
            /* Dark mode variables */
            .dark {
              --background: oklch(0.141 0.005 285.823);
              --foreground: oklch(0.886 0.005 285.823);
              --border: oklch(0.455 0.005 285.823);
              --input: oklch(0.455 0.005 285.823);
              --ring: oklch(0.886 0.005 285.823);
              --primary: oklch(0.886 0.005 285.823);
              --primary-foreground: oklch(0.141 0.005 285.823);
              --secondary: oklch(0.455 0.005 285.823);
              --secondary-foreground: oklch(0.886 0.005 285.823);
              --muted: oklch(0.455 0.005 285.823);
              --muted-foreground: oklch(0.628 0.005 285.823);
              --accent: oklch(0.455 0.005 285.823);
              --accent-foreground: oklch(0.886 0.005 285.823);
              --destructive: oklch(0.628 0.258 29.234);
              --destructive-foreground: oklch(1 0 0);
              --card: oklch(0.141 0.005 285.823);
              --card-foreground: oklch(0.886 0.005 285.823);
              --popover: oklch(0.141 0.005 285.823);
              --popover-foreground: oklch(0.886 0.005 285.823);
            }
            
            /* Base body styles */
            body { 
              background-color: var(--background); 
              color: var(--foreground);
              transition: background-color 0.2s ease, color 0.2s ease;
            }
            
            /* Prevent layout shift */
            html { height: 100%; }
            body { min-height: 100vh; }
            
            /* Hide content until styles load */
            .loading { opacity: 0; }
            .loaded { opacity: 1; transition: opacity 0.1s ease-in; }
          `
        }} />
      </head>
      <body>
        {/* Ensure immediate visibility */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Remove loading class immediately
            document.documentElement.classList.remove('loading');
            document.documentElement.classList.add('loaded');
          `
        }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          {/* <TanStackDevtools
            config={{
              position: 'bottom-left',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          /> */}
        </ThemeProvider>
        <Scripts />
        
        {/* Privacy-friendly analytics by Plausible - Loaded after page load */}
        <script dangerouslySetInnerHTML={{
          __html: `
            window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};
            window.addEventListener('load', function() {
              const script = document.createElement('script');
              script.src = 'https://plausible.io/js/pa-ORpcgOYNkAJybVq5iuxvx.js';
              script.async = true;
              script.defer = true;
              document.head.appendChild(script);
            });
          `
        }} />
      </body>
    </html>
  )
}
