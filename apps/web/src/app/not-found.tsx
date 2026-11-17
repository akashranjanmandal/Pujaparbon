import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="font-mono text-[64px] font-medium tracking-tight text-sindoor">404</div>
      <h1 className="mt-2 text-[22px] font-semibold">Route not found</h1>
      <p className="mt-1 text-[15px] text-muted">The page you are looking for does not exist or was moved.</p>
      <Link href="/dashboard" className="mt-6 text-[15px] font-medium underline underline-offset-4">Back to Command Center</Link>
    </main>
  );
}
