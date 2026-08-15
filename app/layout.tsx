import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stash",
  description: "Your model kit pile, on your phone.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Stash", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E4E2DB" },
    { media: "(prefers-color-scheme: dark)", color: "#14171C" },
  ],
};

// Runs before first paint so the page never flashes the wrong theme, and so
// the browser is never free to invent its own dark mode for us.
const THEME_BOOT = `try{
  var t=localStorage.getItem("stash-theme");
  if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","light")}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Loaded as a plain stylesheet, not next/font, so that an unreachable
            font service can never fail the build. Fallbacks are in globals.css. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
