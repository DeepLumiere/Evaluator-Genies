import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evalboard — AI evaluation cards",
  description: "A clear, curated view of AI model evaluation results.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
