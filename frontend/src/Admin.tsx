import { useState, type FormEvent } from "react";
import { BedDouble, Edit3, Plus, Save, Search, Users } from "lucide-react";
import { post, put } from "./api";
import { useApp } from "./context";
import type { Guest, RoomType, User } from "./types";
import {
  Badge,
  Button,
  Empty,
  ErrorBox,
  Field,
  initials,
  LoadState,
  Modal,
  money,
  PageTitle,
  useApi,
} from "./ui";

export function Guests() {
  const { version, refresh, notify } = useApp(),
    { data, loading, error } = useApi<Guest[]>("/guests", version),
    [query, setQuery] = useState(""),
    [add, setAdd] = useState(false),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  const guests = (data || []).filter((g) =>
    `${g.name} ${g.email} ${g.phone}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await post("/guests", {
        name: f.get("name"),
        email: f.get("email") || null,
        phone: f.get("phone"),
      });
      refresh();
      notify("Guest profile created.");
      setAdd(false);
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="GUEST RELATIONS"
        title="Guest directory"
        description="The people at the heart of every stay."
        action={
          <Button
            onClick={() => {
              setAdd(true);
              setFailure("");
            }}
          >
            <Plus size={17} />
            Add guest
          </Button>
        }
      />
      <section className="panel">
        <div className="toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search guests"
              placeholder="Search name, email, or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="result-count">{guests.length} guests</span>
        </div>
        <LoadState loading={loading} error={error} />
        {!loading &&
          !error &&
          (guests.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Email address</th>
                    <th>Phone</th>
                    <th>Profile ID</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <div className="guest-cell">
                          <span className="avatar small">
                            {initials(g.name)}
                          </span>
                          <strong>{g.name}</strong>
                        </div>
                      </td>
                      <td>{g.email || "—"}</td>
                      <td>{g.phone || "—"}</td>
                      <td>G-{String(g.id).padStart(4, "0")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No guests found"
              text="Add a guest or try a different search."
            />
          ))}
      </section>
      {add && (
        <Modal
          title="Add a guest"
          description="Create a profile for a reception booking or walk-in."
          onClose={() => setAdd(false)}
        >
          <form onSubmit={save}>
            <Field label="Full name">
              <input name="name" minLength={2} maxLength={120} required />
            </Field>
            <Field label="Email (optional)">
              <input name="email" type="email" />
            </Field>
            <Field label="Phone (optional)">
              <input name="phone" maxLength={40} />
            </Field>
            <ErrorBox message={failure} />
            <div className="modal-actions">
              <Button disabled={busy}>
                {busy ? "Saving…" : "Create guest"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function RoomTypes() {
  const { version } = useApp(),
    { data, loading, error } = useApi<RoomType[]>(
      "/room-types?include_inactive=true",
      version,
    ),
    [edit, setEdit] = useState<RoomType | "new" | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="HOTEL CONFIGURATION"
        title="Room types"
        description="Define your rooms, their capacity, and their fixed nightly rates."
        action={
          <Button onClick={() => setEdit("new")}>
            <Plus size={17} />
            Add room type
          </Button>
        }
      />
      <LoadState loading={loading} error={error} />
      <div className="type-admin-grid">
        {data?.map((t, i) => (
          <article className="panel type-admin-card" key={t.id}>
            <div className={"type-heading tone-" + (i % 4)}>
              <BedDouble size={33} />
              <Badge>{t.is_active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="type-admin-body">
              <h2>{t.name}</h2>
              <p>{t.description}</p>
              <div className="type-admin-facts">
                <span>
                  <Users size={17} />
                  {t.capacity} guests
                </span>
                <strong>
                  {money(t.base_price_per_night)} <small>/ night</small>
                </strong>
              </div>
              <Button variant="secondary" onClick={() => setEdit(t)}>
                <Edit3 size={15} />
                Edit room type
              </Button>
            </div>
          </article>
        ))}
      </div>
      {edit && <TypeEditor roomType={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
function TypeEditor({
  roomType,
  onClose,
}: {
  roomType: RoomType | "new";
  onClose: () => void;
}) {
  const { refresh, notify } = useApp(),
    t = roomType === "new" ? null : roomType,
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={t ? "Edit room type" : "Add room type"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget),
            body = {
              name: f.get("name"),
              description: f.get("description"),
              capacity: Number(f.get("capacity")),
              base_price_per_night: f.get("price"),
              is_active: f.get("active") === "on",
            };
          try {
            if (t) await put(`/room-types/${t.id}`, body);
            else await post("/room-types", body);
            refresh();
            notify("Room type saved. Existing booking prices are preserved.");
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name">
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={t?.name}
          />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            maxLength={2000}
            defaultValue={t?.description}
          />
        </Field>
        <div className="form-grid">
          <Field label="Guest capacity">
            <input
              type="number"
              name="capacity"
              min={1}
              max={20}
              required
              defaultValue={t?.capacity || 2}
            />
          </Field>
          <Field label="Nightly rate (SAR)">
            <input
              type="number"
              name="price"
              min={0.01}
              step={0.01}
              max={1000000}
              required
              defaultValue={t?.base_price_per_night || 450}
            />
          </Field>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="active"
            defaultChecked={t?.is_active ?? true}
          />
          Available for new reservations
        </label>
        <p className="tiny muted">
          Existing reservations keep their confirmed price. Explicit reservation
          modifications use the current rate.
        </p>
        <ErrorBox message={error} />
        <div className="modal-actions">
          <Button disabled={busy}>{busy ? "Saving…" : "Save room type"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function StaffUsers() {
  const { version } = useApp(),
    { data, loading, error } = useApi<User[]>("/users", version),
    [edit, setEdit] = useState<User | "new" | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="TEAM & ACCESS"
        title="Staff accounts"
        description="Give your team the right tools for their role."
        action={
          <Button onClick={() => setEdit("new")}>
            <Plus size={17} />
            Add staff member
          </Button>
        }
      />
      <section className="panel">
        <LoadState loading={loading} error={error} />
        {data && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .filter((u) => u.role !== "Guest")
                  .map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="guest-cell">
                          <span className="avatar small">
                            {initials(u.name)}
                          </span>
                          <strong>{u.name}</strong>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>
                        <Badge>{u.is_active ? "Active" : "Inactive"}</Badge>
                      </td>
                      <td>
                        {u.role !== "Admin" && (
                          <Button variant="quiet" onClick={() => setEdit(u)}>
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {edit && <StaffEditor staff={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
function StaffEditor({
  staff,
  onClose,
}: {
  staff: User | "new";
  onClose: () => void;
}) {
  const { refresh, notify } = useApp(),
    u = staff === "new" ? null : staff,
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={u ? "Edit staff member" : "Add staff member"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            if (u)
              await put(`/users/${u.id}`, {
                name: f.get("name"),
                is_active: f.get("active") === "on",
              });
            else
              await post("/users", {
                name: f.get("name"),
                email: f.get("email"),
                password: f.get("password"),
                role: f.get("role"),
              });
            refresh();
            notify("Staff account saved.");
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Full name">
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={u?.name}
          />
        </Field>
        {u ? (
          <label className="checkbox-label">
            <input type="checkbox" name="active" defaultChecked={u.is_active} />
            Active account
          </label>
        ) : (
          <>
            <Field label="Email address">
              <input name="email" type="email" required />
            </Field>
            <Field
              label="Password"
              hint="At least 10 characters, including letters and numbers."
            >
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </Field>
            <Field label="Role">
              <select name="role">
                <option>Receptionist</option>
                <option>Housekeeping</option>
              </select>
            </Field>
          </>
        )}
        <ErrorBox message={error} />
        <div className="modal-actions">
          <Button disabled={busy}>
            {busy ? "Saving…" : "Save staff member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function HotelSettings() {
  const { hotel, refresh, notify } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="HOTEL CONFIGURATION"
        title="Hotel settings"
        description="The essentials that keep your property running smoothly."
      />
      <section className="panel settings-panel">
        <div className="panel-heading">
          <h2>Property & operating hours</h2>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await put("/settings", Object.fromEntries(f));
              refresh();
              notify("Hotel settings saved.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Hotel name">
            <input
              name="hotel_name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={hotel.hotel_name}
            />
          </Field>
          <div className="form-grid">
            <Field label="Standard check-in time">
              <input
                name="check_in_time"
                type="time"
                required
                defaultValue={hotel.check_in_time.slice(0, 5)}
              />
            </Field>
            <Field label="Standard check-out time">
              <input
                name="check_out_time"
                type="time"
                required
                defaultValue={hotel.check_out_time.slice(0, 5)}
              />
            </Field>
          </div>
          <div className="info-line">
            All times use {hotel.timezone}. Check-out must be before check-in so
            rooms have time for cleaning and inspection.
          </div>
          <ErrorBox message={error} />
          <Button disabled={busy}>
            <Save size={16} />
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </section>
    </>
  );
}

export function Profile() {
  const { user, setUser, notify } = useApp(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="YOUR ACCOUNT"
        title="My profile"
        description="Keep your basic details up to date."
      />
      <section className="panel settings-panel">
        <div className="profile-intro">
          <span className="avatar large">{initials(user.name)}</span>
          <div>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <Badge>{user.role}</Badge>
          </div>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              const updated = await put<User>("/profile", {
                name: f.get("name"),
                phone: f.get("phone") || "",
              });
              setUser(updated);
              notify("Profile updated.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Full name">
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={user.name}
            />
          </Field>
          {user.role === "Guest" && (
            <Field label="Phone number">
              <input name="phone" maxLength={40} defaultValue={user.phone} />
            </Field>
          )}
          <ErrorBox message={error} />
          <Button disabled={busy}>
            <Save size={16} />
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </section>
    </>
  );
}
