import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="font-display text-8xl font-black text-scoop">404</p>
      <h1 className="mt-2 font-display text-3xl font-black">Esta notícia não existe (ou ainda não saiu)</h1>
      <Link href="/" className="mt-6 inline-block font-semibold underline hover:text-scoop">Voltar à primeira página</Link>
    </div>
  );
}
