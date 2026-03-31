"use client";

import { useRef, ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/store/store";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { LocaleProvider } from "@/lib/context/LocaleContext";
import { NotificationPanelProvider } from "@/lib/context/NotificationPanelContext";

export default function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return (
    <Provider store={storeRef.current}>
      <ThemeProvider>
        <LocaleProvider>
          <NotificationPanelProvider>{children}</NotificationPanelProvider>
        </LocaleProvider>
      </ThemeProvider>
    </Provider>
  );
}
