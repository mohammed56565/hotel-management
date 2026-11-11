import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  Clock,
  Edit3,
  Plus,
  Search,
} from "lucide-react";
import { useApp } from "./context";
import { post } from "./api";
import type { Reservation, Room } from "./types";
import {
  Badge,
  Button,
  Confirm,
  day,
  Empty,
  ErrorBox,
  LoadState,
  Modal,
  money,
  PageTitle,
  useApi,
} from "./ui";
import { ReservationRows } from "./Dashboard";

export function Reservations() {
  const { user, hotel, version } = useApp(),
    [params, setParams] = useSearchParams(),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("");
  const view = params.get("view") || "all",
    navigate = useNavigate();
  const { data, loading, error } = useApi<Reservation[]>(
    "/reservations" +
      (view === "arrivals"
        ? `?arrival=${hotel.today}`
        : view === "departures"
          ? `?departure=${hotel.today}`
          : ""),
    version,
  );
  const filtered = (data || []).filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.guest_name} ${r.reference} ${r.room_number || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow={user.role === "Guest" ? "YOUR STAYS" : "FRONT DESK"}
        title={user.role === "Guest" ? "My reservations" : "Reservations"}
        description="Every stay, from the first hello to the next goodbye."
        action={
          <Button onClick={() => navigate("/book")}>
            <Plus size={17} />
            {user.role === "Guest" ? "Book a stay" : "New reservation"}
          </Button>
        }
      />
      <section className="panel">
        {user.role !== "Guest" && (
          <div className="tabs">
            {[
              ["all", "All reservations"],
              ["arrivals", "Today’s arrivals"],
              ["departures", "Today’s departures"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={view === key ? "active" : ""}
                onClick={() => setParams(key === "all" ? {} : { view: key })}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search reservations"
              placeholder="Search guest, reference, or room…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter reservation status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "Confirmed",
              "Checked In",
              "Checked Out",
              "Cancelled",
              "No-show",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="result-count">{filtered.length} reservations</span>
        </div>
        {loading || error ? (
          <LoadState loading={loading} error={error} />
        ) : (
          <ReservationRows
            rows={filtered}
            empty="No reservations match these filters."
          />
        )}
      </section>
    </>
  );
}

export function ReservationDetail() {
  const { id } = useParams(),
    { user, hotel, version, refresh, notify } = useApp(),
    navigate = useNavigate();
  const {
    data: r,
    loading,
    error,
  } = useApi<Reservation>(`/reservations/${id}`, version);
  const [confirm, setConfirm] = useState<{
      action: string;
      title: string;
      text: string;
      danger?: boolean;
    } | null>(null),
    [assign, setAssign] = useState(false);
  const staff = user.role === "Admin" || user.role === "Receptionist";
  if (loading || error || !r)
    return <LoadState loading={loading} error={error} />;
  const editable =
    r.status === "Confirmed" &&
    (staff ||
      `${r.check_in_date}T${hotel.check_in_time}` >
        hotel.local_time.slice(0, 19));
  const actions = [
    {
      action: "check-in",
      title: "Check guest in",
      text: "Confirm that the guest has arrived. The assigned room must be vacant, inspected, and in service.",
    },
    {
      action: "check-out",
      title: "Check guest out",
      text: "This completes the stay, marks the room vacant and dirty, and creates a housekeeping task.",
    },
    {
      action: "cancel",
      title: "Cancel this reservation?",
      text: "The reservation will remain in history and its inventory will become available again.",
      danger: true,
    },
    {
      action: "no-show",
      title: "Mark guest as a no-show?",
      text: "Use this only after the scheduled arrival time. This releases the booking’s inventory and preserves its history.",
      danger: true,
    },
  ];
  const ask = (action: string) =>
    setConfirm(actions.find((a) => a.action === action)!);
  return (
    <>
      <Link className="back-link" to="/reservations">
        <ArrowLeft size={16} />
        All reservations
      </Link>
      <PageTitle
        eyebrow={r.reference}
        title={r.guest_name}
        description={`${r.room_type_name} · ${r.number_of_nights} ${r.number_of_nights === 1 ? "night" : "nights"} at ${hotel.hotel_name}`}
        action={<Badge>{r.status}</Badge>}
      />
      <div className="detail-grid">
        <div>
          <section className="panel detail-panel">
            <div className="panel-heading">
              <h2>Stay details</h2>
              {editable && (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/reservations/${r.id}/edit`)}
                >
                  <Edit3 size={15} />
                  Modify stay
                </Button>
              )}
            </div>
            <div className="stay-dates">
              <div>
                <span>
                  <CalendarDays size={16} />
                  CHECK-IN
                </span>
                <strong>{day(r.check_in_date)}</strong>
                <small>
                  {r.check_in_date.slice(0, 4)} · from{" "}
                  {hotel.check_in_time.slice(0, 5)}
                </small>
              </div>
              <ArrowRight size={23} />
              <div>
                <span>
                  <CalendarDays size={16} />
                  CHECK-OUT
                </span>
                <strong>{day(r.check_out_date)}</strong>
                <small>
                  {r.check_out_date.slice(0, 4)} · by{" "}
                  {hotel.check_out_time.slice(0, 5)}
                </small>
              </div>
            </div>
            <div className="detail-facts">
              <div>
                <span>Guest</span>
                <strong>{r.guest_name}</strong>
                <small>{r.guest_email || "No email recorded"}</small>
              </div>
              <div>
                <span>Party size</span>
                <strong>{r.guest_count} guests</strong>
                <small>One room per reservation</small>
              </div>
              <div>
                <span>Room type</span>
                <strong>{r.room_type_name}</strong>
              </div>
              <div>
                <span>Room number</span>
                <strong>{r.room_number || "To be assigned"}</strong>
              </div>
            </div>
          </section>
          <section className="panel detail-panel">
            <div className="panel-heading">
              <h2>Room assignment</h2>
              {staff && r.status === "Confirmed" && (
                <Button variant="secondary" onClick={() => setAssign(true)}>
                  <BedDouble size={16} />
                  {r.room_number ? "Change room" : "Assign room"}
                </Button>
              )}
            </div>
            <div className="assignment-summary">
              <span className="room-number-box large">
                {r.room_number || "—"}
              </span>
              <div>
                <h3>
                  {r.room_number
                    ? `Room ${r.room_number}`
                    : "Your room is being prepared"}
                </h3>
                <p>
                  {r.room_number
                    ? r.room_ready
                      ? "Vacant, inspected, and in service."
                      : "Room readiness is verified before check-in."
                    : "Reception will assign a room from your reserved room type."}
                </p>
                {r.status === "Confirmed" && r.room_number && (
                  <Badge>{r.room_ready ? "Ready" : "Not ready"}</Badge>
                )}
              </div>
            </div>
          </section>
          <section className="panel detail-panel">
            <div className="panel-heading">
              <h2>Stay history</h2>
            </div>
            <div className="timeline">
              {[
                ["Reservation created", r.created_at],
                ["Checked in", r.checked_in_at],
                ["Checked out", r.checked_out_at],
                ["Cancelled", r.cancelled_at],
                ["Marked no-show", r.no_show_at],
              ]
                .filter(([, t]) => t)
                .map(([label, t]) => (
                  <div key={label}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>{label}</strong>
                      <p>
                        {new Date(t!).toLocaleString("en-GB", {
                          timeZone: hotel.timezone,
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>
        <aside>
          <section className="panel cost-panel">
            <div className="panel-heading">
              <h2>Stay summary</h2>
            </div>
            <div className="cost-line">
              <span>
                {money(r.price_per_night)} × {r.number_of_nights} nights
              </span>
              <strong>{money(r.total_stay_cost)}</strong>
            </div>
            <div className="cost-total">
              <span>Total stay cost</span>
              <strong>{money(r.total_stay_cost)}</strong>
            </div>
            <p className="tiny muted">
              Your confirmed nightly rate is saved with this reservation. This
              is an informational stay cost.
            </p>
            <div className="detail-actions">
              {staff && r.status === "Confirmed" && (
                <Button
                  disabled={
                    !r.assigned_room_id ||
                    !r.room_ready ||
                    r.check_in_date !== hotel.today ||
                    hotel.local_time.slice(11, 19) < hotel.check_in_time
                  }
                  onClick={() => ask("check-in")}
                >
                  <Check size={17} />
                  Check guest in
                </Button>
              )}
              {staff &&
                r.status === "Confirmed" &&
                (!r.room_ready || !r.assigned_room_id) && (
                  <p className="tiny muted">
                    Assign a ready room to enable check-in.
                  </p>
                )}
              {staff &&
                r.status === "Confirmed" &&
                hotel.local_time.slice(11, 19) < hotel.check_in_time && (
                  <p className="tiny muted">
                    Check-in opens at {hotel.check_in_time.slice(0, 5)} hotel
                    time.
                  </p>
                )}
              {staff && r.status === "Checked In" && (
                <Button onClick={() => ask("check-out")}>
                  <ArrowRight size={17} />
                  Check guest out
                </Button>
              )}
              {editable && (
                <Button variant="secondary" onClick={() => ask("cancel")}>
                  Cancel reservation
                </Button>
              )}
              {staff && r.status === "Confirmed" && (
                <Button variant="quiet" onClick={() => ask("no-show")}>
                  Mark as no-show
                </Button>
              )}
            </div>
          </section>
          <div className="help-note">
            <Clock size={19} />
            <p>
              Hotel time: {hotel.timezone}
              <br />
              Check-in {hotel.check_in_time.slice(0, 5)} · Check-out{" "}
              {hotel.check_out_time.slice(0, 5)}
            </p>
          </div>
        </aside>
      </div>
      {assign && (
        <Assignment reservation={r} onClose={() => setAssign(false)} />
      )}{" "}
      {confirm && (
        <Confirm
          {...confirm}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await post(`/reservations/${r.id}/${confirm.action}`);
            refresh();
            notify("Reservation updated successfully.");
          }}
        />
      )}
    </>
  );
}

function Assignment({
  reservation: r,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const { refresh, notify } = useApp(),
    { data, loading, error } = useApi<Room[]>(`/reservations/${r.id}/rooms`),
    [selected, setSelected] = useState(r.assigned_room_id || 0),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  return (
    <Modal
      title="Assign a room"
      description={`${r.room_type_name} · ${day(r.check_in_date)} — ${day(r.check_out_date)}`}
      onClose={onClose}
    >
      <LoadState loading={loading} error={error} />
      {data?.length ? (
        <div className="room-choices">
          {data.map((room) => (
            <button
              key={room.id}
              className={
                "room-choice " + (selected === room.id ? "selected" : "")
              }
              onClick={() => setSelected(room.id)}
            >
              <span className="room-number-box">{room.room_number}</span>
              <span>
                <strong>Floor {room.floor}</strong>
                <small>
                  {room.occupancy_status} · {room.housekeeping_status}
                </small>
              </span>
              <Badge>{room.is_ready ? "Ready" : "Not ready"}</Badge>
            </button>
          ))}
        </div>
      ) : (
        !loading && (
          <Empty
            title="No assignable rooms"
            text="Check existing assignments and operational availability."
          />
        )
      )}
      <p className="tiny muted">
        A future assignment may use a room still awaiting turnover. Check-in
        always requires a ready room.
      </p>
      <ErrorBox message={failure} />
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Go back
        </Button>
        <Button
          disabled={!selected || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await post(`/reservations/${r.id}/assign`, { room_id: selected });
              refresh();
              notify("Room assigned successfully.");
              onClose();
            } catch (e) {
              setFailure((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Assigning…" : "Assign room"}
        </Button>
      </div>
    </Modal>
  );
}
