import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">🔍</span>
                </div>
                <h2 className="text-2xl font-bold text-zinc-100 mb-2">Page Not Found</h2>
                <p className="text-zinc-400 mb-6">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link
                    href="/"
                    className="inline-block px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white font-medium rounded-lg transition-colors"
                >
                    Go Home
                </Link>
            </div>
        </div>
    );
}
