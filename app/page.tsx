import Image from "next/image";
import Link from "next/link";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import {
  ShoppingCart,
  Target,
  Users,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Store,
  MapPin,
  List,
  Check,
  Clock,
  Utensils,
  Wallet,
  Baby,
  User,
  Sparkles,
  Heart,
  Flame,
  Beef,
  Wheat,
  Droplet,
  ChefHat,
  UserPlus,
  Ban,
  Leaf
} from "lucide-react";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CartSense",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web",
  description: "AI-powered meal planning app that generates personalized recipes and adds ingredients directly to your Kroger cart.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available with 10 meal prompts per month",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "150",
  },
  featureList: [
    "AI-generated personalized meals",
    "Automatic grocery list creation",
    "Kroger cart integration",
    "Diet restriction support",
    "Family meal planning",
  ],
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8fafb] flex flex-col overflow-x-hidden">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 sticky top-0 bg-[#f8fafb]/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <Image src={CartSenseLogo} alt="CartSense - AI Meal Planning and Grocery Shopping" className="h-7 sm:h-10 w-auto flex-shrink-0" />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#how-it-works" className="hover:text-[#4A90E2] transition-colors">How It Works</a>
            <a href="#features" className="hover:text-[#4A90E2] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#4A90E2] transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <Link
              href="/login"
              className="px-2 sm:px-5 py-1.5 sm:py-2.5 text-[#4A90E2] font-medium hover:bg-[#4A90E2]/5 rounded-lg sm:rounded-xl transition-colors text-xs sm:text-base"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-2.5 sm:px-5 py-1.5 sm:py-2.5 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white font-medium rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition-shadow text-xs sm:text-base whitespace-nowrap"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 pt-12 sm:pt-16 lg:pt-20 pb-12 sm:pb-16 relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#4A90E2]/10 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#357ABD]/10 rounded-full blur-3xl -z-10" />

          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start lg:pt-4">
              {/* Left: Text Content */}
              <div className="text-center lg:text-left">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
                  Meals planned. Groceries added.{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4A90E2] to-[#357ABD]">
                    Done.
                  </span>
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-4 sm:mb-6 max-w-xl mx-auto lg:mx-0">
                  Tell us what you&apos;re craving. CartSense creates personalized meals based on your preferences, finds the exact products at your local grocery store, and adds everything to your cart — ready for you to checkout.
                </p>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 mb-6 sm:mb-8">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs sm:text-sm text-gray-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    Personalized to your tastes
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs sm:text-sm text-gray-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    Real store prices
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs sm:text-sm text-gray-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    One-click to cart
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-sm sm:text-base"
                  >
                    Try CartSense Free
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Link>
                  <span className="text-sm text-gray-500">No credit card required</span>
                </div>
              </div>

              {/* Right: App Preview (visible on all screens, below text on mobile) */}
              <div className="relative max-w-sm mx-auto lg:max-w-none lg:mx-0">
                <div className="bg-gradient-to-br from-[#4A90E2]/20 to-[#357ABD]/20 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl">
                  {/* Phone Frame */}
                  <div className="bg-[#f8fafb] rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-white border-b border-gray-100 px-3 sm:px-4 py-2 sm:py-3">
                      <p className="text-sm sm:text-base font-medium text-gray-900">Your Meal Suggestions</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                        Based on: <span className="text-gray-700">Easy weeknight dinners</span>
                      </p>
                    </div>

                    {/* Meal Cards - matching MealCard component */}
                    <div className="p-2 sm:p-3 space-y-2">
                      {[
                        { name: "Honey Garlic Chicken", type: "dinner", desc: "Tender chicken in a savory-sweet glaze", cal: 420, protein: 38, carbs: 18, fat: 14, img: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=120&h=120&fit=crop" },
                        { name: "Greek Chicken Bowl", type: "lunch", desc: "Fresh Mediterranean flavors with feta", cal: 385, protein: 42, carbs: 24, fat: 12, img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=120&h=120&fit=crop" },
                        { name: "Lemon Herb Salmon", type: "dinner", desc: "Flaky salmon with bright citrus notes", cal: 380, protein: 35, carbs: 8, fat: 22, img: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=120&h=120&fit=crop" },
                      ].map((meal, i) => (
                        <div key={i} className="bg-white rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-sm border border-gray-100 flex gap-2 sm:gap-3">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={meal.img} alt={meal.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="px-1 sm:px-1.5 py-0.5 bg-gray-100 rounded text-[8px] sm:text-[9px] font-medium text-gray-600 capitalize">
                                {meal.type}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{meal.name}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-500 truncate">{meal.desc}</p>
                            {/* Macros row */}
                            <div className="flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[9px] text-gray-500 mt-1">
                              <span className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500" />
                                {meal.cal}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500" />
                                {meal.protein}g
                              </span>
                              <span className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500" />
                                {meal.carbs}g
                              </span>
                              <span className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500" />
                                {meal.fat}g
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add to Cart */}
                    <div className="p-2 sm:p-3 bg-white border-t border-gray-100">
                      <div className="bg-[#0056a3] text-white rounded-lg sm:rounded-xl py-2 sm:py-2.5 px-3 sm:px-4 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium">
                        <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Add All to Kroger Cart
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -bottom-2 left-2 sm:-bottom-4 sm:-left-4 bg-white rounded-xl shadow-lg px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs font-medium text-gray-900">12 items added</p>
                      <p className="text-[8px] sm:text-[10px] text-gray-500">to your Kroger cart</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 text-center">
              Food decisions are exhausting
            </h2>
            <p className="text-base sm:text-lg text-gray-500 text-center mb-8 sm:mb-10">
              And they happen every. single. day.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">
              {/* The Loop */}
              <div className="bg-gray-50 rounded-2xl p-5 sm:p-6">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">5:47 PM. Again.</p>
                <div className="space-y-2.5 text-gray-600 text-sm sm:text-base">
                  <p>&quot;What do you want for dinner?&quot;</p>
                  <p>&quot;I don&apos;t know. What do <span className="italic">you</span> want?&quot;</p>
                  <p>&quot;I asked you first.&quot;</p>
                  <p className="text-gray-400">...</p>
                  <p className="text-gray-500 italic">Orders DoorDash. Again.</p>
                </div>
              </div>

              {/* The Mental Load */}
              <div className="bg-gray-50 rounded-2xl p-5 sm:p-6">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">The invisible work</p>
                <div className="space-y-2.5 text-gray-600 text-sm sm:text-base">
                  <p>Remembering who doesn&apos;t eat what.</p>
                  <p>Checking what&apos;s already in the fridge.</p>
                  <p>Finding a recipe everyone will eat.</p>
                  <p>Making a list. Forgetting the list.</p>
                  <p className="text-gray-500 italic">Repeat tomorrow.</p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-base sm:text-lg text-gray-900 font-medium mb-2">
                Three times a day. Every day. It adds up.
              </p>
              <p className="text-gray-600">
                CartSense takes the whole thing off your plate.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="px-4 sm:px-6 py-12 sm:py-20 bg-[#f8fafb]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 text-center">
              Four steps. Zero stress.
            </h2>
            <p className="text-base sm:text-lg text-gray-600 text-center mb-8 sm:mb-12">
              From &quot;what&apos;s for dinner?&quot; to groceries in your cart.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 mb-10 sm:mb-12">
              {/* Step 1 */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#4A90E2] rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl mb-4">
                  1
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  Tell us what you&apos;re craving
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Type anything — &quot;easy dinners,&quot; &quot;budget meals,&quot; or &quot;meal prep.&quot;
                </p>
                {/* Mini mockup */}
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <div className="bg-white rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] text-gray-500">
                    &quot;Quick chicken dinners&quot;
                  </div>
                  <div className="mt-2 flex justify-end">
                    <div className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white text-[9px] px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Generate
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#4A90E2] rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl mb-4">
                  2
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  Get personalized meals
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Complete with ingredients + cooking steps.
                </p>
                {/* Mini mockup - meal cards */}
                <div className="bg-gray-50 rounded-xl p-2 space-y-1.5">
                  {["Honey Garlic Chicken", "Greek Power Bowl"].map((meal, i) => (
                    <div key={i} className="bg-white rounded-lg p-2 flex items-center gap-2 border border-gray-100">
                      <div className="w-7 h-7 rounded bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                        <Utensils className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 truncate">{meal}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3 - AI Chat */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#4A90E2] rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl mb-4">
                  3
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  Tweak it with AI
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  &quot;Make it dairy-free&quot; or &quot;swap the chicken&quot; — done instantly.
                </p>
                {/* Mini mockup - chat */}
                <div className="bg-gray-50 rounded-xl p-2.5 space-y-2">
                  <div className="flex justify-end">
                    <div className="bg-[#4A90E2] text-white text-[10px] px-2.5 py-1.5 rounded-xl rounded-br-sm max-w-[85%]">
                      Make this dairy-free
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 text-[10px] text-gray-700 px-2.5 py-1.5 rounded-xl rounded-bl-sm max-w-[85%]">
                      Done! Swapped butter for olive oil.
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#4A90E2] rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl mb-4">
                  4
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  Add to your cart
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Real products, real prices, real availability.
                </p>
                {/* Mini mockup - shopping list */}
                <div className="bg-gray-50 rounded-xl p-2">
                  <div className="space-y-1 mb-2">
                    {["Chicken Breast", "Olive Oil"].map((item, i) => (
                      <div key={i} className="bg-white rounded-lg px-2 py-1 flex items-center justify-between border border-gray-100">
                        <span className="text-[10px] text-gray-700">{item}</span>
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#0056a3] text-white text-[9px] py-1.5 rounded-lg flex items-center justify-center gap-1">
                    <ShoppingCart className="w-2.5 h-2.5" />
                    Add to Kroger
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-sm sm:text-base"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                Finally, meal planning that actually plans.
              </h2>
              <p className="text-base sm:text-lg text-gray-600">
                Most apps stop at recipes.<br />
                <span className="font-semibold text-gray-900">CartSense goes all the way to your cart.</span>
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Left: Comparison Cards */}
              <div className="space-y-4 sm:space-y-6">
                {/* Other Apps */}
                <div className="bg-gray-50 rounded-2xl p-5 sm:p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-500 mb-4">Other Apps</h3>
                  <ul className="space-y-3">
                    {[
                      "Give you recipe ideas",
                      "Leave you to figure out ingredients",
                      "No connection to real stores",
                      "Still feels like work",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-600 text-sm sm:text-base">
                        <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CartSense */}
                <div className="bg-green-50 rounded-2xl p-5 sm:p-6 border border-green-200">
                  <h3 className="text-lg font-semibold text-green-700 mb-4">CartSense</h3>
                  <ul className="space-y-3">
                    {[
                      "Generates meals you'll love",
                      "Matches ingredients to real products",
                      "Adds everything to your grocery cart",
                      "Actually saves you time",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-700 text-sm sm:text-base">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="text-center lg:text-left pt-2">
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 text-[#4A90E2] font-semibold hover:underline text-sm sm:text-base"
                  >
                    Get your time back
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Right: Recipe Detail Mockup - Matching App UI */}
              <div className="relative bg-[#f8fafb] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl">
                {/* Hero Card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex gap-3 sm:gap-4 mb-3">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=200&h=200&fit=crop"
                      alt="Honey Garlic Chicken"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-[8px] sm:text-[10px] font-medium text-gray-600 capitalize mb-1">
                      dinner
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-gray-900">Honey Garlic Chicken</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 line-clamp-2">Tender chicken in a savory-sweet glaze</p>
                  </div>
                </div>

                {/* Macros Card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 mb-3">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-1">
                        <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-gray-900">420</div>
                      <div className="text-[8px] sm:text-[10px] text-gray-500">kcal</div>
                    </div>
                    <div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-1">
                        <Beef className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-gray-900">38g</div>
                      <div className="text-[8px] sm:text-[10px] text-gray-500">Protein</div>
                    </div>
                    <div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-1">
                        <Wheat className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-gray-900">18g</div>
                      <div className="text-[8px] sm:text-[10px] text-gray-500">Carbs</div>
                    </div>
                    <div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-1">
                        <Droplet className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-gray-900">14g</div>
                      <div className="text-[8px] sm:text-[10px] text-gray-500">Fat</div>
                    </div>
                  </div>
                </div>

                {/* Ingredients Card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <List className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-900">Ingredients</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      "2 chicken breasts",
                      "3 tbsp honey",
                      "4 cloves garlic",
                      "2 tbsp soy sauce",
                      "1 tbsp olive oil",
                      "2 green onions",
                    ].map((ing, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span className="text-[10px] sm:text-xs text-gray-600 truncate">{ing}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cooking Steps Card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <ChefHat className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-900">Cooking Steps</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      "Season chicken with salt and pepper",
                      "Sear in olive oil until golden",
                      "Mix honey, garlic, and soy sauce",
                    ].map((step, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="w-5 h-5 bg-[#4A90E2]/10 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-medium text-[#4A90E2]">
                          {i + 1}
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-600 pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white text-xs sm:text-sm font-medium rounded-xl flex items-center justify-center gap-2">
                    <List className="w-4 h-4" />
                    Add to Shopping List
                  </button>
                  <button className="w-full py-2.5 sm:py-3 bg-[#0056a3] text-white text-xs sm:text-sm font-medium rounded-xl flex items-center justify-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Add to Kroger Cart
                  </button>
                </div>

                {/* Floating badge */}
                <div className="absolute -bottom-3 -right-2 sm:-bottom-4 sm:-right-4 bg-white rounded-xl shadow-lg px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs font-medium text-gray-900">12 items added</p>
                      <p className="text-[8px] sm:text-[10px] text-gray-500">to your Kroger cart</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-4 sm:px-6 py-12 sm:py-20 bg-gradient-to-br from-[#4A90E2]/5 to-[#357ABD]/5">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 text-center">
              Less thinking. More eating.
            </h2>
            <p className="text-base sm:text-lg text-gray-600 text-center mb-8 sm:mb-12">
              Meals planned. Groceries added. Done.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <div className="bg-gray-50 rounded-2xl p-5 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#4A90E2]/10 rounded-xl flex items-center justify-center mb-4">
                  <Target className="w-5 h-5 sm:w-6 sm:h-6 text-[#4A90E2]" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Knows what you like</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Set your preferences once. Get meals you&apos;ll actually want to eat.
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#8B5CF6]" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Works for everyone</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Multiple people, different tastes? One list that keeps everyone happy.
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#F59E0B]/10 rounded-xl flex items-center justify-center mb-4">
                  <List className="w-5 h-5 sm:w-6 sm:h-6 text-[#F59E0B]" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">No list-making</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Ingredients go straight to your cart. Nothing to write down or forget.
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#EC4899]/10 rounded-xl flex items-center justify-center mb-4">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-[#EC4899]" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Change anything instantly</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  &quot;Make it faster.&quot; &quot;Swap the chicken.&quot; Done in seconds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Diet Scanner Section */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-[#f8fafb]">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Content - shows first on mobile, second on desktop */}
              <div className="lg:order-last">
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-500/10 text-amber-600 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  Optional Superpower
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                  Got food rules? We&apos;ll handle them.
                </h2>
                <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
                  If you have allergy notes, nutrition guidelines, or specific restrictions — just upload them. CartSense reads them once and remembers forever. You get meals that fit, without the mental load.
                </p>

                <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  {[
                    "Snap a photo or upload a PDF",
                    "AI extracts allergies and restrictions",
                    "Every meal automatically respects them",
                    "One less thing to think about",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm sm:text-base text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-gray-500">
                  Don&apos;t have restrictions? Skip it entirely — CartSense works great without it.
                </p>
              </div>

              {/* Mockup - shows second on mobile, first on desktop */}
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 sm:px-5 py-3 sm:py-4">
                  <p className="font-medium text-sm sm:text-base" style={{ color: 'white' }}>Food Preferences</p>
                  <p className="text-xs sm:text-sm" style={{ color: 'white' }}>Scanned from your photo</p>
                </div>

                {/* Scanned Content */}
                <div className="p-4 sm:p-5">
                  <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Detected from: diet_plan.pdf</p>
                    <p className="text-sm text-gray-600 italic">&quot;Avoid gluten, dairy, and high-sodium foods. Focus on lean proteins and vegetables. Limit sugar to under 25g/day.&quot;</p>
                  </div>

                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Extracted restrictions</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {["Gluten-free", "Dairy-free", "Low sodium", "Low sugar"].map((tag) => (
                      <span key={tag} className="px-2.5 py-1 bg-red-500/10 text-red-500 text-xs font-medium rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Applied to all future meals</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Grocery Integration */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-[#4A90E2]/5">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left: Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#4A90E2]/10 text-[#4A90E2] rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
                  The Missing Link
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                  Meals become groceries. Automatically.
                </h2>
                <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
                  No copying ingredients. No wandering the store. CartSense matches every item to real products at your local grocery store and adds them to your cart.
                </p>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                  {[
                    "Real-time prices",
                    "Aisle locations",
                    "Stock availability",
                    "Easy product swaps",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm sm:text-base text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>

                <p className="text-sm sm:text-base text-gray-500 mb-3">
                  Works with 20+ grocery stores
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["Kroger", "Ralphs", "King Soopers", "Smiths", "Fry's", "Fred Meyer", "Harris Teeter", "QFC"].map((store) => (
                    <span
                      key={store}
                      className="px-2.5 sm:px-3 py-1 bg-white border border-gray-200 rounded-full text-xs sm:text-sm text-gray-700 font-medium"
                    >
                      {store}
                    </span>
                  ))}
                  <span className="px-2.5 sm:px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-xs sm:text-sm text-gray-500 font-medium">
                    & more
                  </span>
                </div>

                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 text-[#4A90E2] font-semibold hover:underline text-sm sm:text-base"
                >
                  Add everything with one click
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Right: Shopping List Mockup */}
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
                {/* App Header */}
                <div className="bg-white px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#4A90E2]/10 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <List className="w-4 h-4 sm:w-5 sm:h-5 text-[#4A90E2]" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-medium text-gray-900">Shopping List</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">4 items</p>
                    </div>
                  </div>
                </div>

                {/* Shopping List Items */}
                <div className="divide-y divide-gray-50">
                  {[
                    { name: "Chicken Breast", price: 8.99, aisle: "Meat", qty: 2, img: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=100&h=100&fit=crop" },
                    { name: "Brown Rice", price: 3.49, aisle: "Aisle 7", qty: 1, img: null },
                    { name: "Broccoli", price: 2.99, aisle: "Produce", qty: 2, img: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=100&h=100&fit=crop" },
                  ].map((item, i) => (
                    <div key={i} className="px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-3">
                      {item.img ? (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-amber-50 flex-shrink-0 flex items-center justify-center">
                          <span className="text-amber-600 text-lg">🌾</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm sm:text-base">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            {item.aisle}
                          </span>
                          <span className="text-[10px] sm:text-xs text-gray-400">·</span>
                          <span className="text-[10px] sm:text-xs text-gray-500">Qty: {item.qty}</span>
                        </div>
                      </div>
                      <span className="text-sm sm:text-base font-semibold text-[#4A90E2]">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Add to Cart Button */}
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50">
                  <button className="w-full py-2.5 sm:py-3 bg-[#0056a3] text-white font-medium rounded-xl text-sm sm:text-base flex items-center justify-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Add All to Kroger Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Household Members Section */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Mockup - shows second on mobile, first on desktop */}
              <div className="lg:order-first order-last bg-[#f8fafb] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#8B5CF6]" />
                    <span className="font-medium text-gray-900 text-sm sm:text-base">Household Members</span>
                  </div>
                  <button className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#8B5CF6] text-white text-xs sm:text-sm font-medium rounded-lg">
                    <UserPlus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>

                {/* Member Cards */}
                <div className="space-y-3">
                  {[
                    { name: "Mom", avatar: "M", color: "bg-pink-500", restrictions: ["Gluten-free", "Low sodium"] },
                    { name: "Dad", avatar: "D", color: "bg-blue-500", restrictions: ["Dairy-free"] },
                    { name: "Emma", avatar: "E", color: "bg-purple-500", restrictions: ["Nut allergy", "Vegetarian"] },
                    { name: "Jake", avatar: "J", color: "bg-green-500", restrictions: ["No restrictions"] },
                  ].map((member, i) => (
                    <div key={i} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${member.color} rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base`}>
                          {member.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm sm:text-base">{member.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {member.restrictions.map((r, j) => (
                              <span
                                key={j}
                                className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                                  r === "No restrictions"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-50 text-red-600"
                                }`}
                              >
                                {r === "No restrictions" ? (
                                  <span className="flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" />
                                    {r}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Ban className="w-2.5 h-2.5" />
                                    {r}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-[#8B5CF6]/10 to-[#4A90E2]/10 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Leaf className="w-4 h-4 text-[#8B5CF6]" />
                    <span>Meals automatically respect <strong>all</strong> household restrictions</span>
                  </div>
                </div>
              </div>

              {/* Right: Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                  Household Profiles
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                  Everyone eats. No one argues.
                </h2>
                <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
                  Different tastes, allergies, and preferences? Add up to 5 household members. CartSense remembers what everyone can eat — so you don&apos;t have to.
                </p>

                <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  {[
                    "Create a profile for each person",
                    "Set preferences once, never think about it again",
                    "Every meal works for everyone",
                    "One shopping list, no coordination needed",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm sm:text-base text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-gray-500 mb-4">
                  Available on Family plan
                </p>

                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 text-[#8B5CF6] font-semibold hover:underline text-sm sm:text-base"
                >
                  Try Family plan free
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Who's It For Section */}
        <section className="px-4 sm:px-6 py-12 sm:py-20 bg-[#f8fafb]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 text-center">
              For anyone who wants meals handled.
            </h2>
            <p className="text-base sm:text-lg text-gray-600 text-center mb-8 sm:mb-12">
              Meals planned. Groceries added. Done.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[
                { icon: Baby, title: "Busy parents", desc: "No time to plan, no energy to decide. CartSense handles it." },
                { icon: Users, title: "Couples", desc: "End the \"what do you want?\" \"I don't know, what do you want?\" loop." },
                { icon: User, title: "Solo cooks", desc: "Escape the same 3 meals on rotation. Discover new favorites." },
                { icon: Clock, title: "Meal preppers", desc: "Plan your week in minutes. Groceries ready when you are." },
                { icon: Wallet, title: "Budget-conscious", desc: "See real prices before you buy. No surprises at checkout." },
                { icon: Utensils, title: "Picky households", desc: "Different preferences, one organized list. Everyone wins." },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100">
                  <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-xl flex items-center justify-center mb-3">
                    <item.icon className="w-5 h-5 text-[#4A90E2]" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1.5">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="px-4 sm:px-6 py-12 sm:py-20 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
                Try it free. Keep it if you love it.
              </h2>
              <p className="text-base sm:text-lg text-gray-600">
                No credit card needed. Cancel anytime.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
              {/* Free */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Free</h3>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 sm:mb-6">$0</p>

                <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                  {[
                    "10 meal prompts/month",
                    "6 meal chat messages/mo",
                    "Grocery integration",
                    "Save meals",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className="block w-full py-2.5 sm:py-3 text-center bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
                >
                  Get Started for Free
                </Link>
              </div>

              {/* Individual */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-lg border-2 border-[#4A90E2] relative sm:col-span-2 lg:col-span-1">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 sm:px-4 py-1 bg-[#4A90E2] text-white text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap">
                  Most Popular
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Individual</h3>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">$9.99<span className="text-base font-normal text-gray-500">/mo</span></p>

                <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8 mt-4 sm:mt-6">
                  {[
                    "Unlimited prompts",
                    "1,000 chat messages",
                    "Unlimited saved meals",
                    "Priority generation",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className="block w-full py-2.5 sm:py-3 text-center bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white font-medium rounded-xl hover:shadow-lg transition-shadow text-sm sm:text-base"
                >
                  Go Individual
                </Link>
              </div>

              {/* Family */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Family</h3>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">$14.99<span className="text-base font-normal text-gray-500">/mo</span></p>

                <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8 mt-4 sm:mt-6">
                  {[
                    "Up to 5 profiles",
                    "Unified shopping list",
                    "Priority support",
                    "Everything in Individual",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className="block w-full py-2.5 sm:py-3 text-center bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
                >
                  Go Family
                </Link>
              </div>
            </div>

            <p className="text-center text-gray-600 mt-8 sm:mt-10 text-sm sm:text-base">
              Meals planned. Groceries added. Relief delivered.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-6 sm:py-8 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <Image src={CartSenseLogo} alt="CartSense Logo" className="h-6 sm:h-8 w-auto brightness-0 invert" />
            </div>
            <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm">
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/privacy-policy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <a href="mailto:support@cartsense.app" className="hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-800 text-center text-xs sm:text-sm">
            <p>&copy; {new Date().getFullYear()} CartSense. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
