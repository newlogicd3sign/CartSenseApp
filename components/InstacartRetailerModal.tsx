"use client";

import { useState } from "react";
import { Search, CheckCircle, Store } from "lucide-react";
import { Modal } from "./Modal";
import Image from "next/image";

export type InstacartRetailer = {
    retailer_key: string;
    name: string;
    retailer_logo_url: string;
    postal_code?: string;
};

interface InstacartRetailerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectRetailer: (retailer: InstacartRetailer) => Promise<void>;
    savedRetailer?: InstacartRetailer | null;
    onClearRetailer?: () => Promise<void>;
}

export function InstacartRetailerModal({
    isOpen,
    onClose,
    onSelectRetailer,
    savedRetailer,
    onClearRetailer,
}: InstacartRetailerModalProps) {
    const [zipSearch, setZipSearch] = useState("");
    const [retailers, setRetailers] = useState<InstacartRetailer[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [clearing, setClearing] = useState(false);

    const handleSearchByZip = async () => {
        const zip = zipSearch.trim();
        if (!zip) {
            setSearchError("Please enter a ZIP code.");
            setRetailers([]);
            return;
        }

        try {
            setSearching(true);
            setSearchError(null);
            setRetailers([]);

            const res = await fetch(`/api/instacart/retailers?postal_code=${encodeURIComponent(zip)}`);
            const data = await res.json();

            if (!res.ok || !data.success) {
                setSearchError(data.error || "Could not load retailers for that ZIP.");
                return;
            }

            const results = data.retailers || [];
            setRetailers(results);
            if (results.length === 0) {
                setSearchError("No retailers found for that ZIP code.");
            }
        } catch (err) {
            console.error("Error searching retailers", err);
            setSearchError("Something went wrong searching for retailers.");
        } finally {
            setSearching(false);
        }
    };

    const handleSelectRetailer = async (retailer: InstacartRetailer) => {
        try {
            setSaving(true);
            // Include the postal_code used to find this retailer
            const retailerWithZip: InstacartRetailer = {
                ...retailer,
                postal_code: zipSearch.trim() || undefined,
            };
            await onSelectRetailer(retailerWithZip);
            setRetailers([]);
            setZipSearch("");
            onClose();
        } catch (err) {
            console.error("Error selecting retailer", err);
        } finally {
            setSaving(false);
        }
    };

    const handleClearRetailer = async () => {
        if (!onClearRetailer) return;
        try {
            setClearing(true);
            await onClearRetailer();
        } catch (err) {
            console.error("Error clearing retailer", err);
        } finally {
            setClearing(false);
        }
    };

    const handleClose = () => {
        setZipSearch("");
        setRetailers([]);
        setSearchError(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Choose Your Instacart Store"
            subtitle="Select a preferred store for Instacart shopping"
            variant="bottom-sheet"
            size="lg"
        >
            <div className="space-y-4">
                {/* Current Selection */}
                {savedRetailer && (
                    <div className="bg-[#003D29]/5 border border-[#003D29]/20 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            {savedRetailer.retailer_logo_url ? (
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0 border border-gray-100">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={savedRetailer.retailer_logo_url}
                                        alt={savedRetailer.name}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-[#003D29]/10 flex items-center justify-center flex-shrink-0">
                                    <Store className="w-6 h-6 text-[#003D29]" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-[#003D29]">{savedRetailer.name}</span>
                                    <span className="px-1.5 py-0.5 bg-[#003D29]/10 text-[#003D29] rounded text-[10px] font-medium">
                                        Default
                                    </span>
                                </div>
                                <p className="text-xs text-[#003D29]/70 mt-0.5">
                                    This store will be pre-selected when you shop with Instacart
                                    {savedRetailer.postal_code && ` • ZIP: ${savedRetailer.postal_code}`}
                                </p>
                            </div>
                        </div>
                        {onClearRetailer && (
                            <button
                                onClick={() => void handleClearRetailer()}
                                disabled={clearing}
                                className="mt-3 text-sm text-[#003D29]/70 hover:text-[#003D29] underline"
                            >
                                {clearing ? "Clearing..." : "Clear selection"}
                            </button>
                        )}
                    </div>
                )}

                {/* Info box */}
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-xs font-medium text-blue-800 mb-1">Popular Instacart Retailers</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                        Costco, Walmart, Target, Safeway, Kroger, Publix, Albertsons, Sprouts, and many more local grocers
                    </p>
                </div>

                {/* ZIP Search */}
                <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Search by ZIP Code
                    </label>
                    <div className="flex gap-2">
                        <input
                            value={zipSearch}
                            onChange={(e) => setZipSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    void handleSearchByZip();
                                }
                            }}
                            placeholder="Enter ZIP code"
                            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:border-[#003D29] focus:outline-none"
                        />
                        <button
                            onClick={() => void handleSearchByZip()}
                            disabled={searching}
                            className="p-2.5 bg-[#003D29] text-white rounded-xl disabled:opacity-70 flex items-center justify-center flex-shrink-0"
                            aria-label="Search"
                        >
                            {searching ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search className="w-5 h-5" />
                            )}
                        </button>
                    </div>

                    {searchError && (
                        <p className="text-sm text-red-500 mt-2">{searchError}</p>
                    )}
                </div>

                {/* Search Results */}
                {retailers.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Available Retailers ({retailers.length})
                        </p>
                        <div className="max-h-[300px] overflow-y-auto space-y-2">
                            {retailers.map((retailer) => {
                                const isSelected = savedRetailer?.retailer_key === retailer.retailer_key;
                                return (
                                    <div
                                        key={retailer.retailer_key}
                                        className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                                            isSelected
                                                ? "bg-[#003D29]/5 border border-[#003D29]/20"
                                                : "border border-gray-200 hover:border-gray-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {retailer.retailer_logo_url ? (
                                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex-shrink-0 border border-gray-100">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={retailer.retailer_logo_url}
                                                        alt={retailer.name}
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                    <Store className="w-5 h-5 text-gray-400" />
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-medium text-gray-900 text-sm">{retailer.name}</span>
                                            </div>
                                        </div>
                                        {isSelected ? (
                                            <div className="flex items-center gap-1.5 text-[#003D29]">
                                                <CheckCircle className="w-4 h-4" />
                                                <span className="text-xs font-medium">Selected</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => void handleSelectRetailer(retailer)}
                                                disabled={saving}
                                                className="px-3 py-1.5 bg-[#003D29] text-white rounded-lg text-xs font-medium hover:bg-[#004D35] transition-colors disabled:opacity-70 flex-shrink-0"
                                            >
                                                {saving ? "..." : "Select"}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
