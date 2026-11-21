import * as React from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string
        partition?: string
        allowpopups?: boolean
        style?: React.CSSProperties
      }, HTMLElement>
    }
  }
}

function buildThemeCSS(isDark: boolean): string {
  const v = isDark ? {
    bg: '#0a0a0a', bgCard: '#171717', bgInput: '#262626',
    text: '#fafafa', textMuted: '#a3a3a3', border: 'rgba(255,255,255,0.1)',
    primary: '#e5e5e5', primaryFg: '#171717', accent: '#262626',
    link: '#60a5fa', hover: '#1f1f1f',
  } : {
    bg: '#ffffff', bgCard: '#f9fafb', bgInput: '#ffffff',
    text: '#0a0a0a', textMuted: '#6b7280', border: '#e5e7eb',
    primary: '#171717', primaryFg: '#ffffff', accent: '#f3f4f6',
    link: '#2563eb', hover: '#f3f4f6',
  }

  return `
    * { background-color: transparent !important; color: inherit !important; border-color: ${v.border} !important; }
    html, body { background-color: ${v.bg} !important; color: ${v.text} !important; font-family: ui-sans-serif, system-ui, sans-serif !important; }
    
    /* Re-apply some necessary background colors */
    .navbar, .navbar-default, nav.navbar, .navbar-inverse { background-color: ${v.bgCard} !important; border-bottom: 1px solid ${v.border} !important; box-shadow: none !important; }
    .panel, .panel-default, .card, .well, .box, .email-box, #emailBox, #inboxBox, .inbox-box { background-color: ${v.bgCard} !important; border-radius: 8px !important; }
    input, select, textarea, .form-control, #email, .email-address, .temp-email, input[readonly], .emailField, #emailAddressField { background-color: ${v.bgInput} !important; color: ${v.text} !important; border: 1px solid ${v.border} !important; border-radius: 6px !important; }
    .btn-primary, .btn-success, .primary { background-color: ${v.primary} !important; color: ${v.primaryFg} !important; border: none !important; }
    .btn-default, .btn-secondary, .btn-orange { background-color: ${v.accent} !important; color: ${v.text} !important; border: 1px solid ${v.border} !important; }
    table, .table { background-color: ${v.bgCard} !important; color: ${v.text} !important; }
    .table>thead>tr>th { background-color: ${v.bgCard} !important; color: ${v.textMuted} !important; border-bottom: 1px solid ${v.border} !important; }
    .table-striped>tbody>tr:nth-of-type(odd)>td { background-color: ${isDark ? '#111111' : '#f9fafb'} !important; }
    #emailContent, .email-content, .message-body, .mail-body { background-color: ${v.bgCard} !important; padding: 16px !important; border-radius: 8px !important; }
    
    a { color: ${v.link} !important; }
    h1, h2, h3, h4, h5, h6 { color: ${v.text} !important; }
    p, .text-muted { color: ${v.textMuted} !important; }
    
    ::-webkit-scrollbar { width:6px; height:6px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:${v.border}; border-radius:3px; }
    
    /* Hide ads, popups, overlays */
    .ad,.ads,.adsbygoogle,[class*="banner"],[id*="banner"],[class*="advert"],[id*="advert"],
    [class*="popup"],[id*="popup"],[class*="overlay"]:not(.modal-backdrop),
    [class*="modal"]:not(.modal):not(.modal-dialog):not(.modal-content):not(.modal-header):not(.modal-body):not(.modal-footer),
    .cookie-notice,.cookie-banner,.gdpr,[class*="cookie"],[id*="cookie"],
    .notification-bar,.alert-bar,[class*="promo"],[id*="promo"] { display:none!important; }
  `
}

interface DisposableMailProps {
  isDark: boolean
}

export function DisposableMail({ isDark }: DisposableMailProps) {
  const webviewRef = React.useRef<HTMLElement>(null)
  const [loading, setLoading] = React.useState(true)
  const isDarkRef = React.useRef(isDark)
  isDarkRef.current = isDark

  const injectStyles = React.useCallback(() => {
    const wv = webviewRef.current as any
    if (!wv) return
    const css = buildThemeCSS(isDarkRef.current)
    // Method 1: insertCSS (Electron webview API)
    if (wv.insertCSS) {
      wv.insertCSS(css).catch(() => {})
    }
    // Method 2: executeJavaScript to inject a <style> tag (more reliable)
    if (wv.executeJavaScript) {
      const escaped = css.replace(/`/g, '\\`').replace(/\$/g, '\\$')
      wv.executeJavaScript(`
        (function() {
          var existing = document.getElementById('__mail-app-theme__');
          if (existing) existing.remove();
          var s = document.createElement('style');
          s.id = '__mail-app-theme__';
          s.textContent = \`${escaped}\`;
          document.head.appendChild(s);
          // Also remove ad elements
          var adSelectors = [
            'iframe:not([src*="disposablemail"])',
            '[id*="google_ads"]','[class*="google-ad"]',
            '.adsbygoogle','[data-ad-slot]'
          ];
          adSelectors.forEach(function(sel) {
            document.querySelectorAll(sel).forEach(function(el) { el.remove(); });
          });
        })()
      `).catch(() => {})
    }
  }, [])

  React.useEffect(() => {
    const wv = webviewRef.current as any
    if (!wv) return

    const onDomReady = () => {
      setLoading(false)
      injectStyles()
    }
    const onStart = () => setLoading(true)
    // dom-ready fires when DOM is parsed — best time to inject CSS
    wv.addEventListener?.('dom-ready', onDomReady)
    wv.addEventListener?.('did-start-loading', onStart)
    // Also inject on did-finish-load for dynamic content
    wv.addEventListener?.('did-finish-load', injectStyles)

    return () => {
      wv.removeEventListener?.('dom-ready', onDomReady)
      wv.removeEventListener?.('did-start-loading', onStart)
      wv.removeEventListener?.('did-finish-load', injectStyles)
    }
  }, [injectStyles])

  // Re-inject when theme toggles
  React.useEffect(() => {
    if (!loading) injectStyles()
  }, [isDark, loading, injectStyles])

  const reload = () => (webviewRef.current as any)?.reload?.()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b px-4">
        <h1 className="text-xl font-bold">Disposable Mail</h1>
        <span className="text-sm text-muted-foreground hidden sm:block">via disposablemail.com</span>
        <div className="ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reload}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex-1 overflow-hidden">
        <webview
          ref={webviewRef as any}
          src="https://www.disposablemail.com"
          partition="persist:disposablemail"
          allowpopups={false}
          style={{ width: '100%', height: '100%', display: 'flex' }}
        />
      </div>
    </div>
  )
}
