import type { Metadata } from "next";

import "@/app/globals.css";
import { PwaRegistrar } from "@/components/shared/pwa-registrar";

export const metadata: Metadata = {
  title: "CrisisConnect",
  description: "Unified disaster management and community resilience platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
