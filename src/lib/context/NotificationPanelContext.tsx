"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface NotificationPanelContextValue {
  isOpen: boolean;
  toggle: () => void;
}

const NotificationPanelContext = createContext<
  NotificationPanelContextValue | undefined
>(undefined);

export function NotificationPanelProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <NotificationPanelContext.Provider value={{ isOpen, toggle }}>
      {children}
    </NotificationPanelContext.Provider>
  );
}

export function useNotificationPanel(): NotificationPanelContextValue {
  const ctx = useContext(NotificationPanelContext);
  if (!ctx)
    throw new Error(
      "useNotificationPanel must be used within a NotificationPanelProvider"
    );
  return ctx;
}

export { NotificationPanelContext };
