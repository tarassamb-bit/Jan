import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronRight, FiCpu, FiDatabase, FiEdit2, FiFile, FiLock, FiLogOut, FiMonitor, FiMoon, FiPlus, FiSearch, FiSettings, FiSliders, FiSun, FiTrash2, FiX } from "react-icons/fi";
import "./settings-modal.css";

const SECTIONS = [
  { id: "General", icon: FiSettings },
  { id: "Usage", icon: FiCpu },
  { id: "Personalization", icon: FiSliders },
  { id: "Developer", icon: FiCpu },
  { id: "Data controls", icon: FiDatabase },
  { id: "Storage", icon: FiFile },
  { id: "Security and login", icon: FiLock },
];
const SECTION_SLUGS = { General: "general", Usage: "usage", Personalization: "personalization", Developer: "developer", "Data controls": "data-controls", Storage: "storage", "Security and login": "security" };

function SettingRow({ title, description, children }) {
  return <div className="jan-settings-row"><div className="jan-settings-row-copy"><strong>{title}</strong>{description && <small>{description}</small>}</div>{children}</div>;
}

function Toggle({ label, checked, onChange }) {
  return <label className="jan-settings-switch"><input type="checkbox" aria-label={label} checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} /><span aria-hidden="true" /></label>;
}

function UsageMeter({ label, value, limit, description }) {
  const used = Math.min(limit, Math.max(0, Number(value) || 0));
  return <div className="jan-usage-meter"><div className="jan-usage-meter-top"><div><strong>{label}</strong><small>{description}</small></div><span>{used} <em>/ {limit}</em></span></div><div className="jan-usage-track" role="progressbar" aria-label={`${label} used`} aria-valuenow={used} aria-valuemin="0" aria-valuemax={limit}><span style={{ width: `${Math.round(used / limit * 100)}%` }} /></div><small>{limit - used} remaining today</small></div>;
}
function formatBytes(value) { const bytes = Math.max(0, Number(value) || 0); if (bytes < 1024 * 1024) return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

function getNextUsageReset(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function UsageReset() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const reset = getNextUsageReset(now);
  const minutes = Math.ceil((reset.getTime() - now.getTime()) / 60000);
  const hoursLeft = Math.floor(minutes / 60);
  const minutesLeft = minutes % 60;
  const localTime = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(reset);
  return <div className="jan-settings-reset"><div><strong>Next reset</strong><small>Daily limits reset at 00:00 UTC</small></div><div><strong>{localTime}</strong><small>In {hoursLeft ? `${hoursLeft}h ` : ""}{minutesLeft}m</small></div></div>;
}

export default function SettingsModal({ user, userDisplayName, usage, settings, memories, memoryLimit = 25, storageUsageBytes = 0, storageLimitBytes = 250 * 1024 * 1024, promoCode = "", onApplyPromoCode, initialSection = "General", onSectionChange, onAddMemory, onUpdateMemory, onDeleteMemory, onSettingsChange, onChangePassword, onClose, onSignOut }) {
  const [section, setSection] = useState(initialSection);
  const [query, setQuery] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryQuery, setMemoryQuery] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [editingMemoryDraft, setEditingMemoryDraft] = useState("");
  const [memoryFeedback, setMemoryFeedback] = useState("");
  const [instructionsDraft, setInstructionsDraft] = useState(() => settings.custom_instructions || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);
  const [promoDraft, setPromoDraft] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState(null);
  const closeRef = useRef(null);
  const visible = SECTIONS.filter(({ id }) => id.toLowerCase().includes(query.trim().toLowerCase()));
  const visibleMemories = memories.filter((memory) => memory.content.toLowerCase().includes(memoryQuery.trim().toLowerCase()));
  const save = (next) => onSettingsChange({ ...settings, ...next });

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => { setSection(initialSection); }, [initialSection]);
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const addMemory = async (event) => {
    event.preventDefault();
    const text = memoryDraft.trim();
    if (!text) return;
    if (memories.length >= memoryLimit) { setMemoryFeedback(`You can save up to ${memoryLimit} memories. Remove one before adding another.`); return; }
    if (memories.some((memory) => memory.content.toLowerCase() === text.toLowerCase())) { setMemoryFeedback("That memory is already saved."); return; }
    const saved = await onAddMemory(text);
    if (saved !== false) { setMemoryDraft(""); setMemoryFeedback("Memory saved."); }
    else setMemoryFeedback("Jan couldn’t save that memory. Please try again.");
  };

  const saveInstructions = () => save({ custom_instructions: instructionsDraft });
  const selectSection = (nextSection) => { setSection(nextSection); onSectionChange?.(SECTION_SLUGS[nextSection]); };
  const saveMemoryEdit = async (id) => { if (await onUpdateMemory?.(id, editingMemoryDraft) !== false) { setEditingMemoryId(null); setEditingMemoryDraft(""); } };

  const submitPassword = async (event) => {
    event.preventDefault();
    setPasswordFeedback(null);
    if (newPassword.length < 8) { setPasswordFeedback({ type: "error", text: "Use at least 8 characters for your new password." }); return; }
    if (newPassword !== confirmPassword) { setPasswordFeedback({ type: "error", text: "The new passwords don’t match." }); return; }
    if (newPassword === currentPassword) { setPasswordFeedback({ type: "error", text: "Choose a password different from your current one." }); return; }
    setPasswordBusy(true);
    try {
      const result = await onChangePassword({ currentPassword, newPassword });
      if (result.error) { setPasswordFeedback({ type: "error", text: result.error }); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPasswordFeedback({ type: "success", text: "Password changed successfully." });
    } catch {
      setPasswordFeedback({ type: "error", text: "Couldn’t change your password. Please try again." });
    } finally { setPasswordBusy(false); }
  };

  const submitPromoCode = async (event) => {
    event.preventDefault();
    setPromoFeedback(null);
    setPromoBusy(true);
    try {
      const result = await onApplyPromoCode?.(promoDraft);
      setPromoFeedback(result?.error
        ? { type: "error", text: result.error }
        : { type: "success", text: "FREE applied. You now have unlimited messages, uploads, and storage." });
      if (!result?.error) setPromoDraft("");
    } catch {
      setPromoFeedback({ type: "error", text: "Couldn’t apply that code. Please try again." });
    } finally { setPromoBusy(false); }
  };

  const content = {
    General: <>
      <div className="jan-settings-intro"><div className="jan-settings-intro-icon"><FiSettings /></div><div><strong>Your workspace</strong><p>Make Jan feel right for you. Changes save automatically.</p></div><span><FiCheck /> Auto-save</span></div>
      <h2 className="jan-settings-group-title">Preferences</h2>
      <div className="jan-settings-group">
        <SettingRow title="Appearance" description="Choose how Jan looks on this device."><div className="jan-appearance-options" role="group" aria-label="Appearance">{[["system", FiMonitor, "System"], ["light", FiSun, "Light"], ["dark", FiMoon, "Dark"]].map(([value, Icon, label]) => <button type="button" key={value} className={settings.appearance === value ? "active" : ""} onClick={() => save({ appearance: value })} aria-pressed={settings.appearance === value}><Icon />{label}</button>)}</div></SettingRow>
        <SettingRow title="Language" description="Jan detects the language you use."><select aria-label="Language" value="auto" disabled><option value="auto">Auto-detect</option></select></SettingRow>
        <SettingRow title="Response streaming" description="Show Jan’s answer as it is written."><Toggle label="Response streaming" checked={settings.response_streaming} onChange={(value) => save({ response_streaming: value })} /></SettingRow>
      </div>
    </>,
    Usage: <>
      <div className="jan-settings-plan"><div><span>YOUR PLAN</span><strong>{promoCode === "FREE" ? "Jan Unlimited" : "Jan Free"}</strong><p>{promoCode === "FREE" ? "Unlimited messages, uploads, and storage are active." : "Your daily allowance resets automatically."}</p></div><span className="jan-settings-plan-badge">Active</span></div>
      <h2 className="jan-settings-group-title">Today’s usage</h2>
      {promoCode === "FREE" ? <div className="jan-settings-unlimited"><strong>Unlimited access</strong><span>Messages, file uploads, and storage</span></div> : <><div className="jan-settings-usage-card"><UsageMeter label="Messages" description="Chats with Jan" value={usage.messages} limit={100} /><UsageMeter label="Uploads" description="Files added to chats or projects" value={usage.uploads} limit={3} /></div><UsageReset /></>}
      <h2 className="jan-settings-group-title">Promo code</h2>
      <form className="jan-settings-promo" onSubmit={submitPromoCode}><label htmlFor="jan-promo-code">{promoCode === "FREE" ? "Code applied" : "Enter a promo code"}</label><div><input id="jan-promo-code" value={promoDraft} onChange={(event) => { setPromoDraft(event.target.value); setPromoFeedback(null); }} placeholder={promoCode === "FREE" ? "FREE" : "Promo code"} aria-label="Promo code" disabled={promoCode === "FREE" || promoBusy} /><button type="submit" disabled={promoCode === "FREE" || !promoDraft.trim() || promoBusy}>{promoBusy ? "Applying…" : promoCode === "FREE" ? "Applied" : "Apply"}</button></div>{promoFeedback && <small className={promoFeedback.type} role={promoFeedback.type === "error" ? "alert" : "status"}>{promoFeedback.text}</small>}</form>
    </>,
    Personalization: <>
      <div className="jan-settings-personalization-summary"><div><strong>Make Jan yours</strong><p>Your style and memories are included privately when they help answer a request.</p></div><span>{memories.length} memor{memories.length === 1 ? "y" : "ies"}</span></div>
      <h2 className="jan-settings-group-title">Response style</h2>
      <div className="jan-response-styles">{[["concise", "Concise", "Short, direct answers"], ["balanced", "Balanced", "Clear detail when useful"], ["detailed", "Detailed", "Thorough explanations"]].map(([value, label, copy]) => <button type="button" key={value} className={(settings.response_style || "balanced") === value ? "active" : ""} onClick={() => save({ response_style: value })}><span>{label}</span><small>{copy}</small>{(settings.response_style || "balanced") === value && <FiCheck />}</button>)}</div>
      <h2 className="jan-settings-group-title">How Jan responds</h2>
      <div className="jan-settings-group jan-settings-instructions"><label htmlFor="jan-custom-instructions"><strong>Custom instructions</strong><small>Tell Jan what you want it to know about your preferred style.</small></label><textarea id="jan-custom-instructions" value={instructionsDraft} onChange={(event) => setInstructionsDraft(event.target.value.slice(0, 800))} maxLength={800} placeholder="For example: keep answers concise and use simple language." /><div className="jan-settings-instructions-footer"><span>{instructionsDraft.length} / 800</span><button type="button" onClick={saveInstructions} disabled={instructionsDraft === (settings.custom_instructions || "")}>Save changes</button></div></div>
      <h2 className="jan-settings-group-title">Memory</h2>
      <div className="jan-settings-group jan-settings-memories"><div className="jan-memory-heading"><div><strong>Saved memories</strong><small>Save useful preferences—never passwords or secrets.</small></div><span>{memories.length} / {memoryLimit}</span></div><form onSubmit={addMemory}><input value={memoryDraft} onChange={(event) => { setMemoryDraft(event.target.value); setMemoryFeedback(""); }} maxLength={220} placeholder="For example: I’m vegetarian and prefer metric units" aria-label="Add a memory" /><button type="submit" disabled={!memoryDraft.trim() || memories.length >= memoryLimit}><FiPlus /> Add</button></form>{memoryFeedback && <p className="jan-memory-feedback" role="status">{memoryFeedback}</p>}{memories.length > 4 && <label className="jan-memory-search"><FiSearch /><input value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} placeholder="Search memories" aria-label="Search memories" /></label>}{visibleMemories.length ? <ul>{visibleMemories.map((memory) => <li key={memory.id}>{editingMemoryId === memory.id ? <><input className="jan-memory-edit" autoFocus value={editingMemoryDraft} maxLength={220} onChange={(event) => setEditingMemoryDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveMemoryEdit(memory.id); if (event.key === "Escape") setEditingMemoryId(null); }} /><div><button type="button" className="save" onClick={() => saveMemoryEdit(memory.id)} aria-label="Save memory"><FiCheck /></button><button type="button" onClick={() => setEditingMemoryId(null)} aria-label="Cancel editing"><FiX /></button></div></> : <><span>{memory.content}</span><div><button type="button" onClick={() => { setEditingMemoryId(memory.id); setEditingMemoryDraft(memory.content); }} aria-label={`Edit ${memory.content}`}><FiEdit2 /></button><button type="button" onClick={() => onDeleteMemory(memory.id)} aria-label={`Forget ${memory.content}`}><FiTrash2 /></button></div></>}</li>)}</ul> : <div className="jan-settings-empty">{memoryQuery ? "No memories match your search." : "No memories saved yet. Add one above when there’s something useful Jan should remember."}</div>}</div>
    </>,
    Developer: <>
      <h2 className="jan-settings-group-title">Response diagnostics</h2>
      <div className="jan-settings-group"><SettingRow title="Developer mode" description="Show response time and estimated token speed below replies."><Toggle label="Developer mode" checked={settings.developer_mode} onChange={(value) => save({ developer_mode: value })} /></SettingRow></div>
      <p className="jan-settings-help">Token counts are estimated from the visible answer. They are useful for debugging, not billing.</p>
    </>,
    "Data controls": <>
      <h2 className="jan-settings-group-title">Your data</h2>
      <div className="jan-settings-group"><SettingRow title="Chats and projects" description="Saved to your account so you can return to them later."><FiCheck className="jan-settings-row-check" /></SettingRow><SettingRow title="Memories" description="Review and remove saved memories in Personalization."><button type="button" className="jan-settings-text-action" onClick={() => selectSection("Personalization")}>Manage <FiChevronRight /></button></SettingRow></div>
    </>,
    Storage: <>
      <h2 className="jan-settings-group-title">Project files</h2>
      <div className="jan-storage-meter"><div><strong>Storage used</strong><span>{formatBytes(storageUsageBytes)} of {promoCode === "FREE" ? "Unlimited" : formatBytes(storageLimitBytes)}</span></div><div role="progressbar" aria-label="Storage used" aria-valuemin="0" aria-valuemax={storageLimitBytes} aria-valuenow={storageUsageBytes}><span style={{ width: `${promoCode === "FREE" ? 0 : Math.min(100, storageUsageBytes / storageLimitBytes * 100)}%` }} /></div><small>{promoCode === "FREE" ? "Unlimited available" : `${formatBytes(Math.max(0, storageLimitBytes - storageUsageBytes))} available`}</small></div>
      <div className="jan-settings-group"><SettingRow title="Private storage" description={`Project and Library files count toward your ${promoCode === "FREE" ? "unlimited" : "250 MB"} limit.`}><FiLock className="jan-settings-row-check" /></SettingRow><SettingRow title="Compression" description="Images are converted to WebP and text files are compressed before upload."><FiCheck className="jan-settings-row-check" /></SettingRow></div>
    </>,
    "Security and login": <>
      <h2 className="jan-settings-group-title">Account</h2>
      <div className="jan-settings-group"><SettingRow title="Signed in as" description={user.email}><FiLock className="jan-settings-row-check" /></SettingRow><SettingRow title="Sign out" description="End this session on this device."><button type="button" className="jan-settings-signout" onClick={onSignOut}>Sign out</button></SettingRow></div>
      <h2 className="jan-settings-group-title">Password</h2>
      {user.is_demo ? <div className="jan-settings-password-note">Password changes are available for signed-in Jan accounts, not the local demo.</div> : <form className="jan-settings-password" onSubmit={submitPassword}><p>Enter your current password to set a new one.</p><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setPasswordFeedback(null); }} required /></label><label>New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setPasswordFeedback(null); }} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setPasswordFeedback(null); }} required /></label>{passwordFeedback && <p className={`jan-settings-password-feedback ${passwordFeedback.type}`} role={passwordFeedback.type === "error" ? "alert" : "status"}>{passwordFeedback.text}</p>}<button type="submit" disabled={passwordBusy}>{passwordBusy ? "Updating…" : "Change password"}</button></form>}
    </>,
  }[section];

  return <div className="jan-settings-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="jan-settings-modal" role="dialog" aria-modal="true" aria-labelledby="jan-settings-title"><aside className="jan-settings-sidebar"><div className="jan-settings-sidebar-top"><button ref={closeRef} type="button" className="jan-settings-close" onClick={onClose} aria-label="Close settings"><FiX /></button><span>SETTINGS</span></div><label className="jan-settings-search"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings" aria-label="Search settings" /></label><nav aria-label="Settings sections">{visible.length ? visible.map(({ id, icon: Icon }) => <button type="button" key={id} className={section === id ? "active" : ""} onClick={() => selectSection(id)} aria-current={section === id ? "page" : undefined}><Icon /><span>{id}</span></button>) : <p className="jan-settings-no-results">No matching settings</p>}</nav><div className="jan-settings-account"><span className="jan-settings-avatar">{userDisplayName.charAt(0).toUpperCase()}</span><div><strong>{userDisplayName}</strong><small>{user.email}</small></div><button type="button" onClick={onSignOut} aria-label="Log out"><FiLogOut /></button></div></aside><main className="jan-settings-main"><header><div><p>YOUR SETTINGS</p><h1 id="jan-settings-title">{section}</h1></div><span>Jan Free</span></header>{content}</main></section></div>;
}
