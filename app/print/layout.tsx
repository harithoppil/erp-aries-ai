import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Print',
};

// Print layout has no app chrome — it's used directly in the browser when a
// user clicks "Print PDF" and by Puppeteer when generating PDFs.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-white text-black print:bg-white">{children}</div>;
}
