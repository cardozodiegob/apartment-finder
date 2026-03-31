import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// --- Redux slice tests ---
import { makeStore, RootState } from "@/lib/store/store";
import sessionReducer, {
  setUser,
  clearUser,
  setSessionLoading,
  SessionUser,
} from "@/lib/store/slices/sessionSlice";
import listingsReducer, {
  setListings,
  setSelectedListing,
  setListingsLoading,
  setListingsError,
  ListingItem,
} from "@/lib/store/slices/listingsSlice";
import filtersReducer, {
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
  FiltersState,
} from "@/lib/store/slices/filtersSlice";
import paymentsReducer, {
  setActivePayment,
  setPaymentHistory,
  setPaymentsLoading,
  PaymentRecord,
} from "@/lib/store/slices/paymentsSlice";

// --- Session Slice ---
describe("sessionSlice", () => {
  const initialState = { user: null, isAuthenticated: false, loading: false };

  it("should return initial state", () => {
    expect(sessionReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("should set user and mark authenticated", () => {
    const user: SessionUser = {
      id: "1",
      email: "test@example.com",
      fullName: "Test User",
      role: "seeker",
      preferredLanguage: "en",
      preferredCurrency: "EUR",
    };
    const state = sessionReducer(initialState, setUser(user));
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
    expect(state.loading).toBe(false);
  });

  it("should clear user", () => {
    const withUser = {
      user: { id: "1", email: "a@b.com", fullName: "A", role: "seeker" as const, preferredLanguage: "en", preferredCurrency: "EUR" },
      isAuthenticated: true,
      loading: false,
    };
    const state = sessionReducer(withUser, clearUser());
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("should set loading", () => {
    const state = sessionReducer(initialState, setSessionLoading(true));
    expect(state.loading).toBe(true);
  });
});

// --- Listings Slice ---
describe("listingsSlice", () => {
  const initialState = { items: [], selectedListing: null, loading: false, error: null };

  it("should return initial state", () => {
    expect(listingsReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("should set listings", () => {
    const items: ListingItem[] = [
      { id: "1", title: "Apt", description: "Nice", propertyType: "apartment", monthlyRent: 1000, currency: "EUR", city: "Berlin", status: "active" },
    ];
    const state = listingsReducer(initialState, setListings(items));
    expect(state.items).toEqual(items);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("should set selected listing", () => {
    const listing: ListingItem = { id: "1", title: "Apt", description: "Nice", propertyType: "apartment", monthlyRent: 1000, currency: "EUR", city: "Berlin", status: "active" };
    const state = listingsReducer(initialState, setSelectedListing(listing));
    expect(state.selectedListing).toEqual(listing);
  });

  it("should set loading", () => {
    const state = listingsReducer(initialState, setListingsLoading(true));
    expect(state.loading).toBe(true);
  });

  it("should set error and clear loading", () => {
    const state = listingsReducer({ ...initialState, loading: true }, setListingsError("fail"));
    expect(state.error).toBe("fail");
    expect(state.loading).toBe(false);
  });
});

// --- Filters Slice ---
describe("filtersSlice", () => {
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

  it("should return initial state", () => {
    expect(filtersReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("should set property type and reset page", () => {
    const state = filtersReducer({ ...initialState, page: 3 }, setPropertyType("apartment"));
    expect(state.propertyType).toBe("apartment");
    expect(state.page).toBe(1);
  });

  it("should set price range", () => {
    const state = filtersReducer(initialState, setPriceRange({ min: 500, max: 1500 }));
    expect(state.priceRange).toEqual({ min: 500, max: 1500 });
  });

  it("should set bedrooms", () => {
    const state = filtersReducer(initialState, setBedrooms(2));
    expect(state.bedrooms).toBe(2);
  });

  it("should set tags", () => {
    const state = filtersReducer(initialState, setTags(["furnished", "pet-friendly"]));
    expect(state.tags).toEqual(["furnished", "pet-friendly"]);
  });

  it("should set purpose", () => {
    const state = filtersReducer(initialState, setPurpose("share"));
    expect(state.purpose).toBe("share");
  });

  it("should set city", () => {
    const state = filtersReducer(initialState, setCity("Berlin"));
    expect(state.city).toBe("Berlin");
  });

  it("should set shared accommodation", () => {
    const state = filtersReducer(initialState, setIsSharedAccommodation(true));
    expect(state.isSharedAccommodation).toBe(true);
  });

  it("should set query", () => {
    const state = filtersReducer(initialState, setQuery("cozy"));
    expect(state.query).toBe("cozy");
  });

  it("should set page without resetting", () => {
    const state = filtersReducer(initialState, setPage(5));
    expect(state.page).toBe(5);
  });

  it("should clear all filters to initial state", () => {
    const modified: FiltersState = {
      propertyType: "house",
      priceRange: { min: 100, max: 2000 },
      bedrooms: 3,
      tags: ["a"],
      purpose: "rent",
      city: "Paris",
      isSharedAccommodation: true,
      query: "test",
      page: 4,
    };
    const state = filtersReducer(modified, clearFilters());
    expect(state).toEqual(initialState);
  });
});

// --- Payments Slice ---
describe("paymentsSlice", () => {
  const initialState = { activePayment: null, paymentHistory: [], loading: false };

  it("should return initial state", () => {
    expect(paymentsReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("should set active payment", () => {
    const payment: PaymentRecord = { id: "p1", amount: 1000, currency: "EUR", status: "pending", createdAt: "2024-01-01" };
    const state = paymentsReducer(initialState, setActivePayment(payment));
    expect(state.activePayment).toEqual(payment);
  });

  it("should set payment history", () => {
    const history: PaymentRecord[] = [
      { id: "p1", amount: 1000, currency: "EUR", status: "completed", createdAt: "2024-01-01" },
    ];
    const state = paymentsReducer(initialState, setPaymentHistory(history));
    expect(state.paymentHistory).toEqual(history);
  });

  it("should set loading", () => {
    const state = paymentsReducer(initialState, setPaymentsLoading(true));
    expect(state.loading).toBe(true);
  });
});

// --- Redux Store integration ---
describe("Redux Store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should create store with default state", () => {
    const store = makeStore();
    const state = store.getState();
    expect(state.session.user).toBeNull();
    expect(state.session.isAuthenticated).toBe(false);
    expect(state.listings.items).toEqual([]);
    expect(state.filters.query).toBe("");
    expect(state.payments.activePayment).toBeNull();
  });

  it("should dispatch actions across slices", () => {
    const store = makeStore();
    store.dispatch(setUser({ id: "1", email: "a@b.com", fullName: "A", role: "seeker", preferredLanguage: "en", preferredCurrency: "EUR" }));
    store.dispatch(setPropertyType("room"));
    expect(store.getState().session.isAuthenticated).toBe(true);
    expect(store.getState().filters.propertyType).toBe("room");
  });

  it("should persist session and filters to localStorage", () => {
    const store = makeStore();
    store.dispatch(setUser({ id: "1", email: "a@b.com", fullName: "A", role: "seeker", preferredLanguage: "en", preferredCurrency: "EUR" }));
    store.dispatch(setQuery("berlin"));

    const raw = localStorage.getItem("apartment-finder-state");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.session.isAuthenticated).toBe(true);
    expect(parsed.filters.query).toBe("berlin");
  });

  it("should restore persisted state on store creation", () => {
    // Seed localStorage
    const persisted = {
      session: { user: { id: "1", email: "a@b.com", fullName: "A", role: "seeker", preferredLanguage: "en", preferredCurrency: "EUR" }, isAuthenticated: true, loading: false },
      filters: { propertyType: "house", priceRange: null, bedrooms: null, tags: [], purpose: null, city: null, isSharedAccommodation: false, query: "saved", page: 2 },
    };
    localStorage.setItem("apartment-finder-state", JSON.stringify(persisted));

    const store = makeStore();
    expect(store.getState().session.isAuthenticated).toBe(true);
    expect(store.getState().session.user?.email).toBe("a@b.com");
    expect(store.getState().filters.query).toBe("saved");
    expect(store.getState().filters.page).toBe(2);
  });

  it("should not persist listings or payments state", () => {
    const store = makeStore();
    store.dispatch(setListings([{ id: "1", title: "T", description: "D", propertyType: "apartment", monthlyRent: 1000, currency: "EUR", city: "Berlin", status: "active" }]));
    store.dispatch(setActivePayment({ id: "p1", amount: 500, currency: "EUR", status: "pending", createdAt: "2024-01-01" }));

    const raw = localStorage.getItem("apartment-finder-state");
    const parsed = JSON.parse(raw!);
    expect(parsed.listings).toBeUndefined();
    expect(parsed.payments).toBeUndefined();
  });
});

// --- Context Provider tests ---
import { ThemeProvider, useTheme } from "@/lib/context/ThemeContext";
import { LocaleProvider, useLocale } from "@/lib/context/LocaleContext";
import { NotificationPanelProvider, useNotificationPanel } from "@/lib/context/NotificationPanelContext";

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  );
}

function LocaleConsumer() {
  const { locale, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale("fr")}>set-fr</button>
    </div>
  );
}

function NotificationConsumer() {
  const { isOpen, toggle } = useNotificationPanel();
  return (
    <div>
      <span data-testid="isOpen">{String(isOpen)}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("should default to light theme", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });

  it("should toggle theme", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    await user.click(screen.getByText("toggle"));
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should throw when used outside provider", () => {
    expect(() => render(<ThemeConsumer />)).toThrow(
      "useTheme must be used within a ThemeProvider"
    );
  });
});

describe("LocaleContext", () => {
  it("should default to en", () => {
    render(
      <LocaleProvider>
        <LocaleConsumer />
      </LocaleProvider>
    );
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });

  it("should accept initial locale", () => {
    render(
      <LocaleProvider initialLocale="de">
        <LocaleConsumer />
      </LocaleProvider>
    );
    expect(screen.getByTestId("locale").textContent).toBe("de");
  });

  it("should update locale", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <LocaleConsumer />
      </LocaleProvider>
    );
    await user.click(screen.getByText("set-fr"));
    expect(screen.getByTestId("locale").textContent).toBe("fr");
  });

  it("should throw when used outside provider", () => {
    expect(() => render(<LocaleConsumer />)).toThrow(
      "useLocale must be used within a LocaleProvider"
    );
  });
});

describe("NotificationPanelContext", () => {
  it("should default to closed", () => {
    render(
      <NotificationPanelProvider>
        <NotificationConsumer />
      </NotificationPanelProvider>
    );
    expect(screen.getByTestId("isOpen").textContent).toBe("false");
  });

  it("should toggle open/closed", async () => {
    const user = userEvent.setup();
    render(
      <NotificationPanelProvider>
        <NotificationConsumer />
      </NotificationPanelProvider>
    );
    await user.click(screen.getByText("toggle"));
    expect(screen.getByTestId("isOpen").textContent).toBe("true");
    await user.click(screen.getByText("toggle"));
    expect(screen.getByTestId("isOpen").textContent).toBe("false");
  });

  it("should throw when used outside provider", () => {
    expect(() => render(<NotificationConsumer />)).toThrow(
      "useNotificationPanel must be used within a NotificationPanelProvider"
    );
  });
});
