import {
  ArrowDownLeft,
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Plus,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "./context";
import type { DashboardData, Reservation } from "./types";
import {
  Badge,
  Button,
  day,
  Empty,
  LoadState,
  longDay,
  PageTitle,
  Stat,
  TextLink,
  useApi,
} from "./ui";

export function Dashboard() {
  const { user, hotel, version } = useApp(),
    { data, loading, error } = useApi<DashboardData>("/dashboard", version),
    navigate = useNavigate();
  if (loading || error || !data)
    return <LoadState loading={loading} error={error} />;
  const staff = user.role === "Admin" || user.role === "Receptionist";
  const hour = Number(hotel.local_time.slice(11, 13));
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  if (user.role === "Guest") {
    const reservations = data.reservations || [],
      upcoming = reservations.filter(
        (r) => r.status === "Confirmed" && r.check_out_date > hotel.today,
      ),
      current = reservations.find((r) => r.status === "Checked In");
    return (
      <>
        <PageTitle
          eyebrow="YOUR STAY, AT A GLANCE"
          title={`${greeting}, ${user.name.split(" ")[0]}.`}
          description="A little space to unwind. Everything you need for your next stay."
          action={
            <Button onClick={() => navigate("/book")}>
              <Plus size={17} />
              Book a stay
            </Button>
          }
        />
        <div className="guest-welcome">
          <div>
            <div className="eyebrow">MAKE YOURSELF AT HOME</div>
            <h2>
              Your next chapter
              <br />
              starts with a good stay.
            </h2>
            <p>
              Thoughtful rooms. A warm welcome.
              <br />
              Find your place at {hotel.hotel_name}.
            </p>
            <Button onClick={() => navigate("/book")}>
              Explore available rooms
              <ArrowUpRight size={17} />
            </Button>
          </div>
          <div className="welcome-arches" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="stats-grid three">
          <Stat
            label="Upcoming stays"
            value={upcoming.length}
            sub="Something to look forward to"
            icon={<CalendarDays size={18} />}
          />
          <Stat
            label="Current stay"
            value={current ? `Room ${current.room_number}` : "—"}
            sub={
              current
                ? `Until ${day(current.check_out_date)}`
                : "We look forward to welcoming you"
            }
            icon={<BedDouble size={18} />}
          />
          <Stat
            label="Past stays"
            value={
              reservations.filter((r) => r.status === "Checked Out").length
            }
            sub="Your moments at Haven"
            icon={<Check size={18} />}
          />
        </div>
        <section className="panel">
          <div className="panel-heading">
            <h2>Your reservations</h2>
            <TextLink onClick={() => navigate("/reservations")}>
              View all
            </TextLink>
          </div>
          <ReservationRows rows={reservations.slice(0, 5)} />
        </section>
      </>
    );
  }
  if (user.role === "Housekeeping") {
    const tasks = data.tasks || [];
    return (
      <>
        <PageTitle
          eyebrow="HOUSEKEEPING"
          title={`${greeting}, ${user.name.split(" ")[0]}.`}
          description="A fresh start for every room. Here’s your work for today."
        />
        <div className="stats-grid three">
          <Stat
            label="Ready to start"
            value={tasks.filter((t) => t.status === "Open").length}
            sub="Assigned cleaning tasks"
            icon={<Clock size={18} />}
            accent
          />
          <Stat
            label="In progress"
            value={tasks.filter((t) => t.status === "In Progress").length}
            sub="Rooms you’re working on"
            icon={<Sparkles size={18} />}
          />
          <Stat
            label="Completed"
            value={tasks.filter((t) => t.status === "Completed").length}
            sub="Ready for reception to inspect"
            icon={<Check size={18} />}
          />
        </div>
        <section className="panel">
          <div className="panel-heading">
            <h2>Your next rooms</h2>
            <TextLink onClick={() => navigate("/housekeeping")}>
              View tasks
            </TextLink>
          </div>
          {tasks.filter((t) => t.status !== "Completed").length ? (
            tasks
              .filter((t) => t.status !== "Completed")
              .slice(0, 5)
              .map((t) => (
                <Link className="task-summary" key={t.id} to="/housekeeping">
                  <div className="room-number-box">{t.room_number}</div>
                  <div>
                    <strong>{t.room_type_name}</strong>
                    <p>
                      Floor {t.floor} · {t.priority} priority
                    </p>
                  </div>
                  <Badge>{t.status}</Badge>
                  <ChevronRight size={18} />
                </Link>
              ))
          ) : (
            <Empty
              title="All caught up"
              text="No open tasks are assigned to you."
            />
          )}
        </section>
      </>
    );
  }
  const c = data.counts!,
    occupancy = c.total ? Math.round((c.occupied / c.total) * 100) : 0;
  return (
    <>
      <PageTitle
        eyebrow={longDay(hotel.today).toUpperCase()}
        title={`${greeting}, ${user.name.split(" ")[0]}.`}
        description="Here’s what’s happening at your hotel today."
        action={
          <div className="button-row">
            <Button variant="secondary" onClick={() => navigate("/walk-in")}>
              <ArrowDownLeft size={17} />
              Walk-in
            </Button>
            <Button onClick={() => navigate("/book")}>
              <Plus size={17} />
              New reservation
            </Button>
          </div>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Occupied rooms"
          value={
            (
              <>
                {c.occupied}
                <small> / {c.total}</small>
              </>
            )
          }
          sub={`${occupancy}% occupancy today`}
          icon={<BedDouble size={19} />}
          accent
        />
        <Stat
          label="Expected arrivals"
          value={data.arrivals!.filter((r) => r.status === "Confirmed").length}
          sub={`${c.checked_in_today} checked in today`}
          icon={<ArrowDownLeft size={19} />}
        />
        <Stat
          label="Expected departures"
          value={data.departures!.length}
          sub={`${c.checked_out_today} checked out today`}
          icon={<ArrowUpRight size={19} />}
        />
        <Stat
          label="Ready for guests"
          value={c.ready}
          sub={`${c.clean} awaiting inspection`}
          icon={<ShieldReady />}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel arrivals-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Today’s arrivals{" "}
                <span className="count-chip">{data.arrivals!.length}</span>
              </h2>
              <p>A warm welcome starts here.</p>
            </div>
            <TextLink onClick={() => navigate("/reservations?view=arrivals")}>
              View all
            </TextLink>
          </div>
          <ReservationRows
            rows={data.arrivals!.slice(0, 5)}
            empty="No arrivals scheduled for today."
          />
        </section>
        <section className="panel room-snapshot">
          <div className="panel-heading">
            <h2>Room snapshot</h2>
            <TextLink onClick={() => navigate("/rooms")}>Room board</TextLink>
          </div>
          <div
            className="occupancy-ring"
            style={{
              background: `conic-gradient(#214f43 ${occupancy}%, #edf0e9 0)`,
            }}
          >
            <div>
              <strong>
                {occupancy}
                <small>%</small>
              </strong>
              <span>OCCUPANCY</span>
            </div>
          </div>
          <div className="snapshot-legend">
            <span>
              <i className="dot occupied" />
              Occupied <strong>{c.occupied}</strong>
            </span>
            <span>
              <i className="dot ready" />
              Vacant & ready <strong>{c.ready}</strong>
            </span>
            <span>
              <i className="dot dirty" />
              Needs cleaning <strong>{c.dirty}</strong>
            </span>
            <span>
              <i className="dot clean" />
              Awaiting inspection <strong>{c.clean}</strong>
            </span>
            <span>
              <i className="dot out" />
              Out of order <strong>{c.out_of_order}</strong>
            </span>
          </div>
          <p className="tiny muted">
            Room conditions are tracked independently.
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Room readiness</h2>
              <p>Every detail, ready for the next guest.</p>
            </div>
            <TextLink onClick={() => navigate("/rooms")}>Manage rooms</TextLink>
          </div>
          <div className="mini-rooms">
            {data.rooms!.slice(0, 16).map((r) => (
              <Link
                to="/rooms"
                title={`${r.room_number}: ${r.occupancy_status}, ${r.housekeeping_status}, ${r.operational_status}`}
                key={r.id}
                className={
                  "mini-room " +
                  (r.operational_status === "Out of Order"
                    ? "out"
                    : r.occupancy_status === "Occupied"
                      ? "occupied"
                      : r.is_ready
                        ? "ready"
                        : r.housekeeping_status === "Dirty"
                          ? "dirty"
                          : "clean")
                }
              >
                <BedDouble size={18} />
                <strong>{r.room_number}</strong>
                <span>
                  {r.operational_status === "Out of Order"
                    ? "Out of order"
                    : r.occupancy_status === "Occupied"
                      ? "Occupied"
                      : r.is_ready
                        ? "Ready"
                        : r.housekeeping_status}
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="panel attention-panel">
          <div className="panel-heading">
            <h2>Needs a little attention</h2>
            <span className="attention-dot" />
          </div>
          <Link className="attention-row" to="/rooms?filter=inspection">
            <span className="attention-icon">
              <Check size={18} />
            </span>
            <div>
              <strong>{c.clean} rooms to inspect</strong>
              <p>Cleaned and awaiting your approval</p>
            </div>
            <ChevronRight size={17} />
          </Link>
          <Link className="attention-row" to="/housekeeping">
            <span className="attention-icon sand">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>{c.dirty} rooms to clean</strong>
              <p>Keep the day’s turnover moving</p>
            </div>
            <ChevronRight size={17} />
          </Link>
          <Link className="attention-row" to="/issues">
            <span className="attention-icon rose">
              <ShieldReady />
            </span>
            <div>
              <strong>{data.open_issues} open room issues</strong>
              <p>Review reported room conditions</p>
            </div>
            <ChevronRight size={17} />
          </Link>
          <div className="daily-note">
            <span>THE HAVEN STANDARD</span>
            <p>
              Vacant. Inspected. In service.
              <br />
              That’s a room ready to welcome.
            </p>
          </div>
        </section>
      </div>
      {!staff && null}
    </>
  );
}
function ShieldReady() {
  return <Check size={19} />;
}
export function ReservationRows({
  rows,
  empty = "Your next stay will appear here.",
}: {
  rows: Reservation[];
  empty?: string;
}) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Guest / reservation</th>
            <th>Room</th>
            <th>Stay</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link className="guest-cell" to={`/reservations/${r.id}`}>
                  <span className="avatar small">
                    {r.guest_name
                      .split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    <strong>{r.guest_name}</strong>
                    <small>{r.reference}</small>
                  </span>
                </Link>
              </td>
              <td>
                <strong>{r.room_number || "Unassigned"}</strong>
                <small>{r.room_type_name}</small>
              </td>
              <td>
                <strong>
                  {day(r.check_in_date)} — {day(r.check_out_date)}
                </strong>
                <small>
                  {r.number_of_nights} nights · {r.guest_count} guests
                </small>
              </td>
              <td>
                <Badge>{r.status}</Badge>
              </td>
              <td>
                <Link
                  to={`/reservations/${r.id}`}
                  className="table-arrow"
                  aria-label={`Open ${r.reference}`}
                >
                  <ChevronRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="A little breathing room" text={empty} />
  );
}
