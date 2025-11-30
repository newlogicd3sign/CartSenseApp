import Image from "next/image";
import Link from "next/link";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { ShoppingCart, Sparkles, Clock, ListChecks } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8fafb] flex flex-col">
      {/* Header */}
      <header className="px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Image src={CartSenseLogo} alt="CartSense" className="h-10 w-auto" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 text-[#4A90E2] font-medium hover:bg-[#4A90E2]/5 rounded-xl transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-shadow"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 px-6">
        <div className="max-w-6xl mx-auto pt-16 lg:pt-24 pb-16">
          {/* Hero Content */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A90E2]/10 text-[#4A90E2] rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Meal Planning
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Smart Meal Planning,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4A90E2] to-[#357ABD]">
                Effortless Shopping
              </span>
            </h1>
            <p className="text-lg lg:text-xl text-gray-600 mb-8">
              Tell us what you want to eat, and CartSense creates personalized meal plans
              with instant shopping lists. Save time, reduce waste, and eat better.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white font-medium rounded-2xl shadow-lg hover:shadow-xl transition-shadow text-center"
              >
                Get Started Free
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 font-medium rounded-2xl hover:border-[#4A90E2] hover:text-[#4A90E2] transition-colors text-center"
              >
                I Have an Account
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-[#4A90E2]/10 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-[#4A90E2]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered</h3>
              <p className="text-gray-600">
                Describe your cravings and let AI create the perfect meal plan tailored to you.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-[#10B981]/10 rounded-xl flex items-center justify-center mb-4">
                <ListChecks className="w-6 h-6 text-[#10B981]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Lists</h3>
              <p className="text-gray-600">
                Automatically generate organized shopping lists from your meal plans.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-[#F59E0B]/10 rounded-xl flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Save Time</h3>
              <p className="text-gray-600">
                Stop wasting time on meal decisions and grocery planning every week.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-gray-200">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © 2024 CartSense. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/terms" className="text-gray-500 hover:text-[#4A90E2] transition-colors">
              Terms
            </Link>
            <Link href="/privacy-policy" className="text-gray-500 hover:text-[#4A90E2] transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}