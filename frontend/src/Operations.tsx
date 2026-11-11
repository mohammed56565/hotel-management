import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BedDouble,
  Check,
  Flag,
  Plus,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { api, post, put } from "./api";
import { useApp } from "./context";
import type { Issue, Room, RoomType, Task } from "./types";
import {
  Badge,
  Button,
  Confirm,
  Empty,
  ErrorBox,
  Field,
  LoadState,
  Modal,
  PageTitle,
  useApi,
} from "./ui";

export function Rooms() {
  const { user, version, refresh, notify } = useApp(),
    { data, loading, error } = useApi<Room[]>("/rooms", version),
    [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get("filter") || "all"),
    [query, setQuery] = useState(""),
    [edit, setEdit] = useState<Room | "new" | null>(null),
    [confirm, setConfirm] = useState<{ room: Room; action: string } | null>(
      null,
    );
  const rooms = (data || []).filter(
    (r) =>
      (filter === "all" ||
        (filter === "ready" && r.is_ready) ||
        (filter === "occupied" && r.occupancy_status === "Occupied") ||
        (filter === "dirty" && r.housekeeping_status === "Dirty") ||
        (filter === "inspection" && r.housekeeping_status === "Clean") ||
        (filter === "out" && r.operational_status === "Out of Order")) &&
      `${r.room_number} ${r.room_type_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="ROOM OPERATIONS"
        title="Room board"
        description="A clear view of every room. Three statuses, one standard of care."
        action={
          user.role === "Admin" && (
            <Button onClick={() => setEdit("new")}>
              <Plus size={17} />
              Add room
            </Button>
          )
        }
      />
      <div className="panel room-board-panel">
        <div className="tabs">
          {[
            ["all", "All rooms"],
            ["ready", "Ready"],
            ["occupied", "Occupied"],
            ["dirty", "Needs cleaning"],
            ["inspection", "Awaiting inspection"],
            ["out", "Out of order"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search rooms"
              placeholder="Find a room number or type…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="result-count">{rooms.length} rooms</span>
          <div className="board-key">
            <i className="dot ready" />
            Ready for check-in
          </div>
        </div>
        <LoadState loading={loading} error={error} />
        {!loading &&
          !error &&
          (rooms.length ? (
            <div className="room-grid">
              {rooms.map((r) => (
                <article
                  className={"room-card " + (!r.is_active ? "inactive" : "")}
                  key={r.id}
                >
                  <div className="room-card-top">
                    <div>
                      <span className="room-label">ROOM</span>
                      <h2>{r.room_number}</h2>
                    </div>
                    <span
                      className={
                        "room-status-icon " + (r.is_ready ? "ready" : "")
                      }
                    >
                      <BedDouble size={25} />
                    </span>
                  </div>
                  <p className="room-type-label">
                    {r.room_type_name} <span>· Floor {r.floor}</span>
                  </p>
                  <div className="status-dimensions">
                    <div>
                      <span>Occupancy</span>
                      <Badge>{r.occupancy_status}</Badge>
                    </div>
                    <div>
                      <span>Housekeeping</span>
                      <Badge>{r.housekeeping_status}</Badge>
                    </div>
                    <div>
                      <span>Operational</span>
                      <Badge>{r.operational_status}</Badge>
                    </div>
                  </div>
                  {!r.is_active && <Badge>Inactive</Badge>}
                  {r.notes && <p className="room-note">{r.notes}</p>}
                  <div className="room-card-actions">
                    {r.housekeeping_status === "Clean" &&
                    r.occupancy_status === "Vacant" &&
                    r.operational_status === "In Service" &&
                    r.is_active ? (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setConfirm({ room: r, action: "inspect" })
                        }
                      >
                        <Check size={15} />
                        Mark inspected
                      </Button>
                    ) : (
                      <span
                        className={
                          "readiness-label " + (r.is_ready ? "yes" : "")
                        }
                      >
                        {r.is_ready ? (
                          <>
                            <Check size={14} />
                            Ready for guests
                          </>
                        ) : (
                          "Not ready for check-in"
                        )}
                      </span>
                    )}
                    <details className="action-menu">
                      <summary aria-label={`Room ${r.room_number} actions`}>
                        •••
                      </summary>
                      <div>
                        {user.role === "Admin" && (
                          <button onClick={() => setEdit(r)}>Edit room</button>
                        )}
                        <button
                          onClick={() =>
                            setConfirm({ room: r, action: "operational" })
                          }
                        >
                          {r.operational_status === "In Service"
                            ? "Mark out of order"
                            : "Restore to service"}
                        </button>
                      </div>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No rooms match"
              text="Try a different status or room number."
            />
          ))}
      </div>
      {edit && <RoomEditor room={edit} onClose={() => setEdit(null)} />}{" "}
      {confirm && (
        <Confirm
          title={
            confirm.action === "inspect"
              ? `Approve room ${confirm.room.room_number}?`
              : `Change room ${confirm.room.room_number} status?`
          }
          text={
            confirm.action === "inspect"
              ? "Confirm that you have inspected the cleaned room and approved it for guest use."
              : confirm.room.operational_status === "In Service"
                ? "This removes the room from available inventory. Existing stays and assignments must remain valid."
                : "The room will return to available inventory. Its occupancy and housekeeping status remain independently tracked."
          }
          danger={
            confirm.action === "operational" &&
            confirm.room.operational_status === "In Service"
          }
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.action === "inspect")
              await post(`/rooms/${confirm.room.id}/inspect`);
            else
              await api(`/rooms/${confirm.room.id}/operational`, {
                method: "PATCH",
                body: JSON.stringify({
                  operational_status:
                    confirm.room.operational_status === "In Service"
                      ? "Out of Order"
                      : "In Service",
                }),
              });
            refresh();
            notify("Room updated successfully.");
          }}
        />
      )}
    </>
  );
}

function RoomEditor({
  room,
  onClose,
}: {
  room: Room | "new";
  onClose: () => void;
}) {
  const { refresh, notify } = useApp(),
    isNew = room === "new",
    r = isNew ? null : room,
    { data: types } = useApi<RoomType[]>("/room-types?include_inactive=true"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const common = {
      room_number: f.get("room_number"),
      floor: Number(f.get("floor")),
      notes: f.get("notes"),
    };
    try {
      if (isNew)
        await post("/rooms", {
          ...common,
          room_type_id: Number(f.get("room_type_id")),
        });
      else
        await put(`/rooms/${r!.id}`, {
          ...common,
          is_active: f.get("is_active") === "on",
        });
      refresh();
      notify("Room saved.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={isNew ? "Add a room" : `Edit room ${r!.room_number}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Room number">
            <input
              name="room_number"
              required
              maxLength={12}
              pattern="[A-Za-z0-9-]+"
              defaultValue={r?.room_number}
            />
          </Field>
          <Field label="Floor">
            <input
              type="number"
              name="floor"
              required
              min={-5}
              max={200}
              defaultValue={r?.floor ?? 1}
            />
          </Field>
        </div>
        {isNew && (
          <Field label="Room type">
            <select name="room_type_id" required defaultValue="">
              <option value="" disabled>
                Choose room type
              </option>
              {types?.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Notes">
          <textarea name="notes" maxLength={2000} defaultValue={r?.notes} />
        </Field>
        {!isNew && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={r!.is_active}
            />
            Active room
          </label>
        )}
        <ErrorBox message={error} />
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy}>{busy ? "Saving…" : "Save room"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function Housekeeping() {
  const { user, version, refresh, notify } = useApp(),
    { data, loading, error } = useApi<Task[]>("/housekeeping/tasks", version),
    [filter, setFilter] = useState("active"),
    [selected, setSelected] = useState<{ task: Task; action: string } | null>(
      null,
    );
  const staff = user.role !== "Housekeeping",
    tasks = (data || []).filter(
      (t) =>
        filter === "all" ||
        (filter === "active" && t.status !== "Completed") ||
        filter === t.status,
    );
  return (
    <>
      <PageTitle
        eyebrow="ROOM CARE"
        title={staff ? "Housekeeping" : "My cleaning tasks"}
        description={
          staff
            ? "Coordinate cleaning, follow progress, and prepare for the next arrival."
            : "Your rooms, your rhythm. A fresh start for every guest."
        }
      />
      <div className="panel">
        <div className="tabs">
          {[
            ["active", "Active tasks"],
            ["Open", "Open"],
            ["In Progress", "In progress"],
            ["Completed", "Completed"],
            ["all", "All tasks"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {label}{" "}
              <span className="count-chip">
                {
                  (data || []).filter(
                    (t) =>
                      key === "all" ||
                      (key === "active" && t.status !== "Completed") ||
                      t.status === key,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <LoadState loading={loading} error={error} />
        {!loading &&
          !error &&
          (tasks.length ? (
            <div className="task-grid">
              {tasks.map((t) => (
                <article className="task-card" key={t.id}>
                  <div className="task-card-top">
                    <span className="room-number-box">{t.room_number}</span>
                    <div>
                      <h3>{t.room_type_name}</h3>
                      <p>
                        Floor {t.floor} · Task #{t.id}
                      </p>
                    </div>
                    {t.priority === "High" && (
                      <span className="priority">
                        <Flag size={13} />
                        High
                      </span>
                    )}
                  </div>
                  <div className="task-meta">
                    <Badge>{t.status}</Badge>
                    <span>
                      <UserRound size={14} />
                      {t.assigned_staff_name || "Unassigned"}
                    </span>
                  </div>
                  {t.notes && <p className="task-notes">{t.notes}</p>}
                  <div className="task-actions">
                    {staff ? (
                      t.status === "Open" ? (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setSelected({ task: t, action: "assign" })
                          }
                        >
                          {t.assigned_staff_id
                            ? "Reassign task"
                            : "Assign staff"}
                        </Button>
                      ) : (
                        <span className="tiny muted">
                          {t.status === "Completed"
                            ? "Cleaning finished · inspection is separate"
                            : "Cleaning is in progress"}
                        </span>
                      )
                    ) : (
                      <>
                        {t.status === "Open" && (
                          <Button
                            onClick={async () => {
                              try {
                                await post(`/housekeeping/tasks/${t.id}/start`);
                                refresh();
                                notify("Cleaning started.");
                              } catch (e) {
                                notify((e as Error).message);
                              }
                            }}
                          >
                            <Sparkles size={15} />
                            Start cleaning
                          </Button>
                        )}
                        {t.status === "In Progress" && (
                          <Button
                            onClick={() =>
                              setSelected({ task: t, action: "complete" })
                            }
                          >
                            <Check size={15} />
                            Complete cleaning
                          </Button>
                        )}
                        <Button
                          variant="quiet"
                          onClick={() =>
                            setSelected({ task: t, action: "issue" })
                          }
                        >
                          Report issue
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty title="All clear here" text="No tasks match this view." />
          ))}
      </div>
      {selected && (
        <TaskAction {...selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function TaskAction({
  task,
  action,
  onClose,
}: {
  task: Task;
  action: string;
  onClose: () => void;
}) {
  const { refresh, notify } = useApp(),
    [staff, setStaff] = useState<{ id: number; name: string }[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (action === "assign")
      api<{ id: number; name: string }[]>("/staff/housekeeping")
        .then(setStaff)
        .catch((e) => setError(e.message));
  }, [action]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (action === "assign")
        await post(`/housekeeping/tasks/${task.id}/assign`, {
          assigned_staff_id: Number(f.get("staff")),
          priority: f.get("priority"),
        });
      else if (action === "complete")
        await post(`/housekeeping/tasks/${task.id}/complete`, {
          notes: f.get("notes"),
        });
      else
        await post("/issues", {
          room_id: task.room_id,
          description: f.get("description"),
        });
      refresh();
      notify(
        action === "complete"
          ? "Cleaning completed. The room is ready for inspection."
          : action === "assign"
            ? "Task assigned."
            : "Room issue reported.",
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        action === "assign"
          ? "Assign cleaning task"
          : action === "complete"
            ? "Complete cleaning"
            : "Report a room issue"
      }
      description={`Room ${task.room_number} · ${task.room_type_name}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {action === "assign" ? (
          <>
            <Field label="Housekeeping staff">
              <select
                name="staff"
                required
                defaultValue={task.assigned_staff_id || ""}
              >
                <option value="" disabled>
                  Select staff
                </option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue={task.priority}>
                <option>Normal</option>
                <option>High</option>
              </select>
            </Field>
          </>
        ) : action === "complete" ? (
          <>
            <p className="confirm-copy">
              Completing this task marks the room clean. Reception will inspect
              it before the next check-in.
            </p>
            <Field label="Cleaning notes (optional)">
              <textarea
                name="notes"
                maxLength={2000}
                defaultValue={task.notes}
              />
            </Field>
          </>
        ) : (
          <Field label="What needs attention?">
            <textarea
              name="description"
              required
              minLength={5}
              maxLength={2000}
              placeholder="Describe the room issue…"
            />
          </Field>
        )}
        <ErrorBox message={error} />
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy}>
            {busy
              ? "Saving…"
              : action === "assign"
                ? "Assign task"
                : action === "complete"
                  ? "Complete cleaning"
                  : "Report issue"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Issues() {
  const { user, version, refresh, notify } = useApp(),
    { data, loading, error } = useApi<Issue[]>("/issues", version),
    [filter, setFilter] = useState("Open"),
    [resolve, setResolve] = useState<Issue | null>(null),
    [report, setReport] = useState(false);
  const issues = (data || []).filter((i) => !filter || i.status === filter);
  return (
    <>
      <PageTitle
        eyebrow="ROOM CONDITIONS"
        title="Room issues"
        description="Small details deserve attention. Track reported room conditions here."
        action={
          user.role !== "Housekeeping" && (
            <Button onClick={() => setReport(true)}>
              <Plus size={16} />
              Report issue
            </Button>
          )
        }
      />
      {user.role === "Housekeeping" && (
        <p className="info-line">
          Report an issue from the relevant room on your cleaning tasks screen.
        </p>
      )}
      <section className="panel">
        <div className="tabs">
          {["Open", "Resolved", ""].map((s) => (
            <button
              className={s === filter ? "active" : ""}
              onClick={() => setFilter(s)}
              key={s}
            >
              {s || "All issues"}
            </button>
          ))}
        </div>
        <LoadState loading={loading} error={error} />
        {!loading &&
          !error &&
          (issues.length ? (
            <div className="issue-list">
              {issues.map((i) => (
                <article key={i.id}>
                  <span className="room-number-box">{i.room_number}</span>
                  <div>
                    <strong>Room {i.room_number}</strong>
                    <p>{i.description}</p>
                    <small>
                      {new Date(i.reported_at).toLocaleDateString()}
                    </small>
                  </div>
                  <Badge>{i.status}</Badge>
                  {user.role !== "Housekeeping" && i.status === "Open" && (
                    <Button variant="secondary" onClick={() => setResolve(i)}>
                      Resolve
                    </Button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No issues to show"
              text="Reported room conditions will appear here."
            />
          ))}
      </section>
      {resolve && (
        <Confirm
          title="Resolve this issue?"
          text="Confirm the reported condition has been addressed. Operational room status can be updated separately on the room board."
          onClose={() => setResolve(null)}
          onConfirm={async () => {
            await post(`/issues/${resolve.id}/resolve`);
            refresh();
            notify("Room issue resolved.");
          }}
        />
      )}
      {report && <ReportIssue onClose={() => setReport(false)} />}
    </>
  );
}

function ReportIssue({ onClose }: { onClose: () => void }) {
  const { data: rooms } = useApi<Room[]>("/rooms"),
    { refresh, notify } = useApp(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Report a room issue" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await post("/issues", {
              room_id: Number(f.get("room")),
              description: f.get("description"),
            });
            refresh();
            notify("Issue reported.");
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Room">
          <select name="room" required defaultValue="">
            <option value="" disabled>
              Select room
            </option>
            {rooms?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_number} · {r.room_type_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            required
            minLength={5}
            maxLength={2000}
          />
        </Field>
        <ErrorBox message={error} />
        <div className="modal-actions">
          <Button disabled={busy}>Report issue</Button>
        </div>
      </form>
    </Modal>
  );
}
