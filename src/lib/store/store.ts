import { configureStore, combineReducers } from "@reduxjs/toolkit";
import sessionReducer, { SessionState } from "./slices/sessionSlice";
import listingsReducer from "./slices/listingsSlice";
import filtersReducer, { FiltersState } from "./slices/filtersSlice";
import paymentsReducer from "./slices/paymentsSlice";

const PERSIST_KEY = "apartment-finder-state";

interface PersistedState {
  session: SessionState;
  filters: FiltersState;
}

function loadPersistedState(): Partial<{
  session: SessionState;
  filters: FiltersState;
}> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return {};
    const parsed: PersistedState = JSON.parse(raw);
    return {
      session: parsed.session,
      filters: parsed.filters,
    };
  } catch {
    return {};
  }
}

function savePersistedState(state: RootState) {
  if (typeof window === "undefined") return;
  try {
    const toPersist: PersistedState = {
      session: state.session,
      filters: state.filters,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(toPersist));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

const rootReducer = combineReducers({
  session: sessionReducer,
  listings: listingsReducer,
  filters: filtersReducer,
  payments: paymentsReducer,
});

export function makeStore(preloadedState?: Partial<RootState>) {
  const persisted = loadPersistedState();
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: { ...persisted, ...preloadedState } as RootState,
  });

  store.subscribe(() => {
    savePersistedState(store.getState());
  });

  return store;
}

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
