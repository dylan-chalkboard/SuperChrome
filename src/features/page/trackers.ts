/**
 * Tracker detection: match the page's loaded resource URLs against known
 * analytics/ads/replay endpoints. Pure logic — the palette feeds it script
 * sources plus the performance resource timeline.
 */

export interface TrackerSignature {
  name: string
  category: 'Analytics' | 'Ads' | 'Session Replay' | 'Errors' | 'Marketing'
  domains: string[]
}

export const TRACKER_SIGNATURES: TrackerSignature[] = [
  { name: 'Google Analytics', category: 'Analytics', domains: ['google-analytics.com', 'googletagmanager.com/gtag'] },
  { name: 'Google Tag Manager', category: 'Marketing', domains: ['googletagmanager.com/gtm'] },
  { name: 'Google Ads / DoubleClick', category: 'Ads', domains: ['doubleclick.net', 'googleadservices.com', 'googlesyndication.com'] },
  { name: 'Meta Pixel', category: 'Ads', domains: ['connect.facebook.net', 'facebook.com/tr'] },
  { name: 'TikTok Pixel', category: 'Ads', domains: ['analytics.tiktok.com'] },
  { name: 'X (Twitter) Pixel', category: 'Ads', domains: ['static.ads-twitter.com', 'analytics.twitter.com'] },
  { name: 'LinkedIn Insight', category: 'Ads', domains: ['snap.licdn.com', 'px.ads.linkedin.com'] },
  { name: 'Criteo', category: 'Ads', domains: ['static.criteo.net', 'criteo.com'] },
  { name: 'Amazon Ads', category: 'Ads', domains: ['amazon-adsystem.com'] },
  { name: 'Mixpanel', category: 'Analytics', domains: ['cdn.mxpnl.com', 'api.mixpanel.com', 'api-js.mixpanel.com'] },
  { name: 'Amplitude', category: 'Analytics', domains: ['cdn.amplitude.com', 'api.amplitude.com', 'api2.amplitude.com'] },
  { name: 'Segment', category: 'Analytics', domains: ['cdn.segment.com', 'api.segment.io'] },
  { name: 'PostHog', category: 'Analytics', domains: ['posthog.com/static', 'us.i.posthog.com', 'eu.i.posthog.com', 'app.posthog.com'] },
  { name: 'Heap', category: 'Analytics', domains: ['cdn.heapanalytics.com', 'heapanalytics.com'] },
  { name: 'Plausible', category: 'Analytics', domains: ['plausible.io/js'] },
  { name: 'Fathom', category: 'Analytics', domains: ['cdn.usefathom.com'] },
  { name: 'Matomo', category: 'Analytics', domains: ['matomo.js', 'matomo.php', 'cdn.matomo.cloud'] },
  { name: 'Hotjar', category: 'Session Replay', domains: ['static.hotjar.com', 'script.hotjar.com'] },
  { name: 'FullStory', category: 'Session Replay', domains: ['fullstory.com/s/fs.js', 'edge.fullstory.com'] },
  { name: 'Microsoft Clarity', category: 'Session Replay', domains: ['clarity.ms'] },
  { name: 'LogRocket', category: 'Session Replay', domains: ['cdn.logrocket.io', 'cdn.logrocket.com', 'cdn.lr-ingest.io'] },
  { name: 'Datadog RUM', category: 'Session Replay', domains: ['datadoghq-browser-agent.com', 'browser-intake-datadoghq.com'] },
  { name: 'Sentry', category: 'Errors', domains: ['browser.sentry-cdn.com', 'js.sentry-cdn.com', 'ingest.sentry.io', 'ingest.us.sentry.io', 'ingest.de.sentry.io'] },
  { name: 'Bugsnag', category: 'Errors', domains: ['d2wy8f7a9ursnm.cloudfront.net', 'sessions.bugsnag.com'] },
  { name: 'New Relic', category: 'Errors', domains: ['js-agent.newrelic.com', 'bam.nr-data.net'] },
  { name: 'HubSpot', category: 'Marketing', domains: ['js.hs-scripts.com', 'js.hs-analytics.net', 'track.hubspot.com'] },
  { name: 'Intercom', category: 'Marketing', domains: ['widget.intercom.io', 'js.intercomcdn.com'] },
  { name: 'Klaviyo', category: 'Marketing', domains: ['static.klaviyo.com'] },
  { name: 'Braze', category: 'Marketing', domains: ['js.appboycdn.com', 'sdk.iad-01.braze.com'] },
  { name: 'Adobe Analytics', category: 'Analytics', domains: ['omtrdc.net', 'demdex.net', 'assets.adobedtm.com'] },
  { name: 'Cloudflare Insights', category: 'Analytics', domains: ['static.cloudflareinsights.com'] },
  { name: 'Vercel Analytics', category: 'Analytics', domains: ['va.vercel-scripts.com', '/_vercel/insights'] },
]

export interface FoundTracker {
  name: string
  category: TrackerSignature['category']
  evidence: string
}

/** Match loaded resource URLs against the signature list, one hit per tracker. */
export function findTrackers(urls: string[]): FoundTracker[] {
  const found: FoundTracker[] = []
  for (const sig of TRACKER_SIGNATURES) {
    const hit = urls.find((u) => sig.domains.some((d) => u.includes(d)))
    if (hit) {
      let evidence: string
      try {
        evidence = new URL(hit).hostname
      } catch {
        evidence = hit.slice(0, 60)
      }
      found.push({ name: sig.name, category: sig.category, evidence })
    }
  }
  return found
}
