import { useState, useEffect, useCallback } from "react";
import { useUser, useAuth } from "@clerk/react";
import { ShieldOff, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Card } from "./ui/card";
import "./UserManagement.css";

interface ClerkUser {
  id: string;
  email_addresses: string[];
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  created_at: string;
  last_active_at: string | null;
  last_sign_in_at: string | null;
  banned: boolean;
}

export function UserManagement() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [users, setUsers] = useState<ClerkUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // --- RBAC guard ---
  const isAdmin = user?.publicMetadata?.role === "admin";

  if (!isAdmin) {
    return (
      <Card padding="32px">
        <div className="user-management__unauthorized">
          <ShieldOff size={48} className="user-management__unauthorized-icon" />
          <p className="user-management__unauthorized-text">
            403 — Unauthorized
          </p>
          <p className="user-management__unauthorized-subtext">
            Only admins can manage users.
          </p>
        </div>
      </Card>
    );
  }

  // --- Data fetching ---
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const baseUrl =
        import.meta.env.VITE_DATA_API_URL || "http://localhost:8002";

      const resp = await fetch(`${baseUrl}/api/v1/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${resp.status}`);
      }

      const data: ClerkUser[] = await resp.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- Promote action ---
  const handlePromote = async (userId: string) => {
    setPromotingId(userId);
    const loadingId = toast.loading("Promoting user to admin...");

    try {
      const token = await getToken();
      const baseUrl =
        import.meta.env.VITE_DATA_API_URL || "http://localhost:8002";

      const resp = await fetch(
        `${baseUrl}/api/v1/admin/users/${userId}/role?role=admin`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${resp.status}`);
      }

      toast.dismiss(loadingId);
      toast.success("User promoted to admin");

      // Optimistic local update + re-fetch for server truth
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: "admin" } : u
        )
      );
      await fetchUsers();
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error(err instanceof Error ? err.message : "Failed to promote user");
    } finally {
      setPromotingId(null);
    }
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="user-management">
        <h2 className="user-management__title">User Management</h2>
        <div className="user-management__table-wrapper">
          <table className="user-management__table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i} className="user-management__skeleton-row">
                  <td colSpan={4} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card padding="32px">
        <div className="user-management__unauthorized">
          <ShieldOff size={40} className="user-management__unauthorized-icon" />
          <p className="user-management__unauthorized-text">{error}</p>
          <button
            className="user-management__promote-btn"
            onClick={fetchUsers}
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="user-management">
      <div className="user-management__header">
        <h2 className="user-management__title">User Management</h2>
        <span className="user-management__count">
          {users.length} user{users.length !== 1 ? "s" : ""}
        </span>
      </div>

      {users.length === 0 ? (
        <Card padding="32px">
          <div className="user-management__empty">No users found.</div>
        </Card>
      ) : (
        <div className="user-management__table-wrapper">
          <table className="user-management__table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isPromoting = promotingId === u.id;
                const alreadyAdmin = u.role === "admin";

                return (
                  <tr key={u.id}>
                    <td className="user-management__user-id">
                      {u.id}
                    </td>
                    <td>{u.email_addresses[0] || "—"}</td>
                    <td>
                      <span
                        className={`user-management__role-badge user-management__role-badge--${u.role}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {alreadyAdmin ? (
                        <span
                          className="user-management__role-badge user-management__role-badge--admin"
                          style={{ pointerEvents: "none" }}
                        >
                          <Shield size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                          Admin
                        </span>
                      ) : (
                        <button
                          className="user-management__promote-btn"
                          disabled={isPromoting}
                          onClick={() => handlePromote(u.id)}
                        >
                          {isPromoting && (
                            <Loader2
                              size={14}
                              className="user-management__promote-spinner"
                            />
                          )}
                          Promote to Admin
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
