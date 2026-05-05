import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Mock Server",
  description: "Public remote MCP mock server for auth and tool-call testing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
