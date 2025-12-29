import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#f8fafb] flex flex-col items-center justify-center p-4">
            <div className="text-center max-w-md">
                <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/CartSenseLogo.svg"
                        alt="CartSense"
                        className="w-12 h-12 opacity-50"
                    />
                </div>

                <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                    Page not found
                </h1>

                <p className="text-gray-500 mb-8">
                    Sorry, this page seems to be off the menu. We couldn't find the page you were looking for.
                </p>

                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
