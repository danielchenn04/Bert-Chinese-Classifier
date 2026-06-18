import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dialect Geolocator — Chinese Regional Dialect Classifier",
  description:
    "A fine-tuned BERT model classifies Chinese text by regional dialect, then an LLM explains the linguistic reasoning. Built with HuggingFace Transformers, LangChain, FastAPI, and GPT-4o-mini.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
