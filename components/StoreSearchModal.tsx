"use client";

import { useState } from "react";
import { Search, MapPin, CheckCircle } from "lucide-react";
import { Modal } from "./Modal";

type KrogerLocationSearchResult = {
    locationId: string;
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
};

type SavedLocation = {
    id: string;
    krogerLocationId: string;
    name: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    zip?: string;
    isDefault: boolean;
};

interface StoreSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectStore: (store: KrogerLocationSearchResult) => Promise<void>;
    savedLocations: SavedLocation[];
    defaultLocationId?: string | null;
    onSetDefault: (location: SavedLocation) => Promise<void>;
    onRemoveStore: (location: SavedLocation) => Promise<void>;
}

export function StoreSearchModal({
    isOpen,
    onClose,
    onSelectStore,
    savedLocations,
    defaultLocationId,
    onSetDefault,
    onRemoveStore,
}: StoreSearchModalProps) {
    const [zipSearch, setZipSearch] = useState("");
    const [storeResults, setStoreResults] = useState<KrogerLocationSearchResult[]>([]);
    const [searchingStores, setSearchingStores] = useState(false);
    const [storeSearchError, setStoreSearchError] = useState<string | null>(null);
    const [savingLocation, setSavingLocation] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const handleSearchStoresByZip = async () => {
        const zip = zipSearch.trim();
        if (!zip) {
            setStoreSearchError("Please enter a ZIP code.");
            setStoreResults([]);
            return;
        }

        try {
            setSearchingStores(true);
            setStoreSearchError(null);
            setStoreResults([]);

            const res = await fetch(`/api/kroger/locations?zip=${encodeURIComponent(zip)}`);

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setStoreSearchError(data?.message || "Could not load stores for that ZIP.");
                return;
            }

            const data = (await res.json()) as { locations?: KrogerLocationSearchResult[] };
            const locs = data.locations ?? [];
            setStoreResults(locs);
            if (locs.length === 0) {
                setStoreSearchError("No stores found for that ZIP.");
            }
        } catch (err) {
            console.error("Error searching stores", err);
            setStoreSearchError("Something went wrong searching for stores.");
        } finally {
            setSearchingStores(false);
        }
    };

    const handleSelectStore = async (store: KrogerLocationSearchResult) => {
        // Check if already saved
        const existing = savedLocations.find(
            (loc) => loc.krogerLocationId === store.locationId
        );
        if (existing) {
            setStoreSearchError(`${store.name} is already in your saved stores.`);
            return;
        }

        try {
            setSavingLocation(true);
            await onSelectStore(store);
            setStoreResults([]);
            setZipSearch("");
            onClose();
        } catch (err) {
            console.error("Error selecting store", err);
        } finally {
            setSavingLocation(false);
        }
    };

    const handleRemove = async (loc: SavedLocation) => {
        try {
            setRemovingId(loc.id);
            await onRemoveStore(loc);
        } finally {
            setRemovingId(null);
        }
    };

    const handleClose = () => {
        setZipSearch("");
        setStoreResults([]);
        setStoreSearchError(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Find Your Store"
            subtitle="Search by ZIP code to find nearby stores"
            variant="bottom-sheet"
            size="lg"
        >
            <div className="space-y-4">
                {/* Supported stores info */}
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-xs font-medium text-blue-800 mb-1">Kroger Family of Stores</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                        Kroger, Ralphs, Fred Meyer, King Soopers, Fry&apos;s, Smith&apos;s, Dillons, QFC, Harris Teeter, Pick &apos;n Save, Mariano&apos;s, and more
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
                                    void handleSearchStoresByZip();
                                }
                            }}
                            placeholder="Enter ZIP code"
                            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:border-[#4A90E2] focus:outline-none"
                        />
                        <button
                            onClick={() => void handleSearchStoresByZip()}
                            disabled={searchingStores}
                            className="p-2.5 bg-gray-900 text-white rounded-xl disabled:opacity-70 flex items-center justify-center flex-shrink-0"
                            aria-label="Search"
                        >
                            {searchingStores ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search className="w-5 h-5" />
                            )}
                        </button>
                    </div>

                    {storeSearchError && (
                        <p className="text-sm text-red-500 mt-2">{storeSearchError}</p>
                    )}
                </div>

                {/* Search Results */}
                {storeResults.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Search Results
                        </p>
                        {storeResults.map((store) => (
                            <div
                                key={store.locationId}
                                className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <span className="font-medium text-gray-900 text-sm">{store.name}</span>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {store.addressLine1}, {store.city}, {store.state}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => void handleSelectStore(store)}
                                    disabled={savingLocation}
                                    className="px-3 py-1.5 bg-[#4A90E2] text-white rounded-lg text-xs font-medium hover:bg-[#357ABD] transition-colors disabled:opacity-70 flex-shrink-0"
                                >
                                    {savingLocation ? "..." : "Add"}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Saved Locations */}
                {savedLocations.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Your Saved Stores
                        </p>
                        {savedLocations.map((loc) => {
                            const isDefault = loc.krogerLocationId === defaultLocationId;
                            return (
                                <div
                                    key={loc.id}
                                    className={`flex items-center justify-between p-3 rounded-xl ${
                                        isDefault ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50"
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {isDefault ? (
                                            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900 text-sm">{loc.name}</span>
                                                {isDefault && (
                                                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {loc.city && loc.state && `${loc.city}, ${loc.state}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isDefault && (
                                            <button
                                                onClick={() => void onSetDefault(loc)}
                                                className="text-xs text-[#4A90E2] hover:underline"
                                            >
                                                Set default
                                            </button>
                                        )}
                                        <button
                                            onClick={() => void handleRemove(loc)}
                                            disabled={removingId === loc.id}
                                            className="text-xs text-red-500 hover:text-red-600"
                                        >
                                            {removingId === loc.id ? "..." : "Remove"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Modal>
    );
}
