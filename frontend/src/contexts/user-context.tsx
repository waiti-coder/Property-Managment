"use client";

import { useFrappeAuth, useFrappeGetCall, useFrappeGetDoc } from "frappe-react-sdk";
import * as React from "react";

interface UserContextValue {
  user: any | null;
  isLoading: boolean;
  error: any;
  logout: () => Promise<void>;
}

export const UserContext = React.createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading: authLoading, logout } = useFrappeAuth();

  const shouldFetch = !!currentUser && currentUser !== "Guest";

  const {
    data: userData,
    error: userError,
    isValidating: userLoading,
  } = useFrappeGetDoc<any>("User", shouldFetch ? currentUser : null);

  // The generic User-doc fetch above is field-permission-filtered, so a
  // Website User's own `roles` child table comes back empty - this endpoint
  // is a reliable source instead.
  const { data: rolesResponse } = useFrappeGetCall<{ message: string[] }>(
    "kings_manage.kings_manage.portal_api.get_my_roles",
    {},
    shouldFetch ? undefined : null,
  );

  const user = React.useMemo(() => {
    if (authLoading) return null;
    if (!currentUser || currentUser === "Guest") return null;
    if (!userData) return null;

    const roleNames = rolesResponse?.message;

    return {
      ...userData,
      roles: roleNames ? roleNames.map((role) => ({ role })) : userData.roles,
    };
  }, [userData, currentUser, authLoading, rolesResponse]);

  const value = React.useMemo(
    () => ({
      user,
      isLoading: authLoading || (shouldFetch ? userLoading : false),
      error: currentUser === "Guest" ? null : userError,
      logout,
    }),
    [
      user,
      authLoading,
      userLoading,
      userError,
      logout,
      currentUser,
      shouldFetch,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = React.useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
