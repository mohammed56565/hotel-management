import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Check,
  Search,
  Users,
} from "lucide-react";
import { api, post, put } from "./api";
import { useApp } from "./context";
import type { Guest, Reservation, Room, RoomType } from "./types";
import {
  addDays,
  Badge,
  Button,
  Confirm,
  Empty,
  ErrorBox,
  Field,
  Loading,
  money,
  PageTitle,
  useApi,
} from "./ui";

export function Booking({
  edit = false,
  walkIn = false,
}: {
  edit?: boolean;
  walkIn?: boolean;
}) {
  const { user, hotel, refresh, notify } = useApp(),
    { id } = useParams(),
    navigate = useNavigate();
  const [start, setStart] = useState(hotel.today),
    [end, setEnd] = useState(addDays(hotel.today, 1)),
    [count, setCount] = useState(2),
    [types, setTypes] = useState<RoomType[]>([]),
    [selected, setSelected] = useState<RoomType | null>(null),
    [searched, setSearched] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [guest, setGuest] = useState(0),
    [guests, setGuests] = useState<Guest[]>([]),
    [rooms, setRooms] = useState<Room[]>([]),
    [room, setRoom] = useState(0),
    [confirm, setConfirm] = useState(false),
    [original, setOriginal] = useState<Reservation | null>(null),
    [initialLoading, setInitialLoading] = useState(edit),
    [newGuest, setNewGuest] = useState(false),
    [guestName, setGuestName] = useState(""),
    [guestEmail, setGuestEmail] = useState(""),
    [guestPhone, setGuestPhone] = useState("");
  const staff = user.role !== "Guest",
    nights = Math.round(
      (new Date(end).getTime() - new Date(start).getTime()) / 86400000,
    );
  useEffect(() => {
    if (staff)
      api<Guest[]>("/guests")
        .then(setGuests)
        .catch((e) => setError(e.message));
    if (walkIn)
      api<Room[]>("/rooms")
        .then(setRooms)
        .catch((e) => setError(e.message));
    if (edit)
      api<Reservation>(`/reservations/${id}`)
        .then((r) => {
          setOriginal(r);
          setStart(r.check_in_date);
          setEnd(r.check_out_date);
          setCount(r.guest_count);
          setGuest(r.guest_id);
          return api<RoomType[]>("/room-types");
        })
        .then((items) => {
          setTypes(items);
          setSearched(true);
        })
        .catch((e) => setError(e.message))
        .finally(() => setInitialLoading(false));
  }, [staff, walkIn, edit, id]);
  const invalidate = () => {
    setSelected(null);
    setSearched(false);
    setRoom(0);
  };
  async function search(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSelected(null);
    try {
      if (edit) {
        const items = await api<RoomType[]>("/room-types");
        setTypes(items.filter((t) => t.capacity >= count));
      } else {
        setTypes(
          await api<RoomType[]>(
            `/availability?check_in_date=${start}&check_out_date=${end}&guest_count=${count}`,
          ),
        );
      }
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!selected) throw new Error("Choose a room type.");
    let guestId = guest;
    if (staff && !edit && newGuest) {
      if (!guestName.trim()) throw new Error("Enter the guest’s full name.");
      const created = await post<Guest>("/guests", {
        name: guestName,
        email: guestEmail || null,
        phone: guestPhone,
      });
      guestId = created.id;
      setGuest(guestId);
      setGuests((g) => [...g, created]);
      setNewGuest(false);
    }
    const payload = {
      room_type_id: selected.id,
      check_in_date: start,
      check_out_date: end,
      guest_count: count,
    };
    const result = edit
      ? await put<Reservation>(`/reservations/${id}`, payload)
      : await post<Reservation>(walkIn ? "/walk-ins" : "/reservations", {
          ...payload,
          ...(staff ? { guest_id: guestId } : {}),
          ...(walkIn ? { room_id: room } : {}),
        });
    refresh();
    notify(
      edit
        ? "Reservation updated successfully."
        : walkIn
          ? "Walk-in guest checked in successfully."
          : "Reservation confirmed.",
    );
    navigate(`/reservations/${result.id}`);
  }
  const readyRooms = rooms.filter(
    (r) => r.is_ready && r.room_type_id === selected?.id,
  );
  if (initialLoading) return <Loading />;
  return (
    <>
      <Link
        className="back-link"
        to={edit ? `/reservations/${id}` : "/reservations"}
      >
        <ArrowLeft size={16} />
        Back to reservations
      </Link>
      <PageTitle
        eyebrow={
          walkIn
            ? "FRONT DESK · WALK-IN"
            : edit
              ? original?.reference
              : "A STAY TO LOOK FORWARD TO"
        }
        title={
          edit
            ? "Modify reservation"
            : walkIn
              ? "Welcome a walk-in"
              : "Find the right room"
        }
        description={
          edit
            ? "Choose the updated stay. We’ll validate availability before changing your reservation."
            : walkIn
              ? "Create a stay, assign a ready room, and check your guest in."
              : "Choose your dates. We’ll take care of the details."
        }
      />
      <form className="search-stay panel" onSubmit={search}>
        <Field label="Check-in">
          <input
            type="date"
            required
            min={hotel.today}
            value={start}
            disabled={walkIn}
            onChange={(e) => {
              setStart(e.target.value);
              if (e.target.value >= end) setEnd(addDays(e.target.value, 1));
              invalidate();
            }}
          />
        </Field>
        <Field label="Check-out">
          <input
            type="date"
            required
            min={addDays(start, 1)}
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              invalidate();
            }}
          />
        </Field>
        <Field label="Guests">
          <select
            value={count}
            onChange={(e) => {
              setCount(+e.target.value);
              invalidate();
            }}
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </Field>
        <Button disabled={busy}>
          <Search size={17} />
          {busy ? "Searching…" : "Search rooms"}
        </Button>
      </form>
      <ErrorBox message={error} />
      {edit && (
        <p className="info-line">
          Available room types are shown below. Inventory is rechecked on
          confirmation, excluding your existing reservation.
        </p>
      )}
      {searched ? (
        <div className="booking-grid">
          <div className="room-type-results">
            {types.length ? (
              types.map((t, i) => (
                <article
                  key={t.id}
                  className={
                    "room-type-card " +
                    (selected?.id === t.id ? "selected" : "")
                  }
                >
                  <div
                    className={"room-illustration tone-" + (i % 4)}
                    aria-hidden="true"
                  >
                    <div className="room-window" />
                    <div className="illustrated-bed">
                      <i />
                      <i />
                    </div>
                    <div className="room-lamp" />
                    <span>
                      {t.name.includes("Suite")
                        ? "SPACE TO UNWIND"
                        : "THOUGHTFULLY APPOINTED"}
                    </span>
                  </div>
                  <div className="room-type-copy">
                    <div className="room-type-top">
                      <h2>{t.name}</h2>
                      {selected?.id === t.id && (
                        <span className="selected-mark">
                          <Check size={15} />
                        </span>
                      )}
                    </div>
                    <p>{t.description}</p>
                    <div className="room-capacity">
                      <Users size={16} />
                      Up to {t.capacity} guests
                      <BedDouble size={16} />
                      One room
                    </div>
                    <div className="room-type-bottom">
                      <div>
                        <strong>{money(t.base_price_per_night)}</strong>
                        <span> / night</span>
                        <small>
                          {t.available_rooms !== undefined
                            ? `${t.available_rooms} rooms available`
                            : "Availability checked on confirmation"}
                        </small>
                      </div>
                      <Button
                        variant={
                          selected?.id === t.id ? "primary" : "secondary"
                        }
                        onClick={() => {
                          setSelected(t);
                          setRoom(0);
                        }}
                      >
                        {selected?.id === t.id ? "Selected" : "Select room"}
                        {selected?.id === t.id ? (
                          <Check size={15} />
                        ) : (
                          <ArrowRight size={15} />
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="panel">
                <Empty
                  title="No rooms for these dates"
                  text="Try another date range or a smaller party size."
                />
              </div>
            )}
          </div>
          <aside>
            <section className="panel booking-summary">
              <div className="panel-heading">
                <h2>{edit ? "Updated stay" : "Your stay"}</h2>
              </div>
              {selected ? (
                <>
                  <div className="summary-room">
                    <BedDouble size={24} />
                    <div>
                      <strong>{selected.name}</strong>
                      <p>
                        {nights} nights · {count} guests
                      </p>
                    </div>
                  </div>
                  <div className="cost-line">
                    <span>Nightly rate</span>
                    <strong>{money(selected.base_price_per_night)}</strong>
                  </div>
                  <div className="cost-total">
                    <span>Total stay cost</span>
                    <strong>
                      {money(Number(selected.base_price_per_night) * nights)}
                    </strong>
                  </div>
                  {staff && !edit && (
                    <div className="booking-guest">
                      <div className="segmented">
                        <button
                          className={!newGuest ? "active" : ""}
                          onClick={() => setNewGuest(false)}
                        >
                          Existing guest
                        </button>
                        <button
                          className={newGuest ? "active" : ""}
                          onClick={() => setNewGuest(true)}
                        >
                          New guest
                        </button>
                      </div>
                      {newGuest ? (
                        <>
                          <Field label="Guest full name">
                            <input
                              required
                              minLength={2}
                              value={guestName}
                              onChange={(e) => setGuestName(e.target.value)}
                            />
                          </Field>
                          <Field label="Email (optional)">
                            <input
                              type="email"
                              value={guestEmail}
                              onChange={(e) => setGuestEmail(e.target.value)}
                            />
                          </Field>
                          <Field label="Phone (optional)">
                            <input
                              value={guestPhone}
                              onChange={(e) => setGuestPhone(e.target.value)}
                            />
                          </Field>
                        </>
                      ) : (
                        <Field label="Guest">
                          <select
                            value={guest}
                            onChange={(e) => setGuest(+e.target.value)}
                          >
                            <option value={0}>Select a guest</option>
                            {guests.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name} {g.email ? `· ${g.email}` : ""}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </div>
                  )}
                  {walkIn && (
                    <Field label="Ready room">
                      <select
                        value={room}
                        onChange={(e) => setRoom(+e.target.value)}
                      >
                        <option value={0}>Select a ready room</option>
                        {readyRooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            Room {r.room_number} · Floor {r.floor}
                          </option>
                        ))}
                      </select>
                      {!readyRooms.length && (
                        <small>No ready rooms for this type.</small>
                      )}
                    </Field>
                  )}
                  <Button
                    className="full"
                    disabled={
                      (staff &&
                        !edit &&
                        !(newGuest ? guestName.trim().length >= 2 : guest)) ||
                      (walkIn && !room) ||
                      nights <= 0
                    }
                    onClick={() => setConfirm(true)}
                  >
                    {edit
                      ? "Review changes"
                      : walkIn
                        ? "Create & check in"
                        : "Confirm reservation"}
                    <ArrowRight size={16} />
                  </Button>
                  <p className="tiny muted">
                    {walkIn
                      ? `Check-in opens at ${hotel.check_in_time.slice(0, 5)} hotel time. `
                      : ""}
                    No online payment is collected.{" "}
                    {user.role === "Guest"
                      ? "Reception will assign your room number."
                      : ""}
                  </p>
                </>
              ) : (
                <Empty
                  title="Choose your room"
                  text="Your stay summary will appear here."
                />
              )}
            </section>
          </aside>
        </div>
      ) : (
        <div className="search-prompt">
          <div className="empty-icon">
            <BedDouble size={28} />
          </div>
          <h2>A good stay starts here.</h2>
          <p>Search your dates to discover available rooms.</p>
        </div>
      )}
      {confirm && (
        <Confirm
          title={
            edit
              ? "Apply reservation changes?"
              : walkIn
                ? "Check in this walk-in guest?"
                : "Confirm your stay?"
          }
          text={`${selected?.name} · ${start} to ${end} · ${count} guests. Total: ${money(Number(selected?.base_price_per_night) * nights)}.${edit ? " The current nightly rate will apply. Changes to dates or room type clear the physical room assignment." : ""}`}
          onClose={() => setConfirm(false)}
          onConfirm={save}
        />
      )}
    </>
  );
}
