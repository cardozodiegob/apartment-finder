import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface PaymentsState {
  activePayment: PaymentRecord | null;
  paymentHistory: PaymentRecord[];
  loading: boolean;
}

const initialState: PaymentsState = {
  activePayment: null,
  paymentHistory: [],
  loading: false,
};

const paymentsSlice = createSlice({
  name: "payments",
  initialState,
  reducers: {
    setActivePayment(state, action: PayloadAction<PaymentRecord | null>) {
      state.activePayment = action.payload;
    },
    setPaymentHistory(state, action: PayloadAction<PaymentRecord[]>) {
      state.paymentHistory = action.payload;
    },
    setPaymentsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setActivePayment, setPaymentHistory, setPaymentsLoading } =
  paymentsSlice.actions;
export default paymentsSlice.reducer;
