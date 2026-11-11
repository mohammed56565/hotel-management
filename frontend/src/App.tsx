import { useEffect, useState, type FormEvent } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  DoorOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { api, post, setToken } from "./api";
import { Provider } from "./context";
import type { Hotel, User } from "./types";
import { Button, ErrorBox, Field, initials, Loading } from "./ui";
import { Dashboard } from "./Dashboard";
import { Reservations, ReservationDetail } from "./Reservations";
import { Booking } from "./Booking";
import { Rooms, Housekeeping, Issues } from "./Operations";
import { Guests, RoomTypes, StaffUsers, HotelSettings, Profile } from "./Admin";

export default function App() {
  return (
    <BrowserRouter>
      <Session />
    </BrowserRouter>
  );
}

function Session() {
  const [user, setUser] = useState<User | null>(null),
    [hotel, setHotel] = useState<Hotel | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [toast, setToast] = useState("");
  useEffect(() => {
    api<Hotel>("/settings")
      .then(setHotel)
      .catch((e) => setError(e.message));
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
    const expired = () => setUser(null);
    window.addEventListener("haven-session-expired", expired);
    return () => window.removeEventListener("haven-session-expired", expired);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const timer = setInterval(
      () =>
        api<Hotel>("/settings")
          .then(setHotel)
          .catch(() => {}),
      30000,
    );
    return () => clearInterval(timer);
  }, []);
  const refresh = () => {
    setVersion((v) => v + 1);
    api<Hotel>("/settings")
      .then(setHotel)
      .catch(() => {});
  };
  if (loading) return <Loading />;
  if (!hotel)
    return (
      <div className="connection-error">
        <h1>Let’s reconnect.</h1>
        <ErrorBox message={error || "Hotel information is unavailable."} />
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  if (!user) return <Auth hotel={hotel} onLogin={setUser} />;
  return (
    <Provider
      value={{ user, hotel, refresh, version, notify: setToast, setUser }}
    >
      <Shell
        onLogout={async () => {
          try {
            await post("/auth/logout");
            setToken("");
            setUser(null);
          } catch (e) {
            setToast((e as Error).message);
          }
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Provider>
  );
}

function Auth({
  hotel,
  onLogin,
}: {
  hotel: Hotel;
  onLogin: (u: User) => void;
}) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const data = await post<{ access_token: string; user: User }>(
        register ? "/auth/register" : "/auth/login",
        values,
      );
      setToken(data.access_token);
      onLogin(data.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Link to="/" className="brand">
          <span className="brand-symbol">h</span>
          <span>
            haven<span className="brand-caption">HOTEL MANAGEMENT</span>
          </span>
        </Link>
        <div className="auth-message">
          <div className="eyebrow">A LITTLE MORE HOSPITALITY</div>
          <h1>
            Great stays.
            <br />
            Thoughtfully
            <br />
            <em>managed.</em>
          </h1>
          <p>A calmer day at the front desk. A warm welcome for every guest.</p>
        </div>
        <div className="arch-art" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
        <div className="auth-foot">
          {hotel.hotel_name}
          <span>Single property. Every detail.</span>
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <div className="eyebrow">WELCOME TO HAVEN</div>
          <h2>{register ? "Make yourself at home." : "Welcome back."}</h2>
          <p>
            {register
              ? "Create your guest account to book your next stay."
              : "Sign in to your hotel workspace."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <Field label="Full name">
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Your full name"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Password"
              hint={
                register
                  ? "At least 10 characters, including letters and numbers."
                  : undefined
              }
            >
              <input
                type="password"
                name="password"
                required
                minLength={register ? 10 : 1}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="Enter your password"
              />
            </Field>
            <ErrorBox message={error} />
            <Button disabled={busy} className="full">
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="auth-switch">
            {register ? "Already have an account?" : "Planning a stay?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create a guest account"}
            </button>
          </div>
          <div className="auth-trust">
            <ShieldCheck size={17} />
            Your stay, securely managed.
          </div>
        </div>
      </div>
    </div>
  );
}

import { useApp } from "./context";
function Shell({ onLogout }: { onLogout: () => void }) {
  const { user, hotel } = useApp(),
    [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => setMenu(false), [location.pathname]);
  const staff = user.role === "Admin" || user.role === "Receptionist";
  const nav = staff
    ? [
        { to: "/", label: "Overview", icon: LayoutDashboard },
        { to: "/reservations", label: "Reservations", icon: CalendarDays },
        { to: "/rooms", label: "Room board", icon: BedDouble },
        { to: "/guests", label: "Guests", icon: Users },
        { to: "/housekeeping", label: "Housekeeping", icon: Sparkles },
        { to: "/issues", label: "Room issues", icon: ShieldCheck },
      ]
    : user.role === "Guest"
      ? [
          { to: "/", label: "My overview", icon: LayoutDashboard },
          { to: "/book", label: "Find a room", icon: BedDouble },
          { to: "/reservations", label: "My reservations", icon: CalendarDays },
        ]
      : [
          { to: "/", label: "My overview", icon: LayoutDashboard },
          { to: "/housekeeping", label: "My tasks", icon: Sparkles },
          { to: "/issues", label: "Room issues", icon: ShieldCheck },
        ];
  return (
    <div className="app-shell">
      {menu && <div className="mobile-scrim" onClick={() => setMenu(false)} />}
      <aside className={"sidebar " + (menu ? "is-open" : "")}>
        <Link to="/" className="brand">
          <span className="brand-symbol">h</span>
          <span>
            haven<span className="brand-caption">HOTEL MANAGEMENT</span>
          </span>
        </Link>
        <div className="property">
          <div className="property-mark">
            <BedDouble size={19} />
          </div>
          <div>
            <strong>{hotel.hotel_name}</strong>
            <span>{hotel.timezone.replace("_", " ")}</span>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              <n.icon size={19} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        {user.role === "Admin" && (
          <>
            <div className="nav-label configuration-label">CONFIGURATION</div>
            <nav>
              <NavLink to="/room-types">
                <DoorOpen size={19} />
                Room types
              </NavLink>
              <NavLink to="/users">
                <Users size={19} />
                Staff accounts
              </NavLink>
              <NavLink to="/settings">
                <Settings size={19} />
                Hotel settings
              </NavLink>
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="operating-times">
            <span>HOTEL HOURS</span>
            <p>
              Check-in <strong>{hotel.check_in_time.slice(0, 5)}</strong>
            </p>
            <p>
              Check-out <strong>{hotel.check_out_time.slice(0, 5)}</strong>
            </p>
          </div>
          <Link to="/profile" className="user-block">
            <span className="avatar">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>
                {user.role === "Housekeeping"
                  ? "Housekeeping staff"
                  : user.role}
              </small>
            </span>
            <ChevronDown size={14} />
          </Link>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {location.pathname === "/"
                  ? "Overview"
                  : location.pathname.split("/")[1].replaceAll("-", " ")}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="today-pill">
              <span />
              {new Date(hotel.today + "T12:00:00").toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={onLogout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {user.role !== "Housekeeping" && (
              <>
                <Route path="/reservations" element={<Reservations />} />
                <Route
                  path="/reservations/:id"
                  element={<ReservationDetail />}
                />
                <Route path="/book" element={<Booking />} />
                <Route
                  path="/reservations/:id/edit"
                  element={<Booking edit />}
                />
              </>
            )}
            {staff && (
              <>
                <Route path="/rooms" element={<Rooms />} />
                <Route path="/guests" element={<Guests />} />
                <Route path="/walk-in" element={<Booking walkIn />} />
              </>
            )}
            {user.role !== "Guest" && (
              <>
                <Route path="/housekeeping" element={<Housekeeping />} />
                <Route path="/issues" element={<Issues />} />
              </>
            )}
            {user.role === "Admin" && (
              <>
                <Route path="/room-types" element={<RoomTypes />} />
                <Route path="/users" element={<StaffUsers />} />
                <Route path="/settings" element={<HotelSettings />} />
              </>
            )}
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>Haven · A little more hospitality</span>
          <span>{hotel.hotel_name}</span>
        </footer>
      </div>
    </div>
  );
}
