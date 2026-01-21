"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Clock, Bookmark, Search, Check, Package } from "lucide-react";
import CartSenseLogo from "@/app/CartSenseLogo.svg";
import { Button } from "@/components/Button";

const features = [
  {
    title: "AI-Powered Meals",
    description: "Generate personalized recipes based on your dietary preferences and what you're craving.",
    color: "#4A90E2",
  },
  {
    title: "One-Tap Shopping",
    description: "Add ingredients directly to your Kroger cart. No more manual list-making.",
    color: "#10b981",
  },
  {
    title: "Save Your Favorites",
    description: "Build your personal cookbook with meals you love. Access them anytime.",
    color: "#ec4899",
  },
  {
    title: "Track Your Pantry",
    description: "Keep track of what you have at home. We'll suggest recipes and skip items you already own.",
    color: "#8b5cf6",
  },
];

// Mini UI mockups for each feature
function MealGenerationMockup() {
  return (
    <div className="w-64 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
          <Search className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-400">Easy weeknight dinners...</span>
        </div>
      </div>
      <div className="p-2 space-y-2">
        {[
          { name: "Honey Garlic Chicken", cal: 420, time: "20-25", img: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=80&h=80&fit=crop" },
          { name: "Greek Chicken Bowl", cal: 385, time: "15-20", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=80&h=80&fit=crop" },
        ].map((meal, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-2 flex gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={meal.img} alt={meal.name} className="w-10 h-10 rounded-lg object-cover" />
            <div className="flex-1">
              <p className="text-[10px] font-medium text-gray-900">{meal.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[8px] text-gray-500">{meal.cal} cal</span>
                <span className="flex items-center gap-0.5 text-[8px] text-gray-500">
                  <Clock className="w-2 h-2" />{meal.time}m
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShoppingListMockup() {
  return (
    <div className="w-64 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-900">Shopping List</p>
        <p className="text-[10px] text-gray-500">8 items</p>
      </div>
      <div className="p-2 space-y-1.5">
        {[
          { name: "Chicken breast", price: "$8.99", checked: true },
          { name: "Garlic", price: "$0.79", checked: true },
          { name: "Honey", price: "$6.49", checked: false },
          { name: "Soy sauce", price: "$3.29", checked: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
            <div className={`w-4 h-4 rounded border-2 ${item.checked ? 'bg-[#10b981] border-[#10b981]' : 'border-gray-300'} flex items-center justify-center`}>
              {item.checked && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className={`text-[10px] flex-1 ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.name}</span>
            <span className={`text-[10px] font-medium ${item.checked ? 'text-gray-400' : 'text-gray-900'}`}>{item.price}</span>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-gray-100">
        <div className="bg-[#0056a3] text-white rounded-lg py-2 flex items-center justify-center gap-1.5 text-[10px] font-medium">
          <ShoppingCart className="w-3 h-3" />
          Add to Kroger Cart
        </div>
      </div>
    </div>
  );
}

function SavedMealsMockup() {
  return (
    <div className="w-64 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <Bookmark className="w-4 h-4 text-[#4A90E2]" />
        <div>
          <p className="text-xs font-medium text-gray-900">Saved Meals</p>
          <p className="text-[10px] text-gray-500">12 meals saved</p>
        </div>
      </div>
      <div className="p-2 space-y-2">
        {[
          { name: "Honey Garlic Chicken", img: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=64&h=64&fit=crop" },
          { name: "Greek Chicken Bowl", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=64&h=64&fit=crop" },
          { name: "Lemon Herb Salmon", img: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=64&h=64&fit=crop" },
        ].map((meal, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-2 flex gap-2 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={meal.img} alt={meal.name} className="w-8 h-8 rounded-lg object-cover" />
            <p className="text-[10px] font-medium text-gray-900 flex-1">{meal.name}</p>
            <Bookmark className="w-3 h-3 text-[#4A90E2] fill-[#4A90E2]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PantryMockup() {
  return (
    <div className="w-64 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <Package className="w-4 h-4 text-[#8b5cf6]" />
        <div>
          <p className="text-xs font-medium text-gray-900">My Pantry</p>
          <p className="text-[10px] text-gray-500">14 items tracked</p>
        </div>
      </div>
      <div className="p-2 space-y-1.5">
        {[
          { name: "Olive Oil", qty: "1 bottle", inStock: true },
          { name: "Rice", qty: "2 lbs", inStock: true },
          { name: "Garlic", qty: "1 head", inStock: true },
          { name: "Chicken Broth", qty: "Low", inStock: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${item.inStock ? 'bg-[#10b981]' : 'bg-amber-400'}`} />
            <span className="text-[10px] text-gray-700 flex-1">{item.name}</span>
            <span className={`text-[10px] font-medium ${item.inStock ? 'text-gray-500' : 'text-amber-600'}`}>{item.qty}</span>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-gray-100">
        <div className="bg-[#8b5cf6] text-white rounded-lg py-2 flex items-center justify-center gap-1.5 text-[10px] font-medium">
          <Package className="w-3 h-3" />
          Update Pantry
        </div>
      </div>
    </div>
  );
}

export function MobileWelcome() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Auto-advance carousel every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % features.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      // Swipe left
      setActiveSlide((prev) => Math.min(prev + 1, features.length - 1));
    }
    if (touchEnd - touchStart > 75) {
      // Swipe right
      setActiveSlide((prev) => Math.max(prev - 1, 0));
    }
  };

  const mockups = [
    <MealGenerationMockup key="meals" />,
    <ShoppingListMockup key="shopping" />,
    <SavedMealsMockup key="saved" />,
    <PantryMockup key="pantry" />,
  ];

  return (
    <div className="min-h-screen bg-[#f8fafb] flex flex-col safe-area-top">
      {/* Main content area */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Logo & Tagline */}
        <div className="text-center mb-8">
          <Image src={CartSenseLogo} alt="CartSense" className="h-10 w-auto mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            Turn AI-generated recipes into a full grocery cart in seconds.
          </p>
        </div>

        {/* App UI Mockup - Fixed height container to prevent layout shifts */}
        <div className="mb-6 h-[240px] w-full flex items-center justify-center relative">
          {mockups.map((mockup, index) => (
            <div
              key={index}
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out ${
                index === activeSlide
                  ? "opacity-100 scale-100"
                  : index < activeSlide
                  ? "opacity-0 scale-95 -translate-x-[60%]"
                  : "opacity-0 scale-95 -translate-x-[40%]"
              }`}
            >
              {mockup}
            </div>
          ))}
        </div>

        {/* Content - Fixed height to prevent layout shifts */}
        <div className="text-center max-w-sm w-full h-[80px] relative">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`absolute inset-0 flex flex-col justify-start transition-all duration-500 ease-out ${
                index === activeSlide
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4 pointer-events-none"
              }`}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="flex gap-2 mt-10">
          {features.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeSlide
                  ? "w-8 bg-[#4A90E2]"
                  : "w-2 bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="px-6 pb-8 space-y-3 safe-area-bottom">
        <Link href="/login?mode=signin" className="block">
          <Button fullWidth size="lg" className="rounded-2xl py-4">
            Sign In
          </Button>
        </Link>
        <Link href="/signup" className="block">
          <button className="w-full py-4 bg-white border-2 border-[#4A90E2] text-[#4A90E2] rounded-2xl font-medium hover:bg-[#4A90E2]/5 active:scale-[0.98] transition-all">
            Create Account
          </button>
        </Link>
      </div>
    </div>
  );
}
