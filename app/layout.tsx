import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';

// export const metadata: Metadata = {
//   metadataBase: new URL('https://chat.vercel.ai'),
//   title: 'Next.js Chatbot Template',
//   description: 'Next.js chatbot template using the AI SDK.',
// };

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)';
const DARK_THEME_COLOR = 'hsl(240deg 10% 3.92%)';
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

const MENDIX_EXTENSION_SCRIPT = `
function sendMessage(message, data) {
    if (window.chrome?.webview) {
        window.chrome.webview.postMessage({ message, data })
    } else if (window.webkit?.messageHandlers.studioPro) {
        window.webkit.messageHandlers.studioPro.postMessage(JSON.stringify({ message, data }))
    }
}
function registerMessageListener(eventHandler) {
    if (window.chrome?.webview) {
        window.chrome.webview.addEventListener("message", (event) => eventHandler(event.data))
        sendMessage("MessageListenerRegistered")
    } else if (window.webkit?.messageHandlers.studioPro) {
        window.WKPostMessage = (json) => {
            const wkMessage = JSON.parse(json)
            eventHandler(wkMessage)
        }
        sendMessage("MessageListenerRegistered")
    }
}
function init() {
    registerMessageListener(msgHandler);
}
function msgHandler(event) {
    console.log('message sent to JS: '+event.data);
}
function create() {
    sendMessage('entity', {a:1});
}
document.onload = init;
`

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: MENDIX_EXTENSION_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster position="top-center" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
