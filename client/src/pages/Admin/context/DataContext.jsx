import { createContext, useCallback, useContext, useEffect, useState } from "react";

const DataContext = createContext(null);
const API_URL = "http://localhost:5000/api/admin";

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Your administrator session has expired. Please sign in again.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The administrator API returned an invalid response.");
  }
  if (!response.ok) {
    throw new Error(data.message || "The administrator request failed.");
  }
  return data;
}

export function DataProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [pages, setPages] = useState([]);
  const [requests, setRequests] = useState([]);
  const [overview, setOverview] = useState(null);
  const [archives, setArchives] = useState([]);
  const [reports, setReports] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pageOptions, setPageOptions] = useState({ departments: [], organizations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [overviewData, usersData, pagesData, requestsData, archivesData, reportsData, optionsData, profileData] =
        await Promise.all([
          request("/overview"),
          request("/users"),
          request("/pages"),
          request("/requests"),
          request("/archives"),
          request("/reports"),
          request("/page-options"),
          request("/profile"),
        ]);

      setOverview(overviewData);
      setUsers(usersData.users);
      setPages(pagesData.pages);
      setRequests(requestsData.requests);
      setArchives(archivesData.records);
      setReports(reportsData);
      setPageOptions(optionsData);
      setProfile(profileData.profile);
    } catch (loadError) {
      setError(loadError.message);
      throw loadError;
    }
  }, []);

  useEffect(() => {
    refresh()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  const mutate = useCallback(async (path, options) => {
    setError("");
    try {
      const result = await request(path, options);
      await refresh();
      return result;
    } catch (mutationError) {
      setError(mutationError.message);
      return null;
    }
  }, [refresh]);

  const updateUser = (id, patch) => {
    const operation = patch.role
      ? mutate(`/users/${id}/role`, {
          method: "PATCH",
          body: JSON.stringify({ role: patch.role.toLowerCase() }),
        })
      : mutate(`/users/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ active: patch.active }),
        });
    return operation;
  };

  const addPage = (name, ownerType, ownerId) =>
    mutate("/pages", {
      method: "POST",
      body: JSON.stringify({ pageName: name, ownerType, ownerId }),
    });

  const removePage = (id) =>
    mutate(`/pages/${id}`, { method: "DELETE" });

  const togglePage = (id) => {
    const page = pages.find((item) => item.id === id);
    if (!page) {
      setError("Page not found.");
      return Promise.resolve(null);
    }
    return mutate(`/pages/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ active: !page.active }),
    });
  };

  const reviewRequest = (id, decision) =>
    mutate(`/requests/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });

  const updateProfile = (updates) =>
    mutate("/profile", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

  return (
    <DataContext.Provider
      value={{
        users,
        pages,
        requests,
        overview,
        archives,
        reports,
        profile,
        pageOptions,
        loading,
        error,
        refresh,
        updateUser,
        addPage,
        removePage,
        togglePage,
        reviewRequest,
        updateProfile,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
