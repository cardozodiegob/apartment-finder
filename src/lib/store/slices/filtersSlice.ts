import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface FiltersState {
  propertyType: string | null;
  priceRange: { min: number; max: number } | null;
  bedrooms: number | null;
  tags: string[];
  purpose: "rent" | "share" | "sublet" | null;
  city: string | null;
  isSharedAccommodation: boolean;
  query: string;
  page: number;
}

const initialState: FiltersState = {
  propertyType: null,
  priceRange: null,
  bedrooms: null,
  tags: [],
  purpose: null,
  city: null,
  isSharedAccommodation: false,
  query: "",
  page: 1,
};

const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    setPropertyType(state, action: PayloadAction<string | null>) {
      state.propertyType = action.payload;
      state.page = 1;
    },
    setPriceRange(
      state,
      action: PayloadAction<{ min: number; max: number } | null>
    ) {
      state.priceRange = action.payload;
      state.page = 1;
    },
    setBedrooms(state, action: PayloadAction<number | null>) {
      state.bedrooms = action.payload;
      state.page = 1;
    },
    setTags(state, action: PayloadAction<string[]>) {
      state.tags = action.payload;
      state.page = 1;
    },
    setPurpose(
      state,
      action: PayloadAction<"rent" | "share" | "sublet" | null>
    ) {
      state.purpose = action.payload;
      state.page = 1;
    },
    setCity(state, action: PayloadAction<string | null>) {
      state.city = action.payload;
      state.page = 1;
    },
    setIsSharedAccommodation(state, action: PayloadAction<boolean>) {
      state.isSharedAccommodation = action.payload;
      state.page = 1;
    },
    setQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
      state.page = 1;
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
    clearFilters() {
      return initialState;
    },
  },
});

export const {
  setPropertyType,
  setPriceRange,
  setBedrooms,
  setTags,
  setPurpose,
  setCity,
  setIsSharedAccommodation,
  setQuery,
  setPage,
  clearFilters,
} = filtersSlice.actions;
export default filtersSlice.reducer;
