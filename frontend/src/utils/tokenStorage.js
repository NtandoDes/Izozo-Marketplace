export function storeTokens({ access, refresh, role }, remember) {
  const storage = remember ? localStorage : sessionStorage;

  storage.setItem("access_token", access);
  if (refresh) storage.setItem("refresh_token", refresh);
  storage.setItem("role", role);
}

export function getRole() {
  return (
    localStorage.getItem("role") ||
    sessionStorage.getItem("role")
  );
}
