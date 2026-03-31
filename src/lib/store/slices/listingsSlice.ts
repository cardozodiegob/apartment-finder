import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ListingItem {
  id: string;
  title: string;
  description: string;
  propertyType: "apartment" | "room" | "house";
  monthlyRent: number;
  currency: string;
  city: string;
  status: "draft" | "active" | "under_review" | "archived";
}

export interface ListingsState {
  items: ListingItem[];
  selectedListing: ListingItem | null;
  loading: boolean;
  error: string | null;
}

const initialState: ListingsState = {
  items: [],
  selectedListing: null,
  loading: false,
  error: null,
};

const listingsSlice = createSlice({
  name: "listings",
  initialState,
  reducers: {
    setListings(state, action: PayloadAction<ListingItem[]>) {
      state.items = action.payload;
      state.loading = false;
      state.error = null;
    },
    setSelectedListing(state, action: PayloadAction<ListingItem | null>) {
      state.selectedListing = action.payload;
    },
    setListingsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setListingsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const {
  setListings,
  setSelectedListing,
  setListingsLoading,
  setListingsError,
} = listingsSlice.actions;
export default listingsSlice.reducer;
