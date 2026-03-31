import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: "seeker" | "poster" | "admin";
  preferredLanguage: string;
  preferredCurrency: string;
}

export interface SessionState {
  user: SessionUser | null;
  isAuthenticated: boolean;
  loading: boolean;
}

const initialState: SessionState = {
  user: null,
  isAuthenticated: false,
  loading: false,
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<SessionUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
    },
    clearUser(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
    },
    setSessionLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setUser, clearUser, setSessionLoading } = sessionSlice.actions;
export default sessionSlice.reducer;
