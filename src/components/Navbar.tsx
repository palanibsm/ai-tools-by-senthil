import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          AI Tools by Senthil
        </Link>
        <nav className="text-sm text-slate-600">
          <Link className="hover:text-slate-900" href="/">
            Home
          </Link>
        </nav>
      </div>
    </header>
  );
}
